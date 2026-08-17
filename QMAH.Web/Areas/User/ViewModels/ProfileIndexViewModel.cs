using QMAH.Web.Models.Entities;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

public class ProfileIndexViewModel
{
    public ApplicationUser User { get; set; } = null!;

    public UserProfile Profile { get; set; } = null!;

    public List<UserAddress> Addresses { get; set; } = new();
}