namespace QMAH.Web.Areas.Catalog.ViewModel;

public class UserKeyBalanceViewModel
{
    public Guid UserId { get; set; }
    public Guid KeyDefinitionId { get; set; }
    public required string KeyName { get; set; }
    public required string KeyCode { get; set; }
    public bool IsActive { get; set; }
    public int Balance { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UserKeyOwnerSummaryViewModel
{
    public Guid UserId { get; set; }
    public string? Nickname { get; set; }
    public string? Email { get; set; }
    public int KeyTypeCount { get; set; }
    public int TotalBalance { get; set; }
}
