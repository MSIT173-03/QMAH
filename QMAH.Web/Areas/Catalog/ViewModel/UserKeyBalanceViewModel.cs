using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Catalog.ViewModel;

public class UserKeyBalanceViewModel
{
    public required UserKeyBalance UserKeyBalance { get; set; }
    public required string Nickname { get; set; }
}

public class UserKeyOwnerSummaryViewModel
{
    public Guid UserId { get; set; }
    public string? Nickname { get; set; }
    public int KeyTypeCount { get; set; }
    public int TotalBalance { get; set; }
}
