namespace QMAH.Web.Areas.Store.ViewModels;

public class CouponTransactionListItemViewModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = "";
    public string? Nickname { get; set; }
    public string CouponName { get; set; } = "";
    public string CouponCode { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime IssuedAt { get; set; }
    public DateTime? UsedAt { get; set; }
}
