namespace QMAH.Web.Areas.User.ViewModels;

public class PointBackpackListItemViewModel
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = "";
    public string? Nickname { get; set; }
    public int Balance { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
