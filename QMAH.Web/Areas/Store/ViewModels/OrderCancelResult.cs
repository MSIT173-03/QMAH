using System.Text.Json.Serialization;

namespace QMAH.Web.Areas.Store.ViewModels;



public class OrderCancelResult
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EResultType
    {
        Success,
        ErrorNotFound,
        ErrorCancelled,
        ErrorOtherException,
    }

    public EResultType Type { get; set; }
    public string? Message { get; set; }
}