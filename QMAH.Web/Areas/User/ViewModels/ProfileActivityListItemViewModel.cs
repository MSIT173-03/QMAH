namespace QMAH.Web.Areas.User.ViewModels;

public class ProfileActivityListItemViewModel
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = "";

    public string Nickname { get; set; } = "";

    public string Visibility { get; set; } = "";

    public int PostCount { get; set; }

    public int CommentCount { get; set; }

    public string RecentActivity { get; set; } = "";
}