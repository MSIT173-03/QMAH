namespace QMAH.Infrastructure.Services.Economy;

/// <summary>完成度與表現分數分開，僅套用於拼圖及書畫復位。</summary>
public static class MiniGamePlacementScoring
{
    /// <summary>全部由系統代完成扣滿 100 分；只要用過協助，評級最高 B（低於 A 門檻）。</summary>
    public const double AssistPenaltyWeight = 100d;
    public static int CalculateAssistance(int completion, int units, int hints, int assisted, int hintCost, int aThreshold)
    {
        var score = Math.Clamp((int)Math.Floor(completion - hints * (double)hintCost - Math.Ceiling(AssistPenaltyWeight * assisted / Math.Max(1, units))), 0, 100);
        return assisted > 0 ? Math.Min(score, Math.Max(0, aThreshold - 1)) : score;
    }
    public static int Calculate(int completion, int pieces, int elapsedSeconds, int moves, int hints, int autoPlaced, int aThreshold, int? moveAllowance = null, int? graceSecondsOverride = null)
    {
        // 每片十二秒的寬限時間：25 片五分鐘、15 片三分鐘。
        // 超過寬限後逐點扣分，再經過一段相同時間才達到最多扣十分。
        var graceSeconds = graceSecondsOverride ?? pieces * 12;
        var timePenalty = Math.Min(10, Math.Floor(Math.Max(0, elapsedSeconds - graceSeconds) * 10d / graceSeconds));
        var movePenalty = Math.Min(25, Math.Max(0, moves - (moveAllowance ?? pieces)) * 15d / pieces);
        var assistancePenalty = Math.Ceiling(AssistPenaltyWeight * autoPlaced / pieces);
        var score = Math.Clamp((int)Math.Floor(completion - timePenalty - movePenalty - hints * 3d - assistancePenalty), 0, 100);
        return autoPlaced > 0 ? Math.Min(score, Math.Max(0, aThreshold - 1)) : score;
    }
}
