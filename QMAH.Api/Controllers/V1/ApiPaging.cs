using Microsoft.EntityFrameworkCore;

namespace QMAH.Api.Controllers.V1;

public sealed record ApiPage<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public static class ApiPaging
{
    public static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));

    public static async Task<ApiPage<T>> ToPageAsync<T>(
        IQueryable<T> query,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Normalize(page, pageSize);
        try
        {
            var totalCount = await query.CountAsync(cancellationToken);
            var totalPages = totalCount == 0
                ? 0
                : (int)Math.Ceiling(totalCount / (double)pageSize);
            page = totalPages == 0 ? 1 : Math.Min(page, totalPages);
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);
            return new ApiPage<T>(items, page, pageSize, totalCount, totalPages);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // 使用者快速切換頁面／篩選時瀏覽器會中止舊請求，這是正常現象。
            // 在這裡就地處理（回傳空頁，反正已經沒人在等這個回應），不讓例外穿過 MVC 框架，
            // 否則 Visual Studio 會把它當成「使用者未處理的例外」而中斷偵錯。
            return new ApiPage<T>([], page, pageSize, 0, 0);
        }
    }
}
