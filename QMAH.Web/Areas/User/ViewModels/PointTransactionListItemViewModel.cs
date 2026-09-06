using QMAH.Infrastructure.Models.Entities;
namespace QMAH.Web.Areas.User.ViewModels;

public class PointTransactionListItemViewModel
{
    public PointTransaction Transaction { get; set; } = null!;

    public string Email { get; set; } = "";
    public Guid? AdminUserId { get; set; }
    public string AdminEmail { get; set; } = "";
}
