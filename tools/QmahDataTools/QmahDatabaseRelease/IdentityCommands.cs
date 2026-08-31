using System.Security.Cryptography;
using System.Text;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.DataTools;

public static class IdentityCommands
{
    private const string DefaultConnection =
        "Server=(localdb)\\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False";

    public static async Task ResetPasswordAsync(
        string connection,
        string email,
        string? requestedPassword,
        string? credentialsPath,
        string? backupPath)
    {
        var normalizedEmail = email.Trim();
        if (!IsValidEmail(normalizedEmail))
        {
            throw new ArgumentException("--email 必須是有效的 Email。", nameof(email));
        }

        await using var provider = BuildIdentityProvider(connection);
        using var scope = provider.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
        var user = await userManager.FindByEmailAsync(normalizedEmail)
            ?? throw new InvalidOperationException($"找不到會員：{normalizedEmail}");

        var generated = string.IsNullOrWhiteSpace(requestedPassword);
        var password = generated ? GeneratePassword() : requestedPassword!;
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"會員密碼重設失敗：{string.Join(", ", result.Errors.Select(error => error.Description))}");
        }

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var credential = await BuildCredentialAsync(userManager, db, user, password);
        UpdateCredentialFiles(credential, credentialsPath, backupPath);

        Console.WriteLine($"PASSWORD_RESET|email:{normalizedEmail}");
        if (generated)
            Console.WriteLine($"NEW_PASSWORD|{password}");
        Console.WriteLine($"CREDENTIALS|{ResolveCredentialsPath(credentialsPath)}");
        Console.WriteLine($"CREDENTIALS_BACKUP|{ResolveBackupPath(backupPath)}");
    }

    public static async Task SeedShowcaseUsersAsync(
        string connection,
        string? credentialsPath,
        string? backupPath)
    {
        await using var provider = BuildIdentityProvider(connection);
        using var scope = provider.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
        await EnsureRoleAsync(roleManager, "Admin");
        await EnsureRoleAsync(roleManager, "User");

        var credentials = new List<DemoCredential>(ShowcaseUsers.Count);
        var generatedPasswords = new HashSet<string>(StringComparer.Ordinal);
        var added = 0;
        var updated = 0;
        var baseDate = DateTime.UtcNow.Date;
        await using var transaction = await db.Database.BeginTransactionAsync();

        foreach (var seed in ShowcaseUsers)
        {
            // 展示帳號固定，密碼則在每次建立快照時重新產生，避免憑證進入版本控制。
            var password = GenerateUniquePassword(generatedPasswords);
            var user = await userManager.FindByEmailAsync(seed.Email);
            if (user is null)
            {
                var createdAt = baseDate.AddDays(-seed.DaysAgo);
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = seed.Email,
                    Email = seed.Email,
                    EmailConfirmed = true,
                    Status = "ACTIVE",
                    CreatedAt = createdAt,
                    UpdatedAt = createdAt
                };
                var createResult = await userManager.CreateAsync(user, password);
                EnsureSucceeded(createResult, $"建立會員 {seed.Email}");
                added++;

                db.UserProfiles.Add(new UserProfile
                {
                    UserId = user.Id,
                    Nickname = seed.DisplayName,
                    Visibility = "PUBLIC",
                    Bio = seed.Bio,
                    CreatedAt = createdAt,
                    UpdatedAt = createdAt
                });
            }
            else
            {
                user.Status = "ACTIVE";
                user.EmailConfirmed = true;
                user.UpdatedAt = DateTime.UtcNow;
                var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                var resetResult = await userManager.ResetPasswordAsync(user, resetToken, password);
                EnsureSucceeded(resetResult, $"更新會員 {seed.Email} 密碼");

                var profile = await db.UserProfiles
                    .SingleOrDefaultAsync(item => item.UserId == user.Id);
                if (profile is null)
                {
                    db.UserProfiles.Add(new UserProfile
                    {
                        UserId = user.Id,
                        Nickname = seed.DisplayName,
                        Visibility = "PUBLIC",
                        Bio = seed.Bio,
                        CreatedAt = user.CreatedAt,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    profile.Nickname = seed.DisplayName;
                    profile.Visibility = "PUBLIC";
                    profile.Bio = seed.Bio;
                    profile.UpdatedAt = DateTime.UtcNow;
                }

                updated++;
            }

            if (!await userManager.IsInRoleAsync(user, seed.Role))
            {
                var roleResult = await userManager.AddToRoleAsync(user, seed.Role);
                EnsureSucceeded(roleResult, $"設定會員 {seed.Email} 角色");
            }

            credentials.Add(new DemoCredential(
                seed.DisplayName,
                user.Email ?? seed.Email,
                password,
                seed.Role));
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        WriteCredentialFiles(credentials, credentialsPath, backupPath);
        Console.WriteLine($"SEEDED_USERS|added:{added}|updated:{updated}|total:{credentials.Count}");
        Console.WriteLine($"CREDENTIALS|{ResolveCredentialsPath(credentialsPath)}");
        Console.WriteLine($"CREDENTIALS_BACKUP|{ResolveBackupPath(backupPath)}");
    }

    private static ServiceProvider BuildIdentityProvider(string connection)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        services.AddDbContext<QmahDbContext>(options => options.UseSqlServer(
            string.IsNullOrWhiteSpace(connection) ? DefaultConnection : connection));
        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Stores.MaxLengthForKeys = 128;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<QmahDbContext>()
            .AddDefaultTokenProviders();
        return services.BuildServiceProvider(validateScopes: true);
    }

    private static async Task EnsureRoleAsync(
        RoleManager<IdentityRole<Guid>> roleManager,
        string role)
    {
        if (await roleManager.RoleExistsAsync(role))
            return;

        var result = await roleManager.CreateAsync(new IdentityRole<Guid>(role));
        EnsureSucceeded(result, $"建立角色 {role}");
    }

    private static void EnsureSucceeded(IdentityResult result, string action)
    {
        if (result.Succeeded)
            return;

        throw new InvalidOperationException(
            $"{action}失敗：{string.Join(", ", result.Errors.Select(error => error.Description))}");
    }

    private static bool IsValidEmail(string email)
    {
        if (email.Length > 254 || !email.Contains('@', StringComparison.Ordinal))
            return false;

        try
        {
            var address = new System.Net.Mail.MailAddress(email);
            return string.Equals(address.Address, email, StringComparison.OrdinalIgnoreCase);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static async Task<DemoCredential> BuildCredentialAsync(
        UserManager<ApplicationUser> userManager,
        QmahDbContext db,
        ApplicationUser user,
        string password)
    {
        var nickname = await db.UserProfiles
            .AsNoTracking()
            .Where(profile => profile.UserId == user.Id)
            .Select(profile => profile.Nickname)
            .SingleOrDefaultAsync() ?? user.UserName ?? user.Email ?? "會員";
        var roles = await userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault(item => item.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            ?? roles.FirstOrDefault()
            ?? "User";
        return new DemoCredential(nickname, user.Email ?? "", password, role);
    }

    private static void UpdateCredentialFiles(
        DemoCredential credential,
        string? credentialsPath,
        string? backupPath)
    {
        var localPath = ResolveCredentialsPath(credentialsPath);
        var backup = ResolveBackupPath(backupPath);
        var credentials = File.Exists(localPath)
            ? ReadCredentialFile(localPath)
            : File.Exists(backup)
                ? ReadCredentialFile(backup)
                : [];
        credentials.RemoveAll(item => item.Email.Equals(credential.Email, StringComparison.OrdinalIgnoreCase));
        credentials.Add(credential);
        WriteCredentialFiles(credentials, localPath, backup);
    }

    private static void WriteCredentialFiles(
        IEnumerable<DemoCredential> credentials,
        string? credentialsPath,
        string? backupPath)
    {
        var ordered = credentials
            .GroupBy(item => item.Email, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .OrderBy(item => item.Email, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var content = new StringBuilder()
            .AppendLine("DisplayName,Email,Password,Role")
            .ToString();
        content += string.Join(
            Environment.NewLine,
            ordered.Select(item => string.Join(
                ',',
                Csv(item.DisplayName),
                Csv(item.Email),
                Csv(item.Password),
                Csv(item.Role))));
        content += Environment.NewLine;

        var localPath = ResolveCredentialsPath(credentialsPath);
        var backup = ResolveBackupPath(backupPath);
        WriteTextAtomically(localPath, content);
        if (!string.Equals(localPath, backup, StringComparison.OrdinalIgnoreCase))
            WriteTextAtomically(backup, content);
    }

    private static List<DemoCredential> ReadCredentialFile(string path) =>
        File.ReadAllLines(path)
            .Skip(1)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(ParseCredentialLine)
            .ToList();

    private static DemoCredential ParseCredentialLine(string line)
    {
        var values = ParseCsv(line);
        if (values.Count != 4)
            throw new InvalidDataException($"Credential CSV 欄位數不正確：{line}");
        return new DemoCredential(values[0], values[1], values[2], values[3]);
    }

    private static List<string> ParseCsv(string line)
    {
        var values = new List<string>();
        var value = new StringBuilder();
        var quoted = false;
        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"')
            {
                if (quoted && index + 1 < line.Length && line[index + 1] == '"')
                {
                    value.Append('"');
                    index++;
                }
                else
                {
                    quoted = !quoted;
                }
            }
            else if (character == ',' && !quoted)
            {
                values.Add(value.ToString());
                value.Clear();
            }
            else
            {
                value.Append(character);
            }
        }

        if (quoted)
            throw new InvalidDataException("Credential CSV 包含未關閉的引號。");
        values.Add(value.ToString());
        return values;
    }

    private static string Csv(string value) =>
        value.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\""
            : value;

    private static void WriteTextAtomically(string path, string content)
    {
        var fullPath = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        var temporary = fullPath + $".{Guid.NewGuid():N}.tmp";
        File.WriteAllText(temporary, content, new UTF8Encoding(false));
        File.Move(temporary, fullPath, overwrite: true);
    }

    private static string ResolveCredentialsPath(string? path) =>
        Path.GetFullPath(string.IsNullOrWhiteSpace(path)
            ? Path.Combine(Directory.GetCurrentDirectory(), "QMAH.DemoCredentials.local.csv")
            : path);

    private static string ResolveBackupPath(string? path)
    {
        if (!string.IsNullOrWhiteSpace(path))
            return Path.GetFullPath(path);

        var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        if (string.IsNullOrWhiteSpace(documents))
            throw new InvalidOperationException("找不到 Windows Documents 資料夾，無法建立帳密備份。");
        return Path.Combine(documents, "QMAH", "QMAH.DemoCredentials.csv");
    }

    private static string GeneratePassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "!#$%+-_";
        var characters = new List<char>
        {
            Pick(upper),
            Pick(lower),
            Pick(digits),
            Pick(symbols)
        };
        var all = upper + lower + digits + symbols;
        while (characters.Count < 16)
            characters.Add(Pick(all));
        for (var index = characters.Count - 1; index > 0; index--)
        {
            var swap = RandomNumberGenerator.GetInt32(index + 1);
            (characters[index], characters[swap]) = (characters[swap], characters[index]);
        }
        return new string(characters.ToArray());

        static char Pick(string source) => source[RandomNumberGenerator.GetInt32(source.Length)];
    }

    private static string GenerateUniquePassword(ISet<string> generatedPasswords)
    {
        string password;
        do
        {
            password = GeneratePassword();
        }
        while (!generatedPasswords.Add(password));

        return password;
    }

    private sealed record DemoCredential(string DisplayName, string Email, string Password, string Role);

    private sealed record ShowcaseUserSeed(
        string DisplayName,
        string Email,
        string Role,
        int DaysAgo,
        string Bio);

    private static readonly IReadOnlyList<ShowcaseUserSeed> ShowcaseUsers =
    [
        new("Demo Admin", "admin@qmah.local", "Admin", 120, "負責整理專題展示環境與後台資料。"),
        new("Demo Member 01", "user@qmah.local", "User", 95, "喜歡從器形與材質開始認識文物。"),
        new("Demo Catalog", "catalog@qmah.local", "User", 88, "整理館藏資料，也歡迎分享不同角度的觀察。"),
        new("Demo Game Host", "game@qmah.local", "User", 78, "把每一回合的鑑定遊戲整理成容易回看的紀錄。"),
        new("Demo Social Editor", "social@qmah.local", "User", 70, "協助大家找到適合交流的主題與活動。"),
        new("Demo Store Editor", "store@qmah.local", "User", 64, "維護展示商品、庫存與訂單狀態。"),
        new("Demo Player 01", "player-a@qmah.local", "User", 52, "把每次遊戲都當成一次觀察練習。"),
        new("Demo Player 02", "player-b@qmah.local", "User", 44, "記錄在博物館裡遇到的細節。"),
        new("Demo Member 03", "demo.member03@qmah.test", "User", 42, "喜歡比較不同時代的釉色與器形。"),
        new("Demo Member 04", "demo.member04@qmah.test", "User", 38, "週末會把看展時記下的問題整理成筆記。"),
        new("Demo Member 05", "demo.member05@qmah.test", "User", 35, "對玉器與小型配件的工藝特別有興趣。"),
        new("Demo Member 06", "demo.member06@qmah.test", "User", 31, "正在練習從紋飾判斷作品可能的時代。"),
        new("Demo Member 07", "demo.member07@qmah.test", "User", 28, "喜歡把展場導覽內容和圖鑑資料交叉閱讀。"),
        new("Demo Member 08", "demo.member08@qmah.test", "User", 24, "最近開始收集自己看過的陶瓷作品。"),
        new("Demo Member 09", "demo.member09@qmah.test", "User", 21, "會先看尺寸與材質，再回頭讀完整說明。"),
        new("Demo Member 10", "demo.member10@qmah.test", "User", 18, "喜歡和朋友一起參加線上文物活動。"),
        new("Demo Member 11", "demo.member11@qmah.test", "User", 15, "把每次猜錯的題目當成下一次查資料的入口。"),
        new("Demo Member 12", "demo.member12@qmah.test", "User", 12, "對畫作中的人物配置與留白很有感覺。"),
        new("Demo Member 13", "demo.member13@qmah.test", "User", 10, "會把有趣的故宮編號記在自己的清單裡。"),
        new("Demo Member 14", "demo.member14@qmah.test", "User", 8, "喜歡在活動留言中交換看展路線。"),
        new("Demo Member 15", "demo.member15@qmah.test", "User", 6, "剛開始接觸故宮開放資料與圖像授權。"),
        new("Demo Member 16", "demo.member16@qmah.test", "User", 4, "喜歡研究不同材質在光線下的差異。"),
        new("Demo Member 17", "demo.member17@qmah.test", "User", 2, "期待在遊戲房間裡認識更多同好。"),
        new("Demo Member 18", "demo.member18@qmah.test", "User", 1, "把第一次參與的活動心得留在社群裡。")
    ];
}
