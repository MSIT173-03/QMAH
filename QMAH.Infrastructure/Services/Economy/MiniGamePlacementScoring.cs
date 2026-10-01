namespace QMAH.Infrastructure.Services.Economy;

/// <summary>完成度與表現分數分開，僅套用於拼圖及書畫復位。</summary>
public static class MiniGamePlacementScoring
{
    public static int CalculateAssistance(int completion, int units, int hints, int assisted, int hintCost, int sThreshold)
    {
        var score = Math.Clamp((int)Math.Floor(completion - hints * (double)hintCost - Math.Ceiling(60d * assisted / Math.Max(1, units))), 0, 100);
        return assisted > 0 ? Math.Min(score, Math.Max(0, sThreshold - 1)) : score;
    }
    public static int Calculate(int completion, int pieces, int elapsedSeconds, int moves, int hints, int autoPlaced, int sThreshold)
    {
        // 每片六秒的寬限時間，理想操作為每片一次；超額時間與操作各最多扣 25 分。
        var timePenalty = Math.Min(25, Math.Max(0, elapsedSeconds - pieces * 6) * 12d / (pieces * 6));
        var movePenalty = Math.Min(25, Math.Max(0, moves - pieces) * 15d / pieces);
        var assistancePenalty = Math.Ceiling(60d * autoPlaced / pieces);
        var score = Math.Clamp((int)Math.Floor(completion - timePenalty - movePenalty - hints * 3d - assistancePenalty), 0, 100);
        return autoPlaced > 0 ? Math.Min(score, Math.Max(0, sThreshold - 1)) : score;
    }
}
