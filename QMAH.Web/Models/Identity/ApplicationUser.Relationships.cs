using QMAH.Web.Models.Entities;

namespace QMAH.Web.Models.Identity;

/// <summary>
/// 對應各功能資料表指向 ASP.NET Core Identity 使用者的導覽屬性。
/// </summary>
public partial class ApplicationUser
{
    public ICollection<ArtifactUnlock> ArtifactUnlocks { get; } = [];
    public ICollection<CartItem> CartItems { get; } = [];
    public ICollection<ContentReport> SubmittedContentReports { get; } = [];
    public ICollection<ContentReport> ReviewedContentReports { get; } = [];
    public ICollection<Event> OrganizedEvents { get; } = [];
    public ICollection<Event> ReviewedEvents { get; } = [];
    public ICollection<EventRegistration> EventRegistrations { get; } = [];
    public ICollection<GamePlayer> GamePlayers { get; } = [];
    public ICollection<KeyTransaction> KeyTransactions { get; } = [];
    public ICollection<OfficialAnnouncement> OfficialAnnouncements { get; } = [];
    public PointBalance? PointBalance { get; set; }
    public ICollection<PointTransaction> PointTransactions { get; } = [];
    public ICollection<SocialComment> SocialComments { get; } = [];
    public ICollection<SocialPost> SocialPosts { get; } = [];
    public ICollection<StoreOrder> StoreOrders { get; } = [];
    public ICollection<UserCoupon> Coupons { get; } = [];
    public ICollection<UserKeyBalance> KeyBalances { get; } = [];
    public ICollection<UserNotification> Notifications { get; } = [];
}