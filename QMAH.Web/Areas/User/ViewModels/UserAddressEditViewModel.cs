namespace QMAH.Web.Areas.User.ViewModels;

using System.ComponentModel.DataAnnotations;

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

    [Range(typeof(decimal), "-90", "90", ErrorMessage = "緯度必須介於 -90 到 90 之間。")]
    public decimal? Latitude { get; set; }

    [Range(typeof(decimal), "-180", "180", ErrorMessage = "經度必須介於 -180 到 180 之間。")]
    public decimal? Longitude { get; set; }

    public string AddressLine { get; set; } = "";

    public bool IsDefault { get; set; }

    public byte[] RowVersion { get; set; } = null!;
}
