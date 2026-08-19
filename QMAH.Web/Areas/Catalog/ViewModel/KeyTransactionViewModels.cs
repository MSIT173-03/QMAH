namespace QMAH.Web.Areas.Catalog.ViewModel;

public sealed class KeyTransactionListItemViewModel
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string MemberName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string KeyName { get; init; } = string.Empty;
    public string KeyCode { get; init; } = string.Empty;
    public int Delta { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string ReferenceType { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
}
