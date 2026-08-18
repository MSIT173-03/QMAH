namespace QMAH.Web.Areas.User.ViewModels;

public class PointAdjustViewModel
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = "";

    public int CurrentBalance { get; set; }

    public int Amount { get; set; }

    public string Reason { get; set; } = "";
}