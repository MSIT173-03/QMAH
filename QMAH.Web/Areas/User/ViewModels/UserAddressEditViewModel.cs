namespace QMAH.Web.Areas.User.ViewModels;

public class UserAddressEditViewModel
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string AddressLabel { get; set; } = "";

    public string RecipientName { get; set; } = "";

    public string RecipientPhone { get; set; } = "";

    public string? PostalCode { get; set; }

    public string? City { get; set; }

    public string? District { get; set; }

    public string AddressLine { get; set; } = "";

    public bool IsDefault { get; set; }

    public byte[] RowVersion { get; set; } = null!;
}