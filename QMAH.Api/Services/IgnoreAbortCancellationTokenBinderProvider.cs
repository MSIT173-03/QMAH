using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace QMAH.Api.Services;

/// <summary>
/// 開發環境專用：讓 action 的 <see cref="CancellationToken"/> 參數不再綁定到 RequestAborted。
/// 前端快速切換頁面或篩選時，瀏覽器會中止舊請求；EF Core／SqlClient 因此丟出
/// OperationCanceledException 或「使用者已經取消作業」的 SqlException。這些例外會穿過 MVC 框架程式碼，
/// Visual Studio 偵錯時會被視為「使用者未處理的例外」而中斷（即使最外層中介層其實會接住）。
/// 開發時讓查詢自然完成就不會產生例外；正式環境不啟用，仍保留取消以節省資源。
/// </summary>
public sealed class IgnoreAbortCancellationTokenBinderProvider : IModelBinderProvider
{
    public IModelBinder? GetBinder(ModelBinderProviderContext context) =>
        context.Metadata.ModelType == typeof(CancellationToken) ? new NoCancelBinder() : null;

    private sealed class NoCancelBinder : IModelBinder
    {
        public Task BindModelAsync(ModelBindingContext bindingContext)
        {
            bindingContext.Result = ModelBindingResult.Success(CancellationToken.None);
            return Task.CompletedTask;
        }
    }
}
