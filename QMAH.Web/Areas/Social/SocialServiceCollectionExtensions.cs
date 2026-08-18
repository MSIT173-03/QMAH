using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace QMAH.Web.Areas.Social
{
    /// <summary>
    /// 社群模組 (Social Area) 專屬服務註冊與設定擴充
    /// </summary>
    public static class SocialServiceCollectionExtensions
    {
        /// <summary>
        /// 註冊社群後台與風控相關的 Policy 授權策略
        /// </summary>
        public static IServiceCollection AddSocialAuthorizationPolicies(this IServiceCollection services)
        {
            services.AddAuthorization(options =>
            {
                // 1. 後台基本進入權限 (包含所有管理員角色)
                options.AddPolicy("Policy.SocialAdmin.Access", policy =>
                    policy.RequireRole("Admin", "AnnouncementEditor", "ContentModerator", "EventModerator"));

                // 2. 官方公告管理權限 (Admin 超級管理員 + 公告小編)
                options.AddPolicy("Policy.Social.ManageAnnouncements", policy =>
                    policy.RequireRole("Admin", "AnnouncementEditor"));

                // 3. 社群風控與貼文審核權限 (Admin 超級管理員 + 風控審核員)
                options.AddPolicy("Policy.Social.ManageReports", policy =>
                    policy.RequireRole("Admin", "ContentModerator"));

                // 4. 活動審核權限 (Admin 超級管理員 + 活動審核員)
                options.AddPolicy("Policy.Social.ManageEvents", policy =>
                    policy.RequireRole("Admin", "EventModerator"));
            });

            return services;
        }
    }
}