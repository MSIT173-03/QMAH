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
    public Guid? IssuedByAdminUserId { get; set; }
    public string IssuedByAdminEmail { get; set; } = "";
    public string? IssueReason { get; set; }
    public DateTime? RevokedAt { get; set; }
    public Guid? RevokedByAdminUserId { get; set; }
    public string RevokedByAdminEmail { get; set; } = "";
    public string? RevokeReason { get; set; }
}
