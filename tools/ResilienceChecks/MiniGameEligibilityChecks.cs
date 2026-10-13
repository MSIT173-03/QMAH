using System.Reflection;
using System.Text.Json;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Economy;

internal static class MiniGameEligibilityChecks
{
    internal static void Run()
    {
        var method = typeof(MiniGameService).GetMethod("HasMeaningfulPlay", BindingFlags.NonPublic | BindingFlags.Static)!;
        bool Eligible(int assisted, int seconds, int moves, int wallSeconds = 30)
        {
            using var result = JsonDocument.Parse(JsonSerializer.Serialize(new { autoPlaced = assisted, elapsedSeconds = seconds, moves }));
            var attempt = new MiniGameAttempt { StartedAt = DateTime.UtcNow.AddSeconds(-wallSeconds) };
            return (bool)method.Invoke(null, [attempt, new GameModeDefinition { Code = "ARTIFACT_PUZZLE" }, result.RootElement])!;
        }
        void Check(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
        Check(Eligible(24, 20, 0), "One own piece and twenty seconds should qualify.");
        Check(Eligible(24, 0, 3), "One own piece and three moves should qualify without waiting.");
        Check(!Eligible(24, 19, 2), "A short mostly assisted attempt must not qualify yet.");
        Check(!Eligible(25, 60, 10), "Entirely automatic completion must not qualify.");
        Check(!Eligible(24, 0, 2), "Two fast moves should not qualify.");
        Check(!Eligible(24, 20, 0, 10), "Claimed elapsed time must not exceed server elapsed time.");
        Check(Eligible(18, 0, 0), "Completing at least a quarter oneself should qualify without waiting.");
        Check(!Eligible(19, 0, 0), "Less than a quarter still needs meaningful time and movement.");
        var reward = MiniGameCompletionReward.Apply("FAIL", 0, 0);
        Check(reward.Points > 0 && reward.KeyProgress > 0, "Eligible completion retains its minimum reward.");
        var cooldown = typeof(MiniGameService).GetMethod("RemainingRewardCooldownSeconds", BindingFlags.NonPublic | BindingFlags.Static)!;
        var now = DateTime.UtcNow;
        Check((int)cooldown.Invoke(null, [null, now])! == 0, "First reward must not be delayed.");
        Check((int)cooldown.Invoke(null, [now.AddSeconds(-5), now])! == 15, "Rapid repeat rewards must wait.");
        Check((int)cooldown.Invoke(null, [now.AddSeconds(-20), now])! == 0, "Rewards can resume after twenty seconds.");
        Console.WriteLine("Mini game assisted completion: lowered eligibility, server-time cap and no entirely automatic reward passed");
    }
}
