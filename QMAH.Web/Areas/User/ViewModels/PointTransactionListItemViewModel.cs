using QMAH.Web.Models.Entities;
namespace QMAH.Web.Areas.User.ViewModels;

public class PointTransactionListItemViewModel
{
    public PointTransaction Transaction { get; set; } = null!;

    public string Email { get; set; } = "";
}