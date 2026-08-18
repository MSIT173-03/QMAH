using System.Text.Json.Serialization;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderDetailAppendDataResponse
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum EResultType
    {
        Success,
        ErrorOrderNotFound
    }

    public struct Data
    {
        public Guid Id;
        public string Name;
    }

    public EResultType Type { get; set; }
    public List<Data> List { get; set; }
}
