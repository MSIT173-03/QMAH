using System;

namespace QMAH.Web.Areas.Social.Services
{
    public interface ICurrentUserService
    {
        Guid GetCurrentUserId(); // 👈 int 改為 Guid
        bool IsAuthenticated();
    }
}
