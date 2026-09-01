using Microsoft.OpenApi;

namespace QMAH.Api.Infrastructure.OpenApi;

/// <summary>
/// 提供請求 Schema 欄位的業務語意，讓 Scalar 與其他 OpenAPI 工具能直接顯示送出方式。
/// </summary>
internal static class QmahOpenApiSchemaCatalog
{
    private static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> PropertyDescriptions =
        new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["LoginRequest"] = Fields(
                ("email", "Email（會員電子郵件）；用來尋找登入帳號"),
                ("password", "Password（會員密碼）"),
                ("rememberMe", "RememberMe（記住登入）為 true 時延長登入狀態有效期間")),
            ["RegisterRequest"] = Fields(
                ("email", "Email（會員電子郵件）；不可與既有帳號重複"),
                ("nickname", "Nickname（會員顯示名稱）"),
                ("password", "Password（會員密碼）；至少 8 個字元"),
                ("confirmPassword", "ConfirmPassword（再次輸入的會員密碼）；必須與 Password（會員密碼）相同")),
            ["ForgotPasswordRequest"] = Fields(
                ("email", "Email（會員電子郵件）；無論是否存在都使用相同成功回應")),
            ["ResetPasswordRequest"] = Fields(
                ("email", "Email（會員電子郵件）"),
                ("token", "Token（密碼重設驗證字串）"),
                ("newPassword", "NewPassword（新會員密碼）；至少 8 個字元"),
                ("confirmPassword", "ConfirmPassword（再次輸入的新密碼）；必須與 NewPassword（新會員密碼）相同")),
            ["UpsertProductReviewRequest"] = Fields(
                ("rating", "Rating（星等）範圍為 1 至 5"),
                ("content", "Content（評價內容）；長度為 1 至 1000 個字元")),
            ["CreateGameRoomRequest"] = Fields(
                ("visibility", "Visibility（房間可見範圍）；使用 PUBLIC 或 PRIVATE"),
                ("password", "Password（私人房間密碼）；PRIVATE 房間必須提供"),
                ("displayName", "DisplayName（遊戲中顯示名稱）"),
                ("maxPlayers", "MaxPlayers（房間人數上限）；範圍為 3 至 10"),
                ("totalRounds", "TotalRounds（遊戲回合數）；範圍為 1 至 5"),
                ("answerSeconds", "AnswerSeconds（每回合作答秒數）；範圍為 30 至 300"),
                ("votingSeconds", "VotingSeconds（每回合投票秒數）；範圍為 20 至 180"),
                ("categoryFilterCode", "CategoryFilterCode（文物分類系統代碼）；可省略"),
                ("eraBucketFilterCode", "EraBucketFilterCode（文物年代系統代碼）；可省略")),
            ["JoinGameRoomRequest"] = Fields(
                ("displayName", "DisplayName（遊戲中顯示名稱）"),
                ("password", "Password（私人房間密碼）；公開房間可省略")),
            ["SubmitAnswerRequest"] = Fields(
                ("answerType", "AnswerType（答案類型系統代碼）"),
                ("text", "Text（玩家送出的答案文字）；長度為 1 至 500 個字元")),
            ["SubmitVoteRequest"] = Fields(
                ("answerId", "AnswerId（答案資源識別碼）；必須屬於目前回合且不可是自己的答案"),
                ("count", "Count（投票數量）；範圍為 1 至 5")),
            ["CreateSocialPostRequest"] = Fields(
                ("postType", "PostType（貼文類型系統代碼）；使用 POST 或 ANNOUNCEMENT"),
                ("boardCode", "BoardCode（社群板塊系統代碼）"),
                ("title", "Title（貼文標題）；長度為 1 至 80 個字元"),
                ("content", "Content（貼文內容）；長度為 1 至 4000 個字元"),
                ("artifactId", "ArtifactId（關聯文物資源識別碼）；可省略"),
                ("locationName", "LocationName（地點名稱）；可省略"),
                ("latitude", "Latitude（緯度）；與 Longitude 同時提供或同時省略"),
                ("longitude", "Longitude（經度）；與 Latitude 同時提供或同時省略"),
                ("mediaIds", "MediaIds（社群圖片資源識別碼清單）；最多 8 筆")),
            ["CreateSocialEventRequest"] = Fields(
                ("eventType", "EventType（活動類型系統代碼）"),
                ("title", "Title（活動標題）"),
                ("content", "Content（活動內容）"),
                ("location", "Location（活動地點文字）；可省略"),
                ("latitude", "Latitude（緯度）；與 Longitude 同時提供或同時省略"),
                ("longitude", "Longitude（經度）；與 Latitude 同時提供或同時省略"),
                ("startAt", "StartAt（活動開始時間）；使用 ISO 8601（標準日期時間文字格式）"),
                ("endAt", "EndAt（活動結束時間）；使用 ISO 8601（標準日期時間文字格式）"),
                ("registrationEndAt", "RegistrationEndAt（報名截止時間）；可省略"),
                ("capacity", "Capacity（活動名額）；可省略，提供時至少為 1"),
                ("postContentMode", "PostContentMode（活動貼文內容模式）；使用 TEMPLATE 或 CUSTOM"),
                ("postTitle", "PostTitle（自訂活動貼文標題）；CUSTOM 模式可使用"),
                ("postContent", "PostContent（自訂活動貼文內容）；CUSTOM 模式可使用")),
            ["CreateSocialCommentRequest"] = Fields(
                ("content", "Content（留言內容）；長度為 1 至 2000 個字元"),
                ("parentCommentId", "ParentCommentId（父留言資源識別碼）；建立回覆時提供")),
            ["CreateContentReportRequest"] = Fields(
                ("targetType", "TargetType（被檢舉內容類型系統代碼）"),
                ("targetId", "TargetId（被檢舉內容資源識別碼）"),
                ("reason", "Reason（檢舉原因）"),
                ("detail", "Detail（補充說明）；可省略")),
            ["UpsertUserAddressRequest"] = Fields(
                ("addressLabel", "AddressLabel（地址標籤）；同一會員不可重複"),
                ("recipientName", "RecipientName（收件人姓名）"),
                ("recipientPhone", "RecipientPhone（收件人電話）"),
                ("postalCode", "PostalCode（郵遞區號）；可省略"),
                ("city", "City（縣市）；可省略"),
                ("district", "District（行政區）；可省略"),
                ("addressLine", "AddressLine（詳細地址）"),
                ("latitude", "Latitude（緯度）；與 Longitude 同時提供或同時省略"),
                ("longitude", "Longitude（經度）；與 Latitude 同時提供或同時省略"),
                ("isDefault", "IsDefault（是否設為預設地址）")),
            ["CreateOrderItemRequest"] = Fields(
                ("productId", "ProductId（商品資源識別碼）"),
                ("quantity", "Quantity（購買數量）；範圍為 1 至 99")),
            ["CreateStoreOrderRequest"] = Fields(
                ("items", "Items（訂單商品清單）；至少包含一筆商品明細"),
                ("userCouponId", "UserCouponId（會員優惠券資源識別碼）；可省略"),
                ("pointsUsed", "PointsUsed（使用點數）；不可為負數"),
                ("recipientName", "RecipientName（收件人姓名）"),
                ("recipientPhone", "RecipientPhone（收件人電話）"),
                ("shippingPostalCode", "ShippingPostalCode（配送郵遞區號）"),
                ("shippingCity", "ShippingCity（配送縣市）"),
                ("shippingDistrict", "ShippingDistrict（配送行政區）"),
                ("shippingAddressLine", "ShippingAddressLine（配送詳細地址）")),
            ["UpdateProfileRequest"] = Fields(
                ("nickname", "Nickname（會員顯示名稱）"),
                ("bio", "Bio（會員自我介紹）；可省略"),
                ("visibility", "Visibility（個人資料可見範圍）；使用 PUBLIC、FRIENDS 或 PRIVATE")),
            ["UpsertCartItemRequest"] = Fields(
                ("productId", "ProductId（商品資源識別碼）"),
                ("quantity", "Quantity（購物車商品數量）；範圍為 1 至 99"))
        };

    public static void Apply(OpenApiDocument document)
    {
        if (document.Components?.Schemas is not { } schemas)
            return;

        foreach (var (schemaName, fields) in PropertyDescriptions)
        {
            if (!schemas.TryGetValue(schemaName, out var schema)
                || schema is not OpenApiSchema concreteSchema
                || concreteSchema.Properties is null)
            {
                continue;
            }

            foreach (var (propertyName, description) in fields)
            {
                if (concreteSchema.Properties.TryGetValue(propertyName, out var property))
                    property.Description = description;
            }
        }
    }

    private static IReadOnlyDictionary<string, string> Fields(
        params (string Name, string Description)[] fields) =>
        fields.ToDictionary(field => field.Name, field => field.Description, StringComparer.OrdinalIgnoreCase);
}
