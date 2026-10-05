namespace QMAH.Infrastructure.Services.Economy;

public static class MiniGameCompletionReward
{
    // 僅在伺服器驗證整局完成後套用；高評級保留原設定較高的獎勵。
    public static (int Points, int KeyProgress) Apply(string grade, int points, int keyProgress)
    {
        if (points < 0 || keyProgress < 0)
            return (points, keyProgress);
        var minimum = grade switch
        {
            "S" => (10, 40),
            "A" => (8, 30),
            "B" => (6, 20),
            "C" => (4, 15),
            "FAIL" => (2, 10),
            _ => throw new ArgumentOutOfRangeException(nameof(grade))
        };
        return (Math.Max(points, minimum.Item1), Math.Max(keyProgress, minimum.Item2));
    }
}
