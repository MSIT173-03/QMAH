namespace QMAH.Web.Areas.User.ViewModels;

public class AchievementCreateViewModel
{
    public string Code { get; set; } = "";

    public string Name { get; set; } = "";

    public string Title { get; set; } = "";

    public string? Description { get; set; }

    public string? IconPath { get; set; }

    public string ConditionType { get; set; } = "";

    public long ThresholdValue { get; set; }

    public string Status { get; set; } = "ACTIVE";
}