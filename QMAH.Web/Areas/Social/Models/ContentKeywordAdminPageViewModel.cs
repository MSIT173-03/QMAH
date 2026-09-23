namespace QMAH.Web.Areas.Social.Models;

public sealed class ContentKeywordAdminPageViewModel
{
    public bool? IsActive { get; set; } = true;

    public string? Keyword { get; set; }

    public int TotalCount { get; set; }

    public IReadOnlyList<ContentKeywordListViewModel> Keywords { get; set; } = [];

    public ContentKeywordCreateViewModel NewKeyword { get; set; } = new();

    public ContentModerationSettingsViewModel ModerationSettings { get; set; } = new();
}
