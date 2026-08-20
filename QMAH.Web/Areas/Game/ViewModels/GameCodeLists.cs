using Microsoft.AspNetCore.Mvc.Rendering;

namespace QMAH.Web.Areas.Game.ViewModels;

public static class GameCodeLists
{
    public static readonly IReadOnlyList<int> PageSizes = [10, 20, 50, 100];

    public static readonly IReadOnlyDictionary<string, string> RoomStatuses =
        new Dictionary<string, string>
        {
            ["WAITING"] = "等待中",
            ["PLAYING"] = "進行中",
            ["COMPLETED"] = "已完成",
            ["CANCELLED"] = "已取消"
        };

    public static readonly IReadOnlyDictionary<string, string> Visibilities =
        new Dictionary<string, string>
        {
            ["PUBLIC"] = "公開",
            ["PRIVATE"] = "私人"
        };

    public static readonly IReadOnlyDictionary<string, string> PlayerRoles =
        new Dictionary<string, string>
        {
            ["HOST"] = "房主",
            ["PLAYER"] = "玩家"
        };

    public static readonly IReadOnlyDictionary<string, string> ConnectionStatuses =
        new Dictionary<string, string>
        {
            ["ONLINE"] = "在線",
            ["OFFLINE"] = "暫時離線",
            ["LEFT"] = "已離開"
        };

    public static readonly IReadOnlyDictionary<string, string> RoundStatuses =
        new Dictionary<string, string>
        {
            ["ANSWERING"] = "作答中",
            ["VOTING"] = "投票中",
            ["REVEALED"] = "已揭曉"
        };

    public static readonly IReadOnlyDictionary<string, string> AnswerTypes =
        new Dictionary<string, string>
        {
            ["FACTUAL_REASONING"] = "事實推理",
            ["PLAUSIBLE_FICTION"] = "合理虛構",
            ["CREATIVE_TALE"] = "創意故事"
        };

    public static readonly IReadOnlyDictionary<string, string> QuestionTemplates =
        new Dictionary<string, string>
        {
            ["GENERAL"] = "一般鑑定",
            ["ERA"] = "年代判讀",
            ["CATEGORY"] = "分類判讀"
        };

    public static IEnumerable<SelectListItem> ToSelectList(
        IReadOnlyDictionary<string, string> source,
        string? selected = null,
        bool includeAll = false,
        string allText = "全部")
    {
        if (includeAll)
        {
            yield return new SelectListItem(allText, string.Empty, string.IsNullOrEmpty(selected));
        }

        foreach (var pair in source)
        {
            yield return new SelectListItem(pair.Value, pair.Key, pair.Key == selected);
        }
    }

    public static string Label(IReadOnlyDictionary<string, string> source, string code) =>
        source.TryGetValue(code, out var label) ? label : code;

    public static int NormalizePageSize(int pageSize) =>
        PageSizes.Contains(pageSize) ? pageSize : 20;

    public static string StatusBadgeClass(string code) => code switch
    {
        "PLAYING" or "ONLINE" or "REVEALED" => "bg-green-lt text-green",
        "WAITING" or "ANSWERING" or "OFFLINE" => "bg-blue-lt text-blue",
        "VOTING" => "bg-yellow-lt text-yellow",
        "COMPLETED" or "PUBLIC" => "bg-secondary-lt text-secondary",
        "CANCELLED" or "LEFT" => "bg-red-lt text-red",
        "PRIVATE" => "bg-purple-lt text-purple",
        _ => "bg-secondary-lt text-secondary"
    };

    public static string EnabledBadgeClass(bool isEnabled) =>
        isEnabled ? "bg-green-lt text-green" : "bg-secondary-lt text-secondary";
}
