using System;

namespace QMAH.Web.Areas.Social.Services
{
    public class MockCurrentUserService : ICurrentUserService
    {
        // 填入資料庫中真實存在的 UserId (社群測試員)
        public Guid GetCurrentUserId() => Guid.Parse("38fa2951-c2f7-42e1-b279-405343c37eae");
        public bool IsAuthenticated() => true;
    }
}