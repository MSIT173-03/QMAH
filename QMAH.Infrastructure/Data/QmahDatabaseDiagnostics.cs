using System.Data.Common;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace QMAH.Infrastructure.Data;

/// <summary>
/// 提供主機在登入前辨識 QMAH 資料庫狀態所需的共用診斷工具。
/// </summary>
public static class QmahDatabaseDiagnostics
{
    public static bool IsDatabaseFailure(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is DbException or RetryLimitExceededException)
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// 真的連不上資料庫（網路、登入、資料庫離線）才算；死結、欄位被截斷等 SQL 執行錯誤不是連線問題，
    /// 不應該對使用者顯示「資料庫無法連線」。
    /// </summary>
    public static bool IsConnectionFailure(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is Microsoft.Data.SqlClient.SqlException sql
                && sql.Number is -2 or 2 or 20 or 40 or 53 or 64 or 233 or 4060 or 10053 or 10054 or 10060 or 18456 or 40613)
            {
                return true;
            }
        }

        return false;
    }

    public static string GetTarget(QmahDbContext context)
    {
        var connection = context.Database.GetDbConnection();
        return $"{connection.DataSource};Database={connection.Database}";
    }
}
