namespace QMAH.Web.Areas.Social.Models;

public sealed class ContentKeywordListViewModel
{
    public Guid Id { get; set; }

    public string Keyword { get; set; } = string.Empty;

    public string Action { get; set; } = "FLAG"; // BLOCK：直接擋發文；FLAG：放行但自動送檢舉

    public string? Category { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}
