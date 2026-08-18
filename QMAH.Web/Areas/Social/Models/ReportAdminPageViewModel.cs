namespace QMAH.Web.Areas.Social.Models;

public sealed class ReportAdminPageViewModel
{
    public string? Status { get; set; }

    public string? TargetType { get; set; }

    public string? Keyword { get; set; }

    public int TotalCount { get; set; }

    public IReadOnlyList<ReportListViewModel> Reports { get; set; } = [];
}
