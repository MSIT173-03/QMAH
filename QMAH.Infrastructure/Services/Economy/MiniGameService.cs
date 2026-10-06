using System.Data;
using System.Text.Json;

using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Economy;

/// <summary>
/// 提供四種 Mini Game 共用的開始、驗證、評分與獎勵流程。
/// </summary>
/// <remarks>
/// MiniGameController 是目前的 HTTP 入口，EconomyService 提供共用經濟設定與資產規則。
/// 新增玩法通常只需新增 GameModeDefinition 與對應的結果驗證／計分策略；Attempt、每日獎勵上限與流水仍沿用此流程。
/// </remarks>
public sealed class MiniGameService(QmahDbContext db, EconomyService economyService, ScrollPaintingEligibility scrollPaintingEligibility, GameDailyRewardService dailyRewards)
{
    private readonly LocatorSubjectFinder subjectFinder = new(scrollPaintingEligibility);
    private readonly GameImageAnalyzer imageAnalyzer = new(scrollPaintingEligibility);
    private const int PuzzlePieceCount = 25;
    private const int EasyMaxScore = 80;

    private static string VariantSuffix(string modeCode, string? variant)
    {
        var hard = string.Equals(variant?.Trim(), "HARD", StringComparison.OrdinalIgnoreCase)
            || string.Equals(variant?.Trim(), "MEMORY", StringComparison.OrdinalIgnoreCase);
        return modeCode == "ARTIFACT_PUZZLE" ? (hard ? "-m" : "-r") : hard ? "-h" : "-e";
    }

    private static bool IsEasy(string seed, string modeCode)
        => seed.EndsWith("-e", StringComparison.Ordinal) || seed.EndsWith("-r", StringComparison.Ordinal)
            || modeCode == "ARTIFACT_PUZZLE" && !seed.EndsWith("-m", StringComparison.Ordinal);
    private const int RestorePieceCount = 15;
    private const int StandardMemoryPairCount = 8;
    public Task<bool> CanResumeAsync(Guid userId, Guid attemptId, CancellationToken cancellationToken = default)
        => db.MiniGameAttempts.AsNoTracking().AnyAsync(item => item.UserId == userId && item.Id == attemptId
            && item.Status == "STARTED", cancellationToken);

    public async Task<MiniGameRewardStatusView> GetRewardStatusAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await dailyRewards.GetStatusAsync(userId, cancellationToken);
    }

    /// <summary>取得所有啟用中的 Mini Game 模式及其評分門檻。</summary>
    public async Task<IReadOnlyList<MiniGameModeView>> GetModesAsync(
        CancellationToken cancellationToken = default)
    {
        var modes = await db.GameModeDefinitions
            .AsNoTracking()
            .Where(mode => mode.IsActive)
            .OrderBy(mode => mode.Code)
            .ToListAsync(cancellationToken);
        return modes.Select(ToModeView).ToList();
    }

    /// <summary>由伺服器選擇文物、素材池、難度與種子，建立一筆尚未完成的 Attempt。</summary>
    public async Task<EconomyResult<MiniGameStartView>> StartAttemptAsync(
        Guid userId,
        string modeCode,
        string? variant,
        CancellationToken cancellationToken = default)
    {
        modeCode = modeCode.Trim().ToUpperInvariant();
        var mode = await db.GameModeDefinitions
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Code == modeCode && item.IsActive, cancellationToken);
        if (mode is null)
            return EconomyResult<MiniGameStartView>.NotFound("找不到啟用中的 Mini Game 模式。");

        var artifacts = await db.Artifacts
            .AsNoTracking()
            .Where(artifact => artifact.IsActive && artifact.PrimaryImagePath != "")
            .Where(artifact => modeCode != "STRIP_RESTORE" || artifact.Category.Code == "PAINTING")
            .Where(artifact => modeCode != "ARTIFACT_PUZZLE" || artifact.Category.Code != "PAINTING")
            .OrderBy(artifact => artifact.Id)
            .Select(artifact => new ArtifactMaterialView(
                artifact.Id,
                artifact.Name,
                artifact.PrimaryImagePath,
                artifact.ThumbnailPath,
                artifact.CategoryId,
                artifact.EraBucketId,
                artifact.Category.Code))
            .ToListAsync(cancellationToken);
        if (string.Equals(mode.Code, "STRIP_RESTORE", StringComparison.OrdinalIgnoreCase))
        {
            // 長卷復位只取書畫素材，避免把瓷器或單件器物切成長卷題目。
            artifacts = artifacts.Where(item => item.CategoryCode == "PAINTING"
                && scrollPaintingEligibility.IsEligible(item.PrimaryImagePath)).ToList();
        }
        if (artifacts.Count == 0)
            return EconomyResult<MiniGameStartView>.Conflict("目前沒有符合此玩法且具有圖片的啟用文物。");

        if (mode.Code == "DETAIL_LOCATOR")
        {
            // 定位題需要可辨識的原圖，沿用尺寸與比例限制，排除超長卷及過小圖片。
            artifacts = artifacts.Where(item => scrollPaintingEligibility.IsEligible(item.PrimaryImagePath)).ToList();
        }
        if (mode.Code == "MEMORY_MATCH")
        {
            // 翻牌的牌面很小，比例差太多（長卷、細長條）看不出差異；優先取接近方形或直式的圖，不夠八件再放寬。
            double Ratio(ArtifactMaterialView item) { var d = scrollPaintingEligibility.ImageDimensions(item.PrimaryImagePath); return d.Height > 0 ? (double)d.Width / d.Height : 0; }
            var measured = artifacts.Select(item => (item, ratio: Ratio(item))).ToList();
            foreach (var (low, high) in new[] { (0.75, 1.34), (0.6, 1.6), (0.5, 1.8) })
            {
                var fit = measured.Where(x => x.ratio >= low && x.ratio <= high).Select(x => x.item).ToList();
                if (fit.Count >= StandardMemoryPairCount) { artifacts = fit; break; }
            }
        }
        var isDetailLocator = string.Equals(mode.Code, "DETAIL_LOCATOR", StringComparison.OrdinalIgnoreCase);
        if (isDetailLocator && artifacts.Count < 4)
            return EconomyResult<MiniGameStartView>.Conflict("細節追跡至少需要四件具有圖片的啟用文物，才能完成一局定位。");

        var configuredPoolSize = ReadConfigInt(mode.ConfigJson, "poolSize") ?? 1;
        var minimumPoolSize = string.Equals(mode.Code, "MEMORY_MATCH", StringComparison.OrdinalIgnoreCase)
            ? StandardMemoryPairCount
            : 1;
        List<ArtifactMaterialView> pool;
        ArtifactMaterialView selected;
        if (isDetailLocator)
        {
            // 每件各定位一處細節；素材池保存出題順序，無需存放額外題目資料。
            pool = artifacts.OrderBy(_ => Random.Shared.Next()).Where(item => subjectFinder.HasDetail(item.PrimaryImagePath)).Take(4).ToList();
            if (pool.Count < 4) return EconomyResult<MiniGameStartView>.Conflict("目前沒有足夠清晰、具有可辨識細節的圖片，請稍後再試。");
            selected = pool[0];
        }
        else
        {
            var poolSize = Math.Clamp(Math.Max(configuredPoolSize, minimumPoolSize), 1, artifacts.Count);
            pool = artifacts
                .OrderBy(_ => Random.Shared.Next())
                .Take(poolSize)
                .ToList();
            selected = pool[Random.Shared.Next(pool.Count)];
        }
        var now = DateTime.UtcNow;
        var attempt = new MiniGameAttempt
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            GameModeDefinitionId = mode.Id,
            ArtifactId = selected.Id,
            ArtifactPoolJson = JsonSerializer.Serialize(pool.Select(item => item.Id)),
            Difficulty = ReadConfigString(mode.ConfigJson, "difficulty") ?? "NORMAL",
            // 難度記在 Seed 尾端：困難 -h（拼圖為 -m 只看十秒）、簡單 -e（拼圖為 -r 隨時看原圖，沒有尾碼的舊拼圖視為 -r）。簡單分數上限較低。
            Seed = (isDetailLocator ? "v6-" : "v3-") + Guid.NewGuid().ToString("N")
                + VariantSuffix(mode.Code, variant),
            ConfigJson = mode.ConfigJson,
            Status = "STARTED",
            StartedAt = now
        };
        db.MiniGameAttempts.Add(attempt);
        await db.SaveChangesAsync(cancellationToken);

        return EconomyResult<MiniGameStartView>.Success(new MiniGameStartView(
            attempt.Id,
            mode.Code,
            mode.Name,
            selected.Id,
            selected.Name,
            selected.PrimaryImagePath,
            selected.ThumbnailPath,
            pool.Select(item => new MiniGameArtifactView(
                item.Id,
                item.Name,
                item.PrimaryImagePath,
                item.ThumbnailPath)).ToList(),
            attempt.Difficulty,
            attempt.Seed,
            attempt.ConfigJson,
            attempt.StartedAt,
            isDetailLocator ? pool.Select(item => { var point = subjectFinder.Target(attempt.Seed, item.Id, item.PrimaryImagePath); return new MiniGameLocatorTarget(item.Id, point.X, point.Y); }).ToList() : null,
            mode.Code == "ARTIFACT_PUZZLE" ? imageAnalyzer.BackgroundPieces(selected.PrimaryImagePath) : null));
    }

    /// <summary>驗證玩家原始分數並由伺服器計算等級、點數、鑰匙進度與每日獎勵資格。</summary>
    public async Task<EconomyResult<MiniGameCompleteView>> CompleteAttemptAsync(
        Guid userId,
        Guid attemptId,
        int rawScore,
        string? rawResultJson,
        CancellationToken cancellationToken = default)
    {
        // 整筆交易一起重試；清除失敗嘗試的追蹤狀態，再依 Attempt 是否已完成判斷是否曾成功提交。
        // 已完成分支只讀取既有獎勵，不會再次發放。
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async retryCancellationToken =>
        {
            db.ChangeTracker.Clear();
            return await CompleteAttemptCoreAsync(userId, attemptId, rawScore, rawResultJson, retryCancellationToken);
        }, cancellationToken);
    }

    private async Task<EconomyResult<MiniGameCompleteView>> CompleteAttemptCoreAsync(
        Guid userId,
        Guid attemptId,
        int rawScore,
        string? rawResultJson,
        CancellationToken cancellationToken)
    {
        if (rawScore is < 0 or > 100)
            return EconomyResult<MiniGameCompleteView>.Invalid("rawScore 必須介於 0 至 100。分數由伺服器重新驗證。");
        JsonDocument? parsedResult = null;
        if (!string.IsNullOrWhiteSpace(rawResultJson))
        {
            if (rawResultJson.Length > 4000)
                return EconomyResult<MiniGameCompleteView>.Invalid("rawResultJson 不可超過 4000 個字元。");
            try
            {
                parsedResult = JsonDocument.Parse(rawResultJson);
                if (parsedResult.RootElement.ValueKind != JsonValueKind.Object)
                {
                    parsedResult.Dispose();
                    return EconomyResult<MiniGameCompleteView>.Invalid("rawResultJson 必須是 JSON 物件。");
                }
            }
            catch (JsonException)
            {
                return EconomyResult<MiniGameCompleteView>.Invalid("rawResultJson 不是有效的 JSON。");
            }
        }

        // 同一份結果供版本、盤面與輔助評分使用，重送仍沿用既有結算。
        using var resultDocument = parsedResult;
        var result = resultDocument?.RootElement ?? default;

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var attempt = await db.MiniGameAttempts
            .Include(item => item.GameModeDefinition)
            .SingleOrDefaultAsync(
                item => item.Id == attemptId && item.UserId == userId,
                cancellationToken);
        if (attempt is null)
            return EconomyResult<MiniGameCompleteView>.NotFound("找不到目前會員的 Mini Game Attempt。");
        if (attempt.Status == "COMPLETED")
        {
            // 網路重送時回傳既有成績並標示已完成；這個分支不再次寫入獎勵或流水。
            var currentProgress = await db.KeyProgressBalances
                .AsNoTracking()
                .Where(item => item.UserId == userId)
                .Select(item => (decimal?)item.Balance)
                .SingleOrDefaultAsync(cancellationToken) ?? 0;
            await transaction.CommitAsync(cancellationToken);
            return EconomyResult<MiniGameCompleteView>.Success(ToCompleteView(attempt, currentProgress, true));
        }
        if (attempt.Status != "STARTED")
            return EconomyResult<MiniGameCompleteView>.Conflict("這個 Attempt 目前不可完成。");

        var mode = attempt.GameModeDefinition;
        if (attempt.Seed.StartsWith("v3-", StringComparison.Ordinal)
            && (result.ValueKind != JsonValueKind.Object
                || !TryGetInt(result, "scoringVersion", out var version)
                || version != 3 && !(mode.Code == "DETAIL_LOCATOR" && version == 4)))
            return EconomyResult<MiniGameCompleteView>.Invalid("本局需要目前版本的評分資料，請重新整理後再送出。");
        var locatorSizes = new Dictionary<Guid, (int Width, int Height)>();
        var locatorTargets = new Dictionary<Guid, (double X, double Y)>();
        if (mode.Code == "DETAIL_LOCATOR" && TryGetInt(result, "scoringVersion", out var locatorVersion) && locatorVersion == 4)
        {
            if (!TryReadArtifactPool(attempt.ArtifactPoolJson, out var locatorPool))
                return EconomyResult<MiniGameCompleteView>.Invalid("本局文物素材池資料無效。");
            var images = await db.Artifacts.AsNoTracking().Where(item => locatorPool.Contains(item.Id))
                .Select(item => new { item.Id, item.PrimaryImagePath }).ToListAsync(cancellationToken);
            foreach (var image in images)
            {
                locatorSizes[image.Id] = scrollPaintingEligibility.ImageDimensions(image.PrimaryImagePath);
                if (attempt.Seed.StartsWith("v5-", StringComparison.Ordinal) || attempt.Seed.StartsWith("v6-", StringComparison.Ordinal)) locatorTargets[image.Id] = subjectFinder.Target(attempt.Seed, image.Id, image.PrimaryImagePath);
            }
        }
        if (!TryCalculateVerifiedScore(attempt, mode, rawScore, result, locatorSizes, locatorTargets, out var verifiedRawScore, out var scoreError))
            return EconomyResult<MiniGameCompleteView>.Invalid(scoreError!);
        rawScore = verifiedRawScore;
        if (mode.GradeBThreshold < 0
            || mode.GradeAThreshold < mode.GradeBThreshold
            || mode.GradeSThreshold < mode.GradeAThreshold
            || mode.GradeSThreshold > 100)
        {
            return EconomyResult<MiniGameCompleteView>.Conflict("Mini Game 模式的評分設定無效，請先由管理員修正。");
        }

        var normalizedScore = rawScore;
        if (mode.Code is "ARTIFACT_PUZZLE" or "STRIP_RESTORE")
        {
            var pieces = mode.Code == "ARTIFACT_PUZZLE" ? PuzzlePieceCount : RestorePieceCount;
            var wallSeconds = Math.Max(0, (DateTime.UtcNow - attempt.StartedAt).TotalSeconds);
            if (TryGetInt(result, "scoringVersion", out var scoringVersion) && scoringVersion is 2 or 3)
            {
                if (!TryGetInt(result, "elapsedSeconds", out var elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > wallSeconds + 10
                    || !TryGetInt(result, "moves", out var moves) || moves is < 0 or > 100000
                    || !TryGetInt(result, "hintsUsed", out var hints) || hints is < 0 or > 100000
                    || !TryGetInt(result, "autoPlaced", out var autoPlaced) || autoPlaced < 0 || autoPlaced > pieces)
                    return EconomyResult<MiniGameCompleteView>.Invalid("用時、放置次數或輔助紀錄無效，請保留盤面並重新送出。");
                // 操作與輔助數據由客戶端回報，這是評分規則，不代表完整防作弊驗證。
                // 書畫滑拼要滑很多次，寬限的次數與時間比拼圖寬鬆。
                normalizedScore = mode.Code == "STRIP_RESTORE"
                    ? MiniGamePlacementScoring.Calculate(rawScore, pieces, elapsedSeconds, moves, hints, autoPlaced, mode.GradeAThreshold, IsEasy(attempt.Seed, mode.Code) ? 100 : 60, IsEasy(attempt.Seed, mode.Code) ? 600 : 420)
                    : MiniGamePlacementScoring.Calculate(rawScore, pieces, elapsedSeconds, moves, hints, autoPlaced, mode.GradeAThreshold);
            }
            else
            {
                // 舊版仍可送出盤面，但缺少表現紀錄時不把「完成」直接認定為 S 級。
                normalizedScore = Math.Min(rawScore, Math.Max(0, mode.GradeAThreshold - 1));
            }
        }

        if (mode.Code is "MEMORY_MATCH" or "DETAIL_LOCATOR")
        {
            if (TryGetInt(result, "scoringVersion", out var scoringVersion)
                && (scoringVersion == 3 || mode.Code == "DETAIL_LOCATOR" && scoringVersion == 4))
            {
                var units = TryReadArtifactPool(attempt.ArtifactPoolJson, out var pool)
                    ? mode.Code == "MEMORY_MATCH" ? Math.Min(pool.Count, StandardMemoryPairCount) : scoringVersion == 4 ? pool.Count : 1
                    : 1;
                if (!TryGetInt(result, "hintsUsed", out var hints) || hints < 0 || hints > (mode.Code == "MEMORY_MATCH" || scoringVersion == 4 ? units : 2)
                    || !TryGetInt(result, "autoPlaced", out var assisted) || assisted < 0 || assisted > units)
                    return EconomyResult<MiniGameCompleteView>.Invalid("求救紀錄無效，請保留進度並重新送出。");
                normalizedScore = MiniGamePlacementScoring.CalculateAssistance(rawScore, units, hints, assisted, mode.Code == "DETAIL_LOCATOR" ? 10 : 3, mode.GradeAThreshold);
            }
        }

        if (IsEasy(attempt.Seed, mode.Code))
            normalizedScore = Math.Min(normalizedScore, EasyMaxScore);

        // 沒有實際操作（例如一開局就請系統代完成後等著領獎）不給獎勵，也不算入每日突破的評級。
        var meaningfulPlay = HasMeaningfulPlay(attempt, mode, result);
        if (!meaningfulPlay) normalizedScore = 0;
        var grade = normalizedScore >= mode.GradeSThreshold
            ? "S"
            : normalizedScore >= mode.GradeAThreshold
                ? "A"
                : normalizedScore >= mode.GradeBThreshold
                    ? "B"
                    : normalizedScore > 0 ? "C" : "FAIL";
        var (pointReward, keyProgressReward) = grade switch
        {
            "S" => (mode.SPointReward, mode.SKeyProgressReward),
            "A" => (mode.APointReward, mode.AKeyProgressReward),
            "B" => (mode.BPointReward, mode.BKeyProgressReward),
            _ => (mode.FailPointReward, mode.FailKeyProgressReward)
        };
        if (pointReward < 0 || keyProgressReward < 0)
            return EconomyResult<MiniGameCompleteView>.Conflict("Mini Game 獎勵設定不可為負數。");
        (pointReward, keyProgressReward) = meaningfulPlay
            ? MiniGameCompletionReward.Apply(grade, pointReward, keyProgressReward)
            : (0, 0);

        var setting = await economyService.GetGameEconomySettingAsync(cancellationToken);
        if (setting.DailyMiniGameRewardLimit < 0 || setting.KeyProgressToNormalKey <= 0)
            return EconomyResult<MiniGameCompleteView>.Conflict("Mini Game 每日獎勵或進度門檻設定無效。");
        var utcDate = DateTime.UtcNow.AddHours(8).Date.AddHours(-8);
        var nextUtcDate = utcDate.AddDays(1);
        var rewardedToday = await db.MiniGameAttempts
            .CountAsync(item => item.UserId == userId
                && item.Status == "COMPLETED"
                && item.RewardGranted
                && item.CompletedAt >= utcDate
                && item.CompletedAt < nextUtcDate,
                cancellationToken);
        // 改按每日共用點數預算計算，鑰匙進度不受點數預算影響。
        pointReward = await dailyRewards.LimitPointsAsync(userId, pointReward, cancellationToken);
        var hasEconomicReward = meaningfulPlay;

        var now = DateTime.UtcNow;
        if (hasEconomicReward && pointReward > 0)
        {
            var pointBalance = await GetOrCreatePointBalanceAsync(userId, cancellationToken);
            pointBalance.Balance = checked(pointBalance.Balance + pointReward);
            pointBalance.UpdatedAt = now;
            db.PointTransactions.Add(new PointTransaction
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Amount = pointReward,
                Reason = $"Mini Game {mode.Name} {grade} 評分獎勵",
                ReferenceType = "MINIGAME_REWARD",
                ReferenceId = attempt.Id,
                CreatedAt = now
            });
        }
        var keyPolicy = await dailyRewards.GetKeyPolicyAsync(userId, cancellationToken);
        var adjustedProgress = keyProgressReward / (decimal)keyPolicy.Divisor;
        var grant = await economyService.GrantGameKeyProgressAsync(userId, adjustedProgress,
            setting.KeyProgressToNormalKey, "MINIGAME_REWARD", "MINIGAME_PROGRESS_CONVERSION", attempt.Id, cancellationToken);
        if (!grant.Succeeded)
            return EconomyResult<MiniGameCompleteView>.Conflict(grant.ErrorMessage!);
        var convertedNormalKeys = grant.Value!.NormalKeys;
        var remainingProgress = grant.Value.RemainingProgress;
        attempt.Status = "COMPLETED";
        attempt.RawScore = rawScore;
        attempt.RawResultJson = rawResultJson;
        attempt.NormalizedScore = normalizedScore;
        attempt.Grade = grade;
        attempt.PointReward = pointReward;
        attempt.KeyProgressReward = grant.Value.GrantedProgress;
        attempt.KeyRewardDivisor = keyPolicy.Divisor;
        attempt.ConvertedNormalKeys = convertedNormalKeys;
        attempt.RewardAttemptNo = hasEconomicReward ? rewardedToday + 1 : null;
        attempt.RewardGranted = hasEconomicReward;
        attempt.CompletedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return EconomyResult<MiniGameCompleteView>.Success(new MiniGameCompleteView(
            attempt.Id,
            mode.Code,
            rawScore,
            normalizedScore,
            grade,
            pointReward,
            grant.Value.GrantedProgress,
            convertedNormalKeys,
            remainingProgress,
            hasEconomicReward,
            false,
            attempt.CompletedAt.Value, attempt.KeyRewardDivisor));
    }

    private static MiniGameModeView ToModeView(GameModeDefinition mode) => new(
        mode.Id,
        mode.Code,
        mode.Name,
        mode.Code switch
        {
            "ARTIFACT_PUZZLE" => "把備選區的 25 塊碎片拖到目標格，接回文物原貌。開始前選困難（只先看 10 秒原圖，滿分 100 分）或簡單（空格上直接對照原圖，最高 80 分）。困難可用區域提示，兩種都能扣分請系統代放剩餘碎片。",
            "STRIP_RESTORE" => "15 片書畫碎片拼回原本的畫面。簡單點兩片相鄰碎片交換，困難少一格，把碎片滑進空格。",
            _ => mode.Description
        },
        mode.ConfigJson,
        mode.GradeBThreshold,
        mode.GradeAThreshold,
        mode.GradeSThreshold);

    private static MiniGameCompleteView ToCompleteView(
        MiniGameAttempt attempt,
        decimal remainingKeyProgress,
        bool alreadyCompleted) => new(
        attempt.Id,
        attempt.GameModeDefinition.Code,
        attempt.RawScore ?? 0,
        attempt.NormalizedScore ?? 0,
        attempt.Grade ?? "FAIL",
        attempt.PointReward,
        attempt.KeyProgressReward,
        attempt.ConvertedNormalKeys,
        remainingKeyProgress,
        attempt.RewardGranted,
        alreadyCompleted,
        attempt.CompletedAt ?? attempt.StartedAt, attempt.KeyRewardDivisor);

    private async Task<UserKeyBalance> GetOrCreateKeyBalanceAsync(
        Guid userId,
        Guid keyDefinitionId,
        CancellationToken cancellationToken)
    {
        var balance = await db.UserKeyBalances
            .SingleOrDefaultAsync(item => item.UserId == userId && item.KeyDefinitionId == keyDefinitionId, cancellationToken);
        if (balance is not null)
            return balance;
        balance = new UserKeyBalance
        {
            UserId = userId,
            KeyDefinitionId = keyDefinitionId,
            Balance = 0,
            UpdatedAt = DateTime.UtcNow
        };
        db.UserKeyBalances.Add(balance);
        return balance;
    }

    private async Task<PointBalance> GetOrCreatePointBalanceAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var balance = await db.PointBalances
            .SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        if (balance is not null)
            return balance;
        balance = new PointBalance
        {
            UserId = userId,
            Balance = 0,
            UpdatedAt = DateTime.UtcNow
        };
        db.PointBalances.Add(balance);
        return balance;
    }

    private async Task<KeyProgressBalance> GetOrCreateProgressBalanceAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var balance = await db.KeyProgressBalances
            .SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        if (balance is not null)
            return balance;
        balance = new KeyProgressBalance
        {
            UserId = userId,
            Balance = 0,
            UpdatedAt = DateTime.UtcNow
        };
        db.KeyProgressBalances.Add(balance);
        return balance;
    }

    private static int? ReadConfigInt(string? json, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty(propertyName, out var value)
                && value.ValueKind == JsonValueKind.Number
                && value.TryGetInt32(out var parsed)
                ? parsed
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ReadConfigString(string? json, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty(propertyName, out var value)
                && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool TryCalculateVerifiedScore(
        MiniGameAttempt attempt,
        GameModeDefinition mode,
        int submittedScore,
        JsonElement result,
        IReadOnlyDictionary<Guid, (int Width, int Height)> locatorSizes,
        IReadOnlyDictionary<Guid, (double X, double Y)> locatorTargets,
        out int verifiedScore,
        out string? error)
    {
        // ponytail: 只驗證最終盤面，先堵住客戶端直接改分數的缺口；不記錄操作序列。
        verifiedScore = 0;
        error = null;
        if (result.ValueKind != JsonValueKind.Object)
        {
            error = "rawResultJson 必須是 JSON 物件。";
            return false;
        }

        if (!TryGetString(result, "modeCode", out var resultMode)
            || !string.Equals(resultMode, mode.Code, StringComparison.OrdinalIgnoreCase))
        {
            error = "遊戲結果的 modeCode 與 Attempt 不一致。";
            return false;
        }

        if (attempt.ArtifactId is not Guid artifactId
            || !TryGetGuid(result, "artifactId", out var resultArtifactId)
            || resultArtifactId != artifactId)
        {
            error = "遊戲結果的 artifactId 與 Attempt 不一致。";
            return false;
        }

        if (!TryReadArtifactPool(attempt.ArtifactPoolJson, out var artifactPool)
            || !artifactPool.Contains(artifactId))
        {
            error = "Attempt 的文物素材池資料無效。";
            return false;
        }

        var calculatedScore = mode.Code switch
        {
            "DETAIL_LOCATOR" => CalculateLocatorScore(result, artifactPool, artifactId, attempt.Seed, locatorSizes, locatorTargets, out error),
            "MEMORY_MATCH" => CalculateMemoryScore(result, artifactPool.Count, out error),
            "ARTIFACT_PUZZLE" => CalculateOrderScore(result, "puzzleOrder", PuzzlePieceCount, out error),
            "STRIP_RESTORE" => CalculateOrderScore(result, "restoreOrder", RestorePieceCount, out error),
            _ => InvalidScore("目前沒有這個 Mini Game 模式的結果驗證規則。", out error)
        };
        if (calculatedScore < 0)
            return false;
        if (submittedScore != calculatedScore)
        {
            error = $"rawScore 與伺服器計算結果不一致（應為 {calculatedScore}）。";
            return false;
        }

        verifiedScore = calculatedScore;
        return true;
    }

    private static int CalculateLocatorScore(
        JsonElement result,
        IReadOnlyCollection<Guid> artifactPool,
        Guid artifactId,
        string seed,
        IReadOnlyDictionary<Guid, (int Width, int Height)> locatorSizes,
        IReadOnlyDictionary<Guid, (double X, double Y)> locatorTargets,
        out string? error)
    {
        error = null;
        if (TryGetInt(result, "scoringVersion", out var version) && version == 4)
            return MiniGameDetailLocatorScoring.Calculate(result, artifactPool, seed, locatorSizes, out error, locatorTargets);
        if (seed.StartsWith("v4-", StringComparison.Ordinal) || seed.StartsWith("v5-", StringComparison.Ordinal) || seed.StartsWith("v6-", StringComparison.Ordinal))
            return InvalidScore("這輪細節追跡必須使用原圖定位，請重新載入遊戲。", out error);
        // 已送出但等待重試的舊版結果仍可完成，不將新題目降回四選一。
        if (!TryGetGuid(result, "locatorChoice", out var choice) || !artifactPool.Contains(choice))
            return InvalidScore("locatorChoice 必須是素材池中的文物。", out error);
        return choice == artifactId ? 100 : 25;
    }

    private static int CalculateMemoryScore(
        JsonElement result,
        int artifactPoolCount,
        out string? error)
    {
        error = null;
        var expectedPairs = Math.Min(artifactPoolCount, StandardMemoryPairCount);
        if (!TryGetInt(result, "memoryPairs", out var submittedPairs)
            || submittedPairs != expectedPairs
            || !TryGetInt(result, "memoryMatched", out var matched)
            || matched is < 0 || matched > expectedPairs
            || expectedPairs == 0)
        {
            return InvalidScore("memoryPairs 或 memoryMatched 不符合這次 Attempt。", out error);
        }
        return (int)Math.Round(matched * 100d / expectedPairs, MidpointRounding.AwayFromZero);
    }

    private static int CalculateOrderScore(JsonElement result, string propertyName, int expectedCount, out string? error)
    {
        error = null;
        if (!TryGetIntArray(result, propertyName, out var order)
            || order.Length != expectedCount
            || order.Distinct().Count() != expectedCount
            || order.Any(piece => piece is < 0 || piece >= expectedCount))
        {
            return InvalidScore($"{propertyName} 必須是 0 到 {expectedCount - 1} 的完整排列。", out error);
        }
        var correctPieces = order.Select((piece, index) => piece == index).Count(isCorrect => isCorrect);
        return (int)Math.Round(correctPieces * 100d / expectedCount, MidpointRounding.AwayFromZero);
    }

    private static int InvalidScore(string message, out string? error)
    {
        error = message;
        return -1;
    }

    private static bool TryReadArtifactPool(string? json, out IReadOnlyCollection<Guid> artifactPool)
    {
        artifactPool = Array.Empty<Guid>();
        if (string.IsNullOrWhiteSpace(json))
            return false;
        try
        {
            var parsed = JsonSerializer.Deserialize<Guid[]>(json);
            if (parsed is null || parsed.Length == 0 || parsed.Distinct().Count() != parsed.Length)
                return false;
            artifactPool = parsed;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryGetString(JsonElement element, string propertyName, out string? value)
    {
        value = null;
        return TryGetProperty(element, propertyName, out var property)
            && property.ValueKind == JsonValueKind.String
            && (value = property.GetString()) is not null;
    }

    private static bool TryGetGuid(JsonElement element, string propertyName, out Guid value)
    {
        value = Guid.Empty;
        return TryGetProperty(element, propertyName, out var property)
            && property.ValueKind == JsonValueKind.String
            && property.TryGetGuid(out value);
    }

    /// <summary>實際操作門檻：至少操作幾次，或實際遊玩超過幾秒；全部由系統代完成則一律不算。</summary>
    private const int MinEngagedSeconds = 20;
    private const int MinEngagedMoves = 3;
    private const int MinLocatorAnswers = 2;

    private static bool HasMeaningfulPlay(MiniGameAttempt attempt, GameModeDefinition mode, JsonElement result)
    {
        var units = mode.Code switch
        {
            "ARTIFACT_PUZZLE" => PuzzlePieceCount,
            "STRIP_RESTORE" => RestorePieceCount,
            "MEMORY_MATCH" => TryReadArtifactPool(attempt.ArtifactPoolJson, out var memoryPool) ? Math.Min(memoryPool.Count, StandardMemoryPairCount) : StandardMemoryPairCount,
            _ => TryReadArtifactPool(attempt.ArtifactPoolJson, out var locatorPool) ? locatorPool.Count : 4
        };
        TryGetInt(result, "autoPlaced", out var assisted);
        TryGetInt(result, "moves", out var moves);
        var wallSeconds = Math.Max(0, (DateTime.UtcNow - attempt.StartedAt).TotalSeconds);
        var seconds = TryGetInt(result, "elapsedSeconds", out var elapsed) ? Math.Min(elapsed, wallSeconds) : wallSeconds;
        var ownUnits = units - assisted;
        if (ownUnits <= 0) return false;
        return mode.Code == "DETAIL_LOCATOR"
            ? ownUnits >= MinLocatorAnswers || seconds >= MinEngagedSeconds
            : moves >= MinEngagedMoves || seconds >= MinEngagedSeconds;
    }

    private static bool TryGetInt(JsonElement element, string propertyName, out int value)
    {
        value = 0;
        return TryGetProperty(element, propertyName, out var property)
            && property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out value);
    }

    private static bool TryGetIntArray(JsonElement element, string propertyName, out int[] values)
    {
        values = Array.Empty<int>();
        if (!TryGetProperty(element, propertyName, out var property)
            || property.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        var parsed = new List<int>();
        foreach (var item in property.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Number || !item.TryGetInt32(out var value))
                return false;
            parsed.Add(value);
        }
        values = parsed.ToArray();
        return true;
    }

    private static bool TryGetProperty(JsonElement element, string propertyName, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }
        value = default;
        return false;
    }

    private sealed record ArtifactMaterialView(
        Guid Id,
        string Name,
        string PrimaryImagePath,
        string? ThumbnailPath,
        Guid CategoryId,
        Guid EraBucketId,
        string CategoryCode);
}

/// <summary>前端建立玩法所需的模式識別與評分門檻。</summary>
public sealed record MiniGameModeView(
    Guid Id,
    string Code,
    string Name,
    string Description,
    string? ConfigJson,
    int GradeBThreshold,
    int GradeAThreshold,
    int GradeSThreshold);

/// <summary>開始 Mini Game 後回傳的伺服器素材與不可由客戶端自行決定的執行資訊。</summary>
public sealed record MiniGameLocatorTarget(Guid ArtifactId, double X, double Y);

public sealed record MiniGameStartView(
    Guid AttemptId,
    string ModeCode,
    string ModeName,
    Guid ArtifactId,
    string ArtifactName,
    string PrimaryImagePath,
    string? ThumbnailPath,
    IReadOnlyList<MiniGameArtifactView> ArtifactPool,
    string Difficulty,
    string Seed,
    string? ConfigJson,
    DateTime StartedAt,
    IReadOnlyList<MiniGameLocatorTarget>? LocatorTargets = null,
    IReadOnlyList<int>? BackgroundPieces = null);

/// <summary>Mini Game 素材池中的單件文物影像資料。</summary>
public sealed record MiniGameArtifactView(
    Guid ArtifactId,
    string Name,
    string PrimaryImagePath,
    string? ThumbnailPath);

/// <summary>完成 Attempt 後的伺服器評分、獎勵與累積進度結果。</summary>
public sealed record MiniGameCompleteView(
    Guid AttemptId,
    string ModeCode,
    int RawScore,
    int NormalizedScore,
    string Grade,
    int PointReward,
    decimal KeyProgressReward,
    int ConvertedNormalKeys,
    decimal RemainingKeyProgress,
    bool EconomicRewardGranted,
    bool AlreadyCompleted,
    DateTime CompletedAt, byte KeyRewardDivisor = 1);
