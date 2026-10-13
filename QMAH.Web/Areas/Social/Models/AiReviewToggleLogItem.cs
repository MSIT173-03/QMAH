namespace QMAH.Web.Areas.Social.Models;

/// <summary>後台「AI 審核開關紀錄」列表的一列，來源是 admin.AuditLogs 中開啟／暫停 AI 審查的操作。</summary>
public sealed record AiReviewToggleLogItem(DateTime OccurredAt, string? ActorName, bool Enabled, bool Succeeded);
