using System.IO.Compression;
using System.Text.Json;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.CatalogImport;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
[Authorize(Roles = "Admin")]
[AdminNavigation("文物資料匯入", order: 15)]
public sealed class ImportController(
    CatalogImportService importService,
    IWebHostEnvironment environment,
    NpmOpenDataClient npmOpenDataClient) : Controller
{
    private const long MaxJsonFileBytes = 32L * 1024 * 1024;
    private const long MaxArchiveBytes = 256L * 1024 * 1024;
    private const long MaxExtractedBytes = 512L * 1024 * 1024;
    private const long MaxEntryBytes = 32L * 1024 * 1024;
    private const int MaxArchiveEntries = 10_000;

    private string StagingRoot => Path.Combine(Path.GetTempPath(), "qmah-catalog-import");

    [HttpGet]
    public IActionResult Index() => View(new CatalogImportViewModel());

    [HttpGet]
    public async Task<IActionResult> SourcePreview(
        string? dataset,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dataset))
            return BadRequest(new { title = "缺少資料集", detail = "請先選擇故宮資料集。" });

        try
        {
            var rows = await npmOpenDataClient.GetDatasetAsync(dataset, cancellationToken);
            return Json(new
            {
                dataset,
                categoryName = NpmOpenDataClient.GetDatasetDisplayName(dataset),
                count = rows.Count,
                preview = rows.Take(5).Select(row => new
                {
                    row.Identifier,
                    row.Name,
                    row.Category,
                    row.Era,
                    row.SourceUrl
                })
            });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { title = "資料集無效", detail = exception.Message });
        }
        catch (HttpRequestException)
        {
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new { title = "故宮來源暫時無法連線", detail = "請稍後再試；正式匯入仍須先由資料工具完成正規化與圖片品質檢查。" });
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(MaxArchiveBytes + MaxJsonFileBytes * 2)]
    public async Task<IActionResult> Preview(
        IFormFile? artifactsFile,
        IFormFile? productsFile,
        IFormFile? mediaArchive,
        bool syncShop = false,
        bool syncQuestionBank = true,
        CancellationToken cancellationToken = default)
    {
        if (artifactsFile is null || artifactsFile.Length == 0)
            return InvalidUpload("請選擇 artifacts.import.json。");
        if (!HasExtension(artifactsFile, ".json") || artifactsFile.Length > MaxJsonFileBytes)
            return InvalidUpload("文物資料包必須是 32 MB 以下的 JSON 檔。");
        if (productsFile is not null
            && (productsFile.Length > MaxJsonFileBytes || !HasExtension(productsFile, ".json")))
            return InvalidUpload("商城商品資料包必須是 32 MB 以下的 JSON 檔。");
        if (mediaArchive is not null
            && (mediaArchive.Length > MaxArchiveBytes || !HasExtension(mediaArchive, ".zip")))
            return InvalidUpload("圖片資產包必須是 256 MB 以下的 ZIP 檔。");

        var stageId = Guid.NewGuid().ToString("N");
        var stageDirectory = GetStageDirectory(stageId);
        Directory.CreateDirectory(stageDirectory);
        Directory.CreateDirectory(Path.Combine(stageDirectory, "media"));

        try
        {
            await SaveFileAsync(artifactsFile, Path.Combine(stageDirectory, "artifacts.json"), cancellationToken);
            if (productsFile is not null)
                await SaveFileAsync(productsFile, Path.Combine(stageDirectory, "products.json"), cancellationToken);
            if (mediaArchive is not null)
                await ExtractMediaArchiveAsync(
                    mediaArchive,
                    Path.Combine(stageDirectory, "media"),
                    cancellationToken);

            await SaveStageAsync(
                stageDirectory,
                new ImportStage(syncShop, syncQuestionBank, DateTime.UtcNow),
                cancellationToken);

            var package = await CatalogImportPackage.LoadFilesAsync(
                Path.Combine(stageDirectory, "artifacts.json"),
                productsFile is null ? null : Path.Combine(stageDirectory, "products.json"),
                cancellationToken);
            var request = CreateRequest(stageDirectory, package, syncShop, syncQuestionBank);
            var preview = await importService.PreviewAsync(request, cancellationToken);

            return View("Index", new CatalogImportViewModel
            {
                Preview = preview,
                StageId = stageId,
                ApprovalToken = preview.ApprovalToken
            });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            DeleteStage(stageDirectory);
            throw;
        }
        catch (Exception exception)
        {
            DeleteStage(stageDirectory);
            return View("Index", new CatalogImportViewModel
            {
                ErrorMessage = ToUserMessage(exception)
            });
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Import(
        string? stageId,
        string? approvalToken,
        CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParseExact(stageId, "N", out var parsedStageId)
            || string.IsNullOrWhiteSpace(approvalToken))
        {
            TempData["Error"] = "匯入預檢已失效，請重新上傳資料包。";
            return RedirectToAction(nameof(Index));
        }

        var stageDirectory = GetStageDirectory(parsedStageId.ToString("N"));
        if (!Directory.Exists(stageDirectory))
        {
            TempData["Error"] = "匯入預檢已失效，請重新上傳資料包。";
            return RedirectToAction(nameof(Index));
        }

        try
        {
            var stage = await LoadStageAsync(stageDirectory, cancellationToken);
            var productsPath = System.IO.File.Exists(Path.Combine(stageDirectory, "products.json"))
                ? Path.Combine(stageDirectory, "products.json")
                : null;
            var package = await CatalogImportPackage.LoadFilesAsync(
                Path.Combine(stageDirectory, "artifacts.json"),
                productsPath,
                cancellationToken);
            var request = CreateRequest(
                stageDirectory,
                package,
                stage.SyncShop,
                stage.SyncQuestionBank);
            var result = await importService.ImportAsync(request, approvalToken, cancellationToken);

            TempData["Success"] =
                $"匯入完成：新增 {result.ArtifactCount} 件文物、{result.QuestionEntryCount} 筆題庫入口、{result.ProductCount} 件商城商品。";
            DeleteStage(stageDirectory);
            return RedirectToAction(nameof(Index));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            TempData["Error"] = $"匯入未完成：{ToUserMessage(exception)}";
            return RedirectToAction(nameof(Index));
        }
    }

    private CatalogImportRequest CreateRequest(
        string stageDirectory,
        (IReadOnlyList<CatalogArtifactImportRow> Artifacts, IReadOnlyList<CatalogProductImportRow> Products) package,
        bool syncShop,
        bool syncQuestionBank) => new(
        package.Artifacts,
        package.Products,
        environment.WebRootPath,
        Path.Combine(stageDirectory, "media"),
        syncShop,
        MaxArtifactsPerCategory: 0,
        MaxProducts: 0,
        RequireCompleteProfile: false,
        GenerateProductsFromArtifacts: true,
        SyncQuestionBank: syncQuestionBank);

    private IActionResult InvalidUpload(string message)
    {
        ModelState.AddModelError(string.Empty, message);
        return View("Index", new CatalogImportViewModel { ErrorMessage = message });
    }

    private static string ToUserMessage(Exception exception)
    {
        if (exception is not InvalidDataException)
            return "資料處理失敗，請確認資料包與圖片資產後再試。";

        var message = exception.Message
                    .Replace("ArtifactRef", "故宮編號", StringComparison.OrdinalIgnoreCase)
            .Replace("ExternalRef", "商品編號", StringComparison.OrdinalIgnoreCase)
            .Replace("WebRootPath", "網站資產路徑", StringComparison.OrdinalIgnoreCase)
            .Replace("MediaRootPath", "圖片資產路徑", StringComparison.OrdinalIgnoreCase);

        if (message.Contains("ASSET_SEGMENT_INVALID", StringComparison.OrdinalIgnoreCase)
            || message.Contains("ASSET_TARGET_ESCAPE", StringComparison.OrdinalIgnoreCase)
            || message.Contains("MEDIA_PATH_ESCAPE", StringComparison.OrdinalIgnoreCase))
            return "圖片資產路徑不符合安全規則。";
        if (message.Contains("ASSET_TARGET_DUPLICATE", StringComparison.OrdinalIgnoreCase))
            return "圖片資產對應到重複的儲存位置。";
        if (message.Contains("MEDIA_MISSING", StringComparison.OrdinalIgnoreCase))
            return "找不到資料包指定的圖片資產。";
        if (message.Contains("ASSET_TARGET_EXISTS", StringComparison.OrdinalIgnoreCase))
            return "圖片資產已存在；為避免覆蓋既有檔案，本次匯入已停止。";
        if (message.Contains("ERA_BUCKET_UNKNOWN", StringComparison.OrdinalIgnoreCase))
            return "資料包中的年代無法對應目前的年代規則。";

        var separator = message.IndexOf('|');
        return separator >= 0 ? message[(separator + 1)..] : message;
    }

    private string GetStageDirectory(string stageId)
    {
        var root = Path.GetFullPath(StagingRoot);
        var path = Path.GetFullPath(Path.Combine(root, stageId));
        var prefix = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("匯入暫存路徑無效。");
        return path;
    }

    private static async Task SaveFileAsync(
        IFormFile file,
        string path,
        CancellationToken cancellationToken)
    {
        await using var output = new FileStream(
            path,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            64 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        await file.CopyToAsync(output, cancellationToken);
    }

    private static async Task ExtractMediaArchiveAsync(
        IFormFile archiveFile,
        string mediaRoot,
        CancellationToken cancellationToken)
    {
        var archivePath = Path.Combine(Path.GetTempPath(), $"qmah-media-{Guid.NewGuid():N}.zip");
        try
        {
            await SaveFileAsync(archiveFile, archivePath, cancellationToken);
            using var archive = ZipFile.OpenRead(archivePath);
            if (archive.Entries.Count > MaxArchiveEntries)
                throw new InvalidDataException("圖片資產包的檔案數量超過限制。");

            var root = Path.GetFullPath(mediaRoot)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
            long extractedBytes = 0;
            foreach (var entry in archive.Entries)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (string.IsNullOrWhiteSpace(entry.Name))
                    continue;
                if (entry.Length > MaxEntryBytes || extractedBytes > MaxExtractedBytes - entry.Length)
                    throw new InvalidDataException("圖片資產包的解壓縮大小超過限制。");

                var relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                while (relative.StartsWith(Path.DirectorySeparatorChar))
                    relative = relative[1..];
                if (relative.StartsWith("media" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    relative = relative[("media".Length + 1)..];
                if (relative.Contains(Path.DirectorySeparatorChar + ".." + Path.DirectorySeparatorChar, StringComparison.Ordinal)
                    || relative.Equals("..", StringComparison.Ordinal)
                    || Path.IsPathRooted(relative))
                    throw new InvalidDataException("圖片資產包包含不安全的路徑。");

                var target = Path.GetFullPath(Path.Combine(mediaRoot, relative));
                if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("圖片資產包包含越界路徑。");
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                await using var input = entry.Open();
                await using var output = new FileStream(
                    target,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    64 * 1024,
                    FileOptions.Asynchronous | FileOptions.SequentialScan);
                await input.CopyToAsync(output, cancellationToken);
                extractedBytes += entry.Length;
            }
        }
        finally
        {
            try
            {
                if (System.IO.File.Exists(archivePath))
                    System.IO.File.Delete(archivePath);
            }
            catch
            {
                // 暫存檔清理失敗不覆蓋原始匯入結果。
            }
        }
    }

    private static async Task SaveStageAsync(
        string stageDirectory,
        ImportStage stage,
        CancellationToken cancellationToken) =>
        await System.IO.File.WriteAllTextAsync(
            Path.Combine(stageDirectory, "stage.json"),
            JsonSerializer.Serialize(stage),
            cancellationToken);

    private static async Task<ImportStage> LoadStageAsync(
        string stageDirectory,
        CancellationToken cancellationToken)
    {
        var path = Path.Combine(stageDirectory, "stage.json");
        if (!System.IO.File.Exists(path))
            throw new InvalidDataException("找不到匯入預檢狀態，請重新上傳資料包。");
        var stage = JsonSerializer.Deserialize<ImportStage>(
            await System.IO.File.ReadAllTextAsync(path, cancellationToken));
        if (stage is null || DateTime.UtcNow - stage.CreatedAtUtc > TimeSpan.FromHours(12))
            throw new InvalidDataException("匯入預檢已過期，請重新上傳資料包。");
        return stage;
    }

    private static bool HasExtension(IFormFile file, string extension) =>
        string.Equals(Path.GetExtension(file.FileName), extension, StringComparison.OrdinalIgnoreCase);

    private static void DeleteStage(string path)
    {
        try
        {
            if (Directory.Exists(path))
                Directory.Delete(path, recursive: true);
        }
        catch
        {
            // 暫存檔清理失敗不影響已完成的資料庫交易。
        }
    }

    private sealed record ImportStage(
        bool SyncShop,
        bool SyncQuestionBank,
        DateTime CreatedAtUtc);
}
