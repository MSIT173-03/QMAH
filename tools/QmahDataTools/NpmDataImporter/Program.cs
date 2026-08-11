using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;
using QMAH.Web.Models.Entities;

var o = Options.Parse(args);
if (o.Help) { Console.WriteLine("NpmDataImporter --project <QMAH root> --artifacts <json> --products <json> --media-root <folder> [--artifact-per-category 32] [--max-products 48 | --skip-products] [--apply --approve <預檢確認碼>]"); return; }
var webRoot = Path.Combine(o.Project, "QMAH.Web");
if (!File.Exists(Path.Combine(webRoot, "QMAH.Web.csproj"))) throw new InvalidOperationException("目標必須是含 QMAH.Web.csproj 的 QMAH 專案。");
var artifacts = Load<ArtifactRow>(o.Artifacts, "artifactRef")
    .Where(x => CatalogProfile.Codes.Contains(x.CategoryCode, StringComparer.OrdinalIgnoreCase))
    .Where(x => string.Equals(x.NormalizationStatus, "AUTO_VERIFIED", StringComparison.OrdinalIgnoreCase))
    .GroupBy(x => x.CategoryCode, StringComparer.OrdinalIgnoreCase)
    .OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
    .SelectMany(x => x.OrderBy(y => y.ArtifactRef, StringComparer.OrdinalIgnoreCase).Take(o.ArtifactPerCategory))
    .ToList();
var products = (o.ProductLimit == 0 ? [] : Load<ProductRow>(o.Products, "externalRef"))
    .OrderBy(x => x.ExternalRef, StringComparer.OrdinalIgnoreCase)
    .Take(o.ProductLimit)
    .ToList();
var artifactCounts = artifacts.GroupBy(x => x.CategoryCode, StringComparer.OrdinalIgnoreCase)
    .ToDictionary(x => x.Key, x => x.Count(), StringComparer.OrdinalIgnoreCase);
var missingCategories = CatalogProfile.Codes.Where(code => !artifactCounts.TryGetValue(code, out var count) || count < o.ArtifactPerCategory).ToArray();
ValidateMedia(artifacts.Select(x => x.ImageUrl).Concat(artifacts.Select(x => x.ThumbnailUrl)).Concat(products.Select(x => x.ImageUrl)), o.MediaRoot);
var dbOptions = new DbContextOptionsBuilder<QmahDbContext>().UseSqlServer(o.Connection).Options;
await using var db = new QmahDbContext(dbOptions);
if (!await db.Database.CanConnectAsync()) throw new InvalidOperationException("無法連線目標 SQL Server；請先依 database/README.md 建立並核對 QMAH Schema。匯入器不會自動建表。");
var oldArtifacts = await db.Artifacts.Where(x => artifacts.Select(a => a.ArtifactRef).Contains(x.ArtifactRef)).Select(x => x.ArtifactRef).ToListAsync();
var oldProducts = await db.Products.Where(x => x.ExternalRef != null && products.Select(p => p.ExternalRef).Contains(x.ExternalRef)).Select(x => x.ExternalRef!).ToListAsync();
var freshArtifacts = artifacts.Where(x => !oldArtifacts.Contains(x.ArtifactRef, StringComparer.OrdinalIgnoreCase)).ToList();
var freshProducts = products.Where(x => !oldProducts.Contains(x.ExternalRef, StringComparer.OrdinalIgnoreCase)).ToList();
var selectedArtifactIds = await db.Artifacts
    .Where(x => artifacts.Select(a => a.ArtifactRef).Contains(x.ArtifactRef))
    .ToDictionaryAsync(x => x.ArtifactRef, x => x.Id, StringComparer.OrdinalIgnoreCase);
foreach (var artifact in freshArtifacts)
    selectedArtifactIds[artifact.ArtifactRef] = artifact.Id == Guid.Empty ? Guid.NewGuid() : artifact.Id;
var questionArtifactIds = artifacts
    .Where(x => x.QuestionEnabled)
    .Select(x => selectedArtifactIds[x.ArtifactRef])
    .ToArray();
var existingQuestionArtifactIds = await db.ArtifactQuestionEntries
    .Where(x => questionArtifactIds.Contains(x.ArtifactId))
    .Select(x => x.ArtifactId)
    .ToListAsync();
var freshQuestionArtifactIds = questionArtifactIds
    .Where(id => !existingQuestionArtifactIds.Contains(id))
    .ToArray();
var approval = ApprovalToken(artifacts, products, o);
Console.WriteLine($"PRECHECK|artifactCandidates:{artifacts.Count}|artifacts=new:{freshArtifacts.Count}|duplicate:{oldArtifacts.Count}|questionEntries=new:{freshQuestionArtifactIds.Length}|existing:{existingQuestionArtifactIds.Count}|productCandidates:{products.Count}|products=new:{freshProducts.Count}|duplicate:{oldProducts.Count}");
Console.WriteLine($"PROFILE|categories:{CatalogProfile.Codes.Length}|perCategory:{o.ArtifactPerCategory}|missing:{(missingCategories.Length == 0 ? "none" : string.Join(',', missingCategories))}|productsTarget:{o.ProductLimit}|productGap:{Math.Max(0, o.ProductLimit - products.Count)}");
Console.WriteLine($"APPROVAL_TOKEN|{approval}");
if (!o.Apply) { Console.WriteLine("DRY_RUN|未寫入；資料齊全後，以 --apply --approve <本次確認碼> 才會只新增資料與複製資產。"); return; }
if (missingCategories.Length > 0 || (o.ProductLimit > 0 && products.Count < o.ProductLimit))
    throw new InvalidOperationException("資料包未達固定 8 類或商品目標，禁止寫入。請先補齊來源資料。\n");
if (!string.Equals(o.ApprovalToken, approval, StringComparison.Ordinal))
    throw new InvalidOperationException("確認碼不符或已過期；請重新執行預檢，複製本次 APPROVAL_TOKEN 後再加 --apply。");
var assets = CreateAssetPlans(webRoot, freshArtifacts, freshProducts);
ValidateAssetTargets(assets);
var copiedAssets = new List<string>();
var committed = false;
try
{
    CopyAssets(o.MediaRoot, assets, copiedAssets);
    await using var tx = await db.Database.BeginTransactionAsync();
    var categories = await EnsureCategories(db, freshArtifacts);
    var eras = await EnsureEras(db, freshArtifacts);
    foreach (var a in freshArtifacts)
    {
        db.Artifacts.Add(new Artifact { Id = selectedArtifactIds[a.ArtifactRef], ArtifactRef = a.ArtifactRef, Name = a.Name, CategoryId = categories[a.CategoryCode], EraBucketId = eras[a.EraBucketCode], EraTextOriginal = a.EraTextOriginal, Description = a.DescriptionOriginal, SizeText = string.IsNullOrWhiteSpace(a.SizeOriginal) ? "官方資料未提供" : a.SizeOriginal.Trim(), PrimaryImagePath = AssetPublicPath(assets, "catalog", a.CategoryCode, a.ArtifactRef, "display.jpg"), ThumbnailPath = AssetPublicPath(assets, "catalog", a.CategoryCode, a.ArtifactRef, "thumbnail.jpg"), SourceUrl = a.SourceUrl, LicenseCode = a.LicenseCode, AttributionText = a.AttributionText, IsActive = true });
    }
    var now = DateTime.UtcNow;
    foreach (var artifactId in freshQuestionArtifactIds)
        db.ArtifactQuestionEntries.Add(new ArtifactQuestionEntry { Id = Guid.NewGuid(), ArtifactId = artifactId, IsEnabled = true, Difficulty = 1, QuestionTemplateCode = "GENERAL", CreatedAt = now, UpdatedAt = now });
    foreach (var p in freshProducts)
    {
        db.Products.Add(new Product { Id = p.Id == Guid.Empty ? Guid.NewGuid() : p.Id, ExternalRef = p.ExternalRef, Name = p.Name, CategoryCode = p.CategoryCode, Description = p.Description, Price = p.Price, Stock = p.Stock, PrimaryImagePath = AssetPublicPath(assets, "store", p.CategoryCode, p.ExternalRef, "image.jpg"), SourceUrl = p.SourceUrl, IsActive = p.IsActive, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
    }
    await db.SaveChangesAsync();
    await tx.CommitAsync();
    committed = true;
    Console.WriteLine($"APPLIED|artifacts:{freshArtifacts.Count}|questionEntries:{freshQuestionArtifactIds.Length}|products:{freshProducts.Count}|assets:{copiedAssets.Count}");
}
catch
{
    if (!committed) DeleteCopiedAssets(copiedAssets);
    throw;
}

static List<T> Load<T>(string path, string key) where T : IKeyed { if (string.IsNullOrWhiteSpace(path)) return []; var rows = JsonSerializer.Deserialize<List<T>>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? []; if (rows.Any(x => string.IsNullOrWhiteSpace(x.Key)) || rows.Select(x => x.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rows.Count) throw new InvalidOperationException($"{path} 的 {key} 缺漏或重複。"); return rows; }
static void ValidateMedia(IEnumerable<string?> paths, string root)
{
    var missing = paths.Where(path => !string.IsNullOrWhiteSpace(path))
        .Select(path => path!)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Where(path => !File.Exists(MediaSourcePath(root, path)))
        .ToArray();
    if (missing.Length > 0)
        throw new InvalidDataException($"MEDIA_MISSING|count:{missing.Length}|examples:{string.Join(',', missing.Take(5))}");
}
static List<AssetPlan> CreateAssetPlans(string webRoot, IEnumerable<ArtifactRow> artifacts, IEnumerable<ProductRow> products)
{
    var plans = new List<AssetPlan>();
    foreach (var a in artifacts)
    {
        plans.Add(CreateAssetPlan(webRoot, "catalog", a.CategoryCode, a.ArtifactRef, a.ImageUrl, "display.jpg"));
        plans.Add(CreateAssetPlan(webRoot, "catalog", a.CategoryCode, a.ArtifactRef, a.ThumbnailUrl, "thumbnail.jpg"));
    }
    foreach (var p in products)
        plans.Add(CreateAssetPlan(webRoot, "store", p.CategoryCode, p.ExternalRef, p.ImageUrl, "image.jpg"));
    return plans;
}
static AssetPlan CreateAssetPlan(string webRoot, string domain, string category, string key, string source, string file)
{
    ValidateAssetSegment(domain, "domain");
    ValidateAssetSegment(category, "category");
    ValidateAssetSegment(key, "reference");
    ValidateAssetSegment(file, "file");
    var target = Path.Combine(webRoot, "wwwroot", "media", domain, category.ToLowerInvariant(), key, file);
    return new AssetPlan(source, target, "/media/" + domain + "/" + category.ToLowerInvariant() + "/" + key + "/" + file);
}
static void ValidateAssetTargets(IEnumerable<AssetPlan> plans)
{
    var duplicate = plans.GroupBy(x => x.TargetPath, StringComparer.OrdinalIgnoreCase).FirstOrDefault(x => x.Count() > 1);
    if (duplicate is not null) throw new InvalidDataException($"ASSET_TARGET_DUPLICATE|{duplicate.Key}");
    var existing = plans.Where(x => File.Exists(x.TargetPath)).Select(x => x.PublicPath).ToArray();
    if (existing.Length > 0) throw new InvalidDataException($"ASSET_TARGET_EXISTS|count:{existing.Length}|examples:{string.Join(',', existing.Take(5))}；為避免覆寫既有檔案，請先檢查資料庫與資產一致性。");
}
static void CopyAssets(string root, IEnumerable<AssetPlan> plans, List<string> copied)
{
    foreach (var plan in plans)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(plan.TargetPath)!);
        File.Copy(MediaSourcePath(root, plan.SourcePath), plan.TargetPath, overwrite: false);
        copied.Add(plan.TargetPath);
    }
}
static string AssetPublicPath(IEnumerable<AssetPlan> plans, string domain, string category, string key, string file) =>
    plans.Single(x => x.PublicPath.Equals("/media/" + domain + "/" + category.ToLowerInvariant() + "/" + key + "/" + file, StringComparison.OrdinalIgnoreCase)).PublicPath;
static void DeleteCopiedAssets(IEnumerable<string> paths)
{
    foreach (var path in paths.Reverse())
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (Exception ex) { Console.Error.WriteLine($"ROLLBACK_ASSET_FAILED|{path}|{ex.Message}"); }
    }
}
static string MediaSourcePath(string root, string path)
{
    var rootPath = Path.GetFullPath(root);
    var value = SourcePath(path);
    var fullPath = Path.GetFullPath(Path.Combine(rootPath, value));
    if (!fullPath.StartsWith(rootPath.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        throw new InvalidDataException($"MEDIA_PATH_ESCAPE|{path}");
    return fullPath;
}
static string SourcePath(string path) { var value = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar); return value.StartsWith("media" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ? value[("media".Length + 1)..] : value; }
static void ValidateAssetSegment(string value, string label)
{
    if (string.IsNullOrWhiteSpace(value) || value is "." or ".." || value.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || value.Contains('/') || value.Contains('\\'))
        throw new InvalidDataException($"ASSET_SEGMENT_INVALID|{label}:{value}");
}
static async Task<Dictionary<string, Guid>> EnsureCategories(QmahDbContext db, IEnumerable<ArtifactRow> rows) { foreach (var x in rows.GroupBy(x => x.CategoryCode)) if (!await db.ArtifactCategories.AnyAsync(c => c.Code == x.Key)) db.ArtifactCategories.Add(new ArtifactCategory { Id = Guid.NewGuid(), Code = x.Key, Name = x.First().CategoryName ?? x.Key }); await db.SaveChangesAsync(); return await db.ArtifactCategories.ToDictionaryAsync(x => x.Code, x => x.Id); }
static async Task<Dictionary<string, Guid>> EnsureEras(QmahDbContext db, IEnumerable<ArtifactRow> rows)
{
    var definitions = EraRegistry.Load();
    foreach (var group in rows.GroupBy(x => x.EraBucketCode, StringComparer.OrdinalIgnoreCase))
    {
        if (!definitions.TryGetValue(group.Key, out var definition))
            throw new InvalidDataException($"ERA_BUCKET_UNKNOWN|{group.Key} 未列入 era-buckets.json，禁止建立未審核年代桶。");
        if (!await db.EraBuckets.AnyAsync(e => e.Code == group.Key))
        {
            var sample = group.First();
            db.EraBuckets.Add(new EraBucket
            {
                Id = Guid.NewGuid(),
                Code = group.Key,
                Name = definition.Name,
                StartYear = sample.EraStartYear ?? definition.StartYear,
                EndYear = sample.EraEndYear ?? definition.EndYear
            });
        }
    }
    await db.SaveChangesAsync();
    return await db.EraBuckets.ToDictionaryAsync(x => x.Code, x => x.Id);
}
static string ApprovalToken(IReadOnlyList<ArtifactRow> artifacts, IReadOnlyList<ProductRow> products, Options options)
{
    var text = string.Join('\n', artifacts.Select(x => $"{x.ArtifactRef}|question:{x.QuestionEnabled}").OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
        + "\n--products--\n" + string.Join('\n', products.Select(x => x.ExternalRef).OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
        + $"\n{options.ArtifactPerCategory}|{options.ProductLimit}";
    return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..16];
}
static class CatalogProfile
{
    public static readonly string[] Codes = ["BRONZE", "CERAMIC", "JADE", "ENAMEL", "LACQUER", "COIN", "CARVING", "PAINTING"];
}
static class EraRegistry
{
    public static IReadOnlyDictionary<string, EraDefinition> Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "era-buckets.json");
        if (!File.Exists(path)) throw new FileNotFoundException("找不到 era-buckets.json，停止匯入。", path);
        var rows = JsonSerializer.Deserialize<List<EraDefinition>>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        return rows.ToDictionary(row => row.Code, StringComparer.OrdinalIgnoreCase);
    }
}
sealed record EraDefinition(string Code, string Name, short? StartYear, short? EndYear);
sealed record AssetPlan(string SourcePath, string TargetPath, string PublicPath);
interface IKeyed { string Key { get; } }
sealed record ArtifactRow(Guid Id, string ArtifactRef, string Name, string CategoryCode, string? CategoryName, string EraBucketCode, string? EraTextOriginal, string? DescriptionOriginal, string SourceUrl, string ImageUrl, string SourcePayloadJson, string NormalizationStatus, bool QuestionEnabled, string? AttributionText, short? EraEndYear, short? EraStartYear, string? LicenseCode, string? SizeOriginal, string? SourceDataset, string ThumbnailUrl) : IKeyed { public string Key => ArtifactRef; }
sealed record ProductRow(Guid Id, string ExternalRef, string Name, string CategoryCode, string? Description, decimal Price, int Stock, string ImageUrl, string? SourceUrl, bool IsActive) : IKeyed { public string Key => ExternalRef; }
sealed record Options(string Project, string Artifacts, string Products, string MediaRoot, string Connection, int ArtifactPerCategory, int ProductLimit, string ApprovalToken, bool Apply, bool Help) { public static Options Parse(string[] a) { string V(string k) { var i = Array.IndexOf(a, k); return i >= 0 && i + 1 < a.Length ? a[i + 1] : ""; } int N(string k, int d) => int.TryParse(V(k), out var n) ? Math.Clamp(n, 1, 100) : d; string P(string k) => string.IsNullOrWhiteSpace(V(k)) ? "" : Path.GetFullPath(V(k)); var help = a.Contains("--help") || a.Length == 0; if (help) return new(".", ".", ".", ".", "", 32, 48, "", false, true); var skipProducts = a.Contains("--skip-products"); return new(Path.GetFullPath(V("--project")), Path.GetFullPath(V("--artifacts")), P("--products"), Path.GetFullPath(V("--media-root")), V("--connection").Length > 0 ? V("--connection") : "Server=(localdb)\\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False", N("--artifact-per-category", 32), skipProducts ? 0 : N("--max-products", 48), V("--approve"), a.Contains("--apply"), false); } }
