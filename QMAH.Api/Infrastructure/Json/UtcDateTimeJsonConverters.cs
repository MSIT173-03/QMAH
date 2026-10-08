using System.Text.Json;
using System.Text.Json.Serialization;

namespace QMAH.Api.Infrastructure.Json;

/// <summary>
/// 資料庫的 datetime2 讀回來是 Kind=Unspecified，預設序列化不帶 Z，瀏覽器會把它當成本地時間，
/// 以台灣時區（UTC+8）計算倒數時截止時間會落在 8 小時前而一律顯示 00:00。
/// 專案所有寫入都用 UTC，因此輸出時明確標成 UTC。
/// </summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(ToUtc(value));

    internal static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}

public sealed class UtcNullableDateTimeJsonConverter : JsonConverter<DateTime?>
{
    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.Null ? null : reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(UtcDateTimeJsonConverter.ToUtc(value.Value));
    }
}
