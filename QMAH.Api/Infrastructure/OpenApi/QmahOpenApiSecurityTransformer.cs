using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace QMAH.Api.Infrastructure.OpenApi;

/// <summary>
/// 將 Identity Cookie 驗證資訊補入 OpenAPI 契約
/// </summary>
public sealed class QmahOpenApiSecurityTransformer(
    string authenticationCookieName,
    QmahOpenApiOptions settings) :
    IOpenApiDocumentTransformer,
    IOpenApiOperationTransformer
{
    private const string SecuritySchemeName = "qmahCookie";

    /// <summary>
    /// 補入文件資訊與 Cookie 驗證方式
    /// </summary>
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        document.Info.Title = settings.Title;
        document.Info.Version = settings.Version;
        document.Info.Description = "QMAH 前台使用的版本化 REST API";

        if (!string.IsNullOrWhiteSpace(settings.ServerUrl)
            && Uri.TryCreate(settings.ServerUrl, UriKind.Absolute, out var serverUri))
        {
            document.Servers =
            [
                new OpenApiServer
                {
                    Url = serverUri.ToString().TrimEnd('/'),
                    Description = "設定的公開 API 網址"
                }
            ];
        }

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??=
            new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[SecuritySchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            In = ParameterLocation.Cookie,
            Name = authenticationCookieName,
            Description = "ASP.NET Core Identity（登入與會員驗證元件）的 Cookie（瀏覽器保存的小型資料）"
        };
        ConfigureProblemDetailsSchema(document);
        QmahOpenApiSchemaCatalog.Apply(document);

        return Task.CompletedTask;
    }

    /// <summary>
    /// 依授權 Metadata 標示需要登入的 API
    /// </summary>
    public Task TransformAsync(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        var controller = context.Description.ActionDescriptor.RouteValues["controller"] ?? "API";
        var action = context.Description.ActionDescriptor.RouteValues["action"] ?? "Operation";
        var operationKey = $"{controller}.{action}";
        if (QmahOpenApiOperationCatalog.TryGet(controller, action, out var operationInfo))
        {
            operation.OperationId ??= $"{controller}_{action}";
            operation.Summary = operationInfo.Summary;
            operation.Description = operationInfo.Description;
        }

        ConfigureParameters(operation, operationKey);
        ConfigureRequestBody(operation, operationKey);
        ConfigureResponses(operation, context, operationKey);
        if (controller == "SocialMedia" && action == "Upload")
            ConfigureMediaUpload(operation, context.Document!);

        var endpointMetadata = context.Description.ActionDescriptor.EndpointMetadata;
        var allowsAnonymous = endpointMetadata.OfType<IAllowAnonymous>().Any();
        var requiresAuthorization = endpointMetadata.OfType<IAuthorizeData>().Any();
        if (allowsAnonymous || !requiresAuthorization)
            return Task.CompletedTask;

        operation.Security ??= [];
        operation.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(
                SecuritySchemeName,
                context.Document,
                externalResource: null)] = []
        });

        operation.Responses ??= new OpenApiResponses();
        operation.Responses.TryAdd(
            StatusCodes.Status401Unauthorized.ToString(),
            CreateProblemResponse(context.Document!, "尚未登入或登入狀態已失效"));
        operation.Responses.TryAdd(
            StatusCodes.Status403Forbidden.ToString(),
            CreateProblemResponse(context.Document!, "目前帳號沒有執行此操作的權限"));

        return Task.CompletedTask;
    }

    private static void ConfigureResponses(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        string operationKey)
    {
        operation.Responses ??= new OpenApiResponses();

        AddProblemResponse(operation.Responses, "400", "請求資料格式錯誤、欄位驗證失敗或流程條件不符合", context.Document!);
        AddProblemResponse(operation.Responses, "500", "服務發生未預期錯誤", context.Document!);
        if (operationKey.Equals("Account.Login", StringComparison.OrdinalIgnoreCase))
            AddProblemResponse(operation.Responses, "503", "目前無法連線到 QMAH 資料庫", context.Document!);

        var relativePath = context.Description.RelativePath ?? string.Empty;
        if (relativePath.Contains('{'))
            AddProblemResponse(operation.Responses, "404", "找不到指定資源，或資源目前不可見", context.Document!);

        if (ConflictOperations.Contains(operationKey))
            AddProblemResponse(operation.Responses, "409", "請求與現有資料或目前流程狀態衝突", context.Document!);

        if (operationKey.StartsWith("Account.", StringComparison.OrdinalIgnoreCase))
            AddProblemResponse(operation.Responses, "429", "短時間內請求過多，稍後再試", context.Document!);

        var successStatus = SuccessStatuses.TryGetValue(operationKey, out var status)
            ? status
            : "200";
        if (successStatus == "204")
        {
            operation.Responses.Remove("200");
            AddResponse(operation.Responses, "204", GetSuccessResponseDescription(operationKey, successStatus));
        }
        else if (successStatus is "201" or "202"
            && operation.Responses.TryGetValue("200", out var generatedResponse))
        {
            operation.Responses.Remove("200");
            if (generatedResponse is OpenApiResponse response)
                response.Description = GetSuccessResponseDescription(operationKey, successStatus);
            operation.Responses.TryAdd(successStatus, generatedResponse);
        }
        else
        {
            if (operation.Responses.TryGetValue("200", out var existingResponse)
                && existingResponse is OpenApiResponse response)
            {
                response.Description = GetSuccessResponseDescription(operationKey, successStatus);
            }
            else
            {
                AddResponse(operation.Responses, "200", GetSuccessResponseDescription(operationKey, successStatus));
            }
        }
    }

    private static void AddResponse(OpenApiResponses responses, string statusCode, string description) =>
        responses.TryAdd(statusCode, new OpenApiResponse { Description = description });

    private static void AddProblemResponse(
        OpenApiResponses responses,
        string statusCode,
        string description,
        OpenApiDocument document) =>
        responses.TryAdd(statusCode, CreateProblemResponse(document, description));

    private static OpenApiResponse CreateProblemResponse(OpenApiDocument document, string description) =>
        new()
        {
            Description = description,
            Content = new Dictionary<string, OpenApiMediaType>
            {
                ["application/problem+json"] = new()
                {
                    Schema = new OpenApiSchemaReference(
                        "ProblemDetails",
                        document,
                        externalResource: null)
                }
            }
        };

    private static void ConfigureProblemDetailsSchema(OpenApiDocument document)
    {
        document.Components!.Schemas ??= new Dictionary<string, IOpenApiSchema>();
        document.Components.Schemas.TryAdd(
            "ProblemDetails",
            new OpenApiSchema
            {
                Type = JsonSchemaType.Object,
                Description = "RFC 7807（標準錯誤格式規格）錯誤回應；欄位驗證錯誤可能另外包含 errors（欄位錯誤清單）物件",
                Properties = new Dictionary<string, IOpenApiSchema>
                {
                    ["type"] = new OpenApiSchema
                    {
                        Type = JsonSchemaType.String,
                        Format = "uri-reference",
                        Description = "type（錯誤類型識別網址）"
                    },
                    ["title"] = new OpenApiSchema
                    {
                        Type = JsonSchemaType.String,
                        Description = "title（錯誤標題）"
                    },
                    ["status"] = new OpenApiSchema
                    {
                        Type = JsonSchemaType.Integer,
                        Format = "int32",
                        Description = "status（HTTP 狀態碼）"
                    },
                    ["detail"] = new OpenApiSchema
                    {
                        Type = JsonSchemaType.String,
                        Description = "detail（適合顯示給呼叫端的錯誤說明）"
                    },
                    ["instance"] = new OpenApiSchema
                    {
                        Type = JsonSchemaType.String,
                        Format = "uri-reference",
                        Description = "instance（發生錯誤的請求網址）"
                    },
                    ["errors"] = new OpenApiSchema
                    {
                        Type = JsonSchemaType.Object,
                        Description = "errors（欄位錯誤清單）；鍵為欄位名稱，值為驗證訊息陣列",
                        AdditionalProperties = new OpenApiSchema
                        {
                            Type = JsonSchemaType.Array,
                            Items = new OpenApiSchema { Type = JsonSchemaType.String }
                        }
                    }
                }
            });
    }

    private static void ConfigureParameters(OpenApiOperation operation, string operationKey)
    {
        foreach (var parameter in operation.Parameters ?? [])
        {
            if (string.IsNullOrWhiteSpace(parameter.Name)
                || !string.IsNullOrWhiteSpace(parameter.Description))
            {
                continue;
            }

            var description = GetParameterDescription(operationKey, parameter);
            if (!string.IsNullOrWhiteSpace(description))
                parameter.Description = description;
        }
    }

    private static string? GetParameterDescription(string operationKey, IOpenApiParameter parameter)
    {
        if (parameter.In == ParameterLocation.Path)
        {
            return (operationKey, parameter.Name) switch
            {
                ("Catalog.GetArtifact", "id") => "文物 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Game.GetRoom", "id") or ("Game.GetRoomHistory", "id") or ("Game.JoinRoom", "id") => "遊戲房間 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Game.GetRound", "id") or ("Game.SubmitAnswer", "id") or ("Game.SubmitVote", "id") => "遊戲回合 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Social.GetPost", "id") => "社群貼文 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Social.GetEvent", "id") or ("Social.RegisterEvent", "id") or ("Social.CancelEventRegistration", "id") => "活動 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Social.CreateComment", "postId") => "要留言的社群貼文 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("SocialMedia.GetContent", "id") or ("SocialMedia.Delete", "id") => "社群圖片 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("StoreCatalog.GetProduct", "id") => "商品 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("StoreOrders.CancelOrder", "id") => "訂單 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("StoreReviews.GetReviews", "productId") or ("StoreReviews.GetMyReview", "productId") or
                    ("StoreReviews.UpsertMyReview", "productId") or ("StoreReviews.DeleteMyReview", "productId") => "商品 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Me.GetOrder", "id") => "訂單 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Me.UpdateCartItem", "productId") or ("Me.RemoveCartItem", "productId") => "商品 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Me.UpdateAddress", "id") or ("Me.DeleteAddress", "id") or ("Me.SetDefaultAddress", "id") => "會員地址 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                ("Me.MarkNotificationRead", "id") => "會員通知 Id（資源識別碼），GUID（全域唯一識別碼）格式",
                _ => "資源 Id（資源識別碼），GUID（全域唯一識別碼）格式"
            };
        }

        if (parameter.In != ParameterLocation.Query)
            return null;

        return (operationKey, parameter.Name) switch
        {
            (_, "page") => "頁碼，從 1 開始，預設為 1",
            ("StoreReviews.GetReviews", "pageSize") => "每頁評價筆數，範圍 1 至 100，預設為 10",
            (_, "pageSize") => "每頁筆數，範圍 1 至 100，預設為 20",
            ("Catalog.GetArtifacts", "q") => "搜尋文物名稱、故宮編號或原始年代文字",
            ("Catalog.GetArtifacts", "categoryCode") => "文物分類 code（系統代碼）",
            ("Catalog.GetArtifacts", "eraCode") => "文物年代 code（系統代碼）",
            ("StoreCatalog.GetProducts", "q") => "搜尋商品名稱或 ExternalRef（外部商品編號）",
            ("StoreCatalog.GetProducts", "categoryCode") => "商品分類 code（系統代碼）",
            ("StoreCatalog.GetProducts", "artifactId") => "關聯文物 Id（資源識別碼），GUID（全域唯一識別碼）格式",
            ("Social.GetPosts", "q") => "搜尋貼文標題或內容",
            ("Social.GetPosts", "boardCode") => "社群板塊 code（系統代碼）",
            ("Social.GetPosts", "postType") => "貼文類型：POST、ANNOUNCEMENT 或 EVENT",
            ("Social.GetPosts", "artifactId") => "關聯文物 Id（資源識別碼），GUID（全域唯一識別碼）格式",
            ("Game.GetRooms", "status") => "房間狀態：WAITING、PLAYING 或 COMPLETED；未指定時為 WAITING",
            _ => null
        };
    }

    private static readonly IReadOnlyDictionary<string, string> RequestBodyDescriptions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Account.Login"] = "request body（請求本文，送出的 JSON 內容）：包含 `Email`（會員電子郵件）、`Password`（會員密碼）與 `RememberMe`（記住登入）",
            ["Account.Register"] = "request body（請求本文，送出的 JSON 內容）：包含 `Email`（會員電子郵件）、`Nickname`（會員顯示名稱）、`Password`（會員密碼）與 `ConfirmPassword`（再次輸入的會員密碼）",
            ["Account.ForgotPassword"] = "request body（請求本文，送出的 JSON 內容）：包含 `Email`（會員電子郵件）",
            ["Account.ResetPassword"] = "request body（請求本文，送出的 JSON 內容）：包含 `Email`（會員電子郵件）、`Token`（密碼重設驗證字串）、`NewPassword`（新會員密碼）與 `ConfirmPassword`（再次輸入的新密碼）",
            ["StoreReviews.UpsertMyReview"] = "request body（請求本文，送出的 JSON 內容）：包含 `Rating`（星等，1 至 5）與 `Content`（評價內容）",
            ["Social.CreateEvent"] = "request body（請求本文，送出的 JSON 內容）：包含 `EventType`（活動類型系統代碼）、活動內容、時間、地點與 `PostContentMode`（活動貼文內容模式）",
            ["Social.CreatePost"] = "request body（請求本文，送出的 JSON 內容）：包含 `PostType`（貼文類型系統代碼）、`BoardCode`（社群板塊系統代碼）、標題、內容與選填關聯",
            ["Social.CreateComment"] = "request body（請求本文，送出的 JSON 內容）：包含 `Content`（留言內容）與選填 `ParentCommentId`（父留言資源識別碼）",
            ["Social.CreateReport"] = "request body（請求本文，送出的 JSON 內容）：包含 `TargetType`（被檢舉內容類型系統代碼）、`TargetId`（被檢舉內容資源識別碼）與 `Reason`（檢舉原因）",
            ["Game.CreateRoom"] = "request body（請求本文，送出的 JSON 內容）：包含 `Visibility`（房間可見範圍）、玩家顯示名稱與回合規則",
            ["Game.JoinRoom"] = "request body（請求本文，送出的 JSON 內容）：包含 `DisplayName`（遊戲中顯示名稱）與選填 `Password`（私人房間密碼）",
            ["Game.SubmitAnswer"] = "request body（請求本文，送出的 JSON 內容）：包含 `AnswerType`（答案類型系統代碼）與 `Text`（玩家送出的答案文字）",
            ["Game.SubmitVote"] = "request body（請求本文，送出的 JSON 內容）：包含 `AnswerId`（答案資源識別碼）與 `Count`（投票數量）",
            ["Me.UpdateProfile"] = "request body（請求本文，送出的 JSON 內容）：包含 `Nickname`（會員顯示名稱）、`Bio`（會員自我介紹）與 `Visibility`（個人資料可見範圍）",
            ["Me.AddCartItem"] = "request body（請求本文，送出的 JSON 內容）：包含 `ProductId`（商品資源識別碼）與 `Quantity`（購買數量）",
            ["Me.UpdateCartItem"] = "request body（請求本文，送出的 JSON 內容）：包含 `Quantity`（購物車商品數量）",
            ["Me.CreateAddress"] = "request body（請求本文，送出的 JSON 內容）：包含收件人、地址與選填 `Latitude`（緯度）／`Longitude`（經度）",
            ["Me.UpdateAddress"] = "request body（請求本文，送出的 JSON 內容）：包含要更新的收件人、地址與選填 `Latitude`（緯度）／`Longitude`（經度）",
            ["StoreOrders.CreateOrder"] = "request body（請求本文，送出的 JSON 內容）：包含商品明細、優惠券、`PointsUsed`（使用點數）與配送資料"
        };

    private static void ConfigureRequestBody(OpenApiOperation operation, string operationKey)
    {
        if (operation.RequestBody is null
            || !RequestBodyDescriptions.TryGetValue(operationKey, out var description))
        {
            return;
        }

        operation.RequestBody.Description = description;
    }

    private static readonly IReadOnlyDictionary<string, string> SuccessResponseDescriptions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Account.GetAntiforgeryToken"] = "已建立防偽請求 Cookie（瀏覽器保存的小型資料），不回傳 response body（回應本文）",
            ["Account.Login"] = "已建立會員登入狀態，不回傳 response body（回應本文）",
            ["Account.Logout"] = "已清除會員登入狀態，不回傳 response body（回應本文）",
            ["Account.Register"] = "已建立會員並回傳新會員識別碼",
            ["Account.ForgotPassword"] = "已接受密碼重設通知處理",
            ["Account.ResetPassword"] = "已更新會員密碼，不回傳 response body（回應本文）",
            ["AdminDashboard.GetDashboard"] = "回傳管理儀表板的會員、內容、訂單與營運統計",
            ["Metadata.GetMetadata"] = "回傳前台表單與篩選器使用的選項資料",
            ["Catalog.GetArtifacts"] = "回傳符合條件的文物分頁清單",
            ["Catalog.GetArtifact"] = "回傳指定文物的詳情與圖片資訊",
            ["Catalog.GetCategories"] = "回傳依名稱排序的文物分類清單",
            ["Catalog.GetEras"] = "回傳依年代排序的文物年代清單",
            ["StoreCatalog.GetProducts"] = "回傳符合條件的上架商品分頁清單",
            ["StoreCatalog.GetProduct"] = "回傳指定商品的價格、庫存、圖片與評價摘要",
            ["StoreReviews.GetReviews"] = "回傳商品評價分頁清單與評價統計",
            ["StoreReviews.GetMyReview"] = "回傳目前會員對指定商品的評價",
            ["StoreReviews.UpsertMyReview"] = "回傳新增或更新後的商品評價",
            ["StoreReviews.DeleteMyReview"] = "已標記商品評價為刪除，不回傳 response body（回應本文）",
            ["Social.GetPosts"] = "回傳符合條件的公開貼文分頁清單",
            ["Social.GetPost"] = "回傳公開貼文、留言與可用圖片",
            ["Social.GetEvents"] = "回傳已發布活動分頁清單與報名人數",
            ["Social.GetEvent"] = "回傳已發布活動詳情與目前會員報名狀態",
            ["Social.CreateEvent"] = "已建立活動與對應貼文，並回傳活動詳情",
            ["Social.RegisterEvent"] = "已建立活動報名紀錄，並回傳更新後的活動詳情",
            ["Social.CancelEventRegistration"] = "已取消活動報名，並回傳更新後的活動詳情",
            ["Social.GetAnnouncements"] = "回傳已發布公告的分頁清單",
            ["Social.CreatePost"] = "已建立社群貼文，並回傳貼文詳情",
            ["Social.CreateComment"] = "已建立貼文留言，並回傳留言資料",
            ["Social.CreateReport"] = "已接受社群內容檢舉處理",
            ["SocialMedia.Upload"] = "已建立社群圖片資料，並回傳媒體資訊與受控網址",
            ["SocialMedia.GetContent"] = "回傳社群圖片檔案內容",
            ["SocialMedia.Delete"] = "已標記社群圖片為刪除，不回傳 response body（回應本文）",
            ["Game.GetRooms"] = "回傳符合條件的公開遊戲房間分頁清單",
            ["Game.GetRoom"] = "回傳遊戲房間詳情與參與玩家",
            ["Game.GetRoomHistory"] = "回傳遊戲房間回合歷程與排行榜",
            ["Game.CreateRoom"] = "已建立遊戲房間，並回傳房間詳情",
            ["Game.JoinRoom"] = "已加入遊戲房間，並回傳更新後的房間詳情",
            ["Game.SubmitAnswer"] = "已建立目前回合的作答資料",
            ["Game.SubmitVote"] = "已接受目前回合的投票處理",
            ["Game.GetRound"] = "回傳遊戲回合題目、作答、投票與結算資料",
            ["Me.GetMe"] = "回傳目前會員的帳號、Profile（會員資料）與角色資訊",
            ["Me.UpdateProfile"] = "回傳更新後的會員 Profile（會員資料）",
            ["Me.GetOrders"] = "回傳目前會員的訂單分頁清單",
            ["Me.GetOrder"] = "回傳目前會員指定訂單的完整明細",
            ["Me.GetCoupons"] = "回傳目前會員的優惠券與使用狀態",
            ["Me.GetPosts"] = "回傳目前會員建立的貼文分頁清單",
            ["Me.GetAchievements"] = "回傳目前會員已取得的成就清單",
            ["Me.GetCart"] = "回傳目前會員購物車的商品與小計",
            ["Me.AddCartItem"] = "已加入或更新購物車商品，並回傳購物車項目",
            ["Me.UpdateCartItem"] = "已更新購物車商品數量，並回傳購物車項目",
            ["Me.RemoveCartItem"] = "已移除購物車商品，不回傳 response body（回應本文）",
            ["Me.GetAddresses"] = "回傳目前會員的收件地址清單",
            ["Me.CreateAddress"] = "已建立收件地址，並回傳地址資料",
            ["Me.UpdateAddress"] = "回傳更新後的收件地址資料",
            ["Me.DeleteAddress"] = "已刪除收件地址，不回傳 response body（回應本文）",
            ["Me.SetDefaultAddress"] = "回傳設定為預設的收件地址資料",
            ["Me.GetNotifications"] = "回傳目前會員的通知分頁清單",
            ["Me.MarkNotificationRead"] = "已標記通知為已讀，不回傳 response body（回應本文）",
            ["StoreOrders.CreateOrder"] = "已建立商城訂單，並回傳訂單資料",
            ["StoreOrders.CancelOrder"] = "已取消商城訂單，不回傳 response body（回應本文）"
        };

    private static string GetSuccessResponseDescription(string operationKey, string statusCode) =>
        SuccessResponseDescriptions.TryGetValue(operationKey, out var description)
            ? description
            : statusCode switch
            {
                "201" => "已建立資源並回傳建立結果",
                "202" => "已接受後續處理",
                "204" => "操作成功且沒有 response body（回應本文）",
                _ => "請求成功並回傳資料"
            };

    private static readonly IReadOnlyDictionary<string, string> SuccessStatuses =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Account.GetAntiforgeryToken"] = "204", ["Account.Login"] = "204",
            ["Account.Logout"] = "204", ["Account.Register"] = "201",
            ["Account.ForgotPassword"] = "202", ["Account.ResetPassword"] = "204",
            ["Game.CreateRoom"] = "201", ["Game.SubmitVote"] = "202",
            ["Me.CreateAddress"] = "201", ["Me.RemoveCartItem"] = "204",
            ["Me.DeleteAddress"] = "204", ["Me.MarkNotificationRead"] = "204",
            ["Social.CreateEvent"] = "201", ["Social.CreatePost"] = "201",
            ["Social.CreateComment"] = "201", ["Social.CreateReport"] = "202",
            ["SocialMedia.Upload"] = "201", ["SocialMedia.Delete"] = "204",
            ["StoreOrders.CreateOrder"] = "201", ["StoreOrders.CancelOrder"] = "204",
            ["StoreReviews.DeleteMyReview"] = "204"
        };

    private static readonly IReadOnlySet<string> ConflictOperations =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Account.Register", "Game.CreateRoom", "Game.JoinRoom", "Game.SubmitAnswer", "Game.SubmitVote",
            "Social.CreateEvent", "Social.RegisterEvent", "Social.CancelEventRegistration", "Social.CreatePost",
            "Social.CreateComment", "Social.CreateReport", "Me.AddCartItem", "Me.UpdateCartItem",
            "Me.CreateAddress", "Me.UpdateAddress", "Me.SetDefaultAddress", "StoreOrders.CreateOrder",
            "StoreOrders.CancelOrder", "StoreReviews.UpsertMyReview"
        };

    private static void ConfigureMediaUpload(OpenApiOperation operation, OpenApiDocument document)
    {
        operation.RequestBody = new OpenApiRequestBody
        {
            Required = true,
            Description = "使用 multipart/form-data（表單檔案上傳格式）傳送 file（檔案欄位）與 altText（圖片替代文字）",
            Content = new Dictionary<string, OpenApiMediaType>
            {
                ["multipart/form-data"] = new()
                {
                    Schema = new OpenApiSchema
                    {
                        Type = JsonSchemaType.Object,
                        Required = new HashSet<string> { "file" },
                        Properties = new Dictionary<string, IOpenApiSchema>
                        {
                            ["file"] = new OpenApiSchema
                            {
                                Type = JsonSchemaType.String,
                                Format = "binary",
                                 Description = "file（檔案欄位）：JPEG、PNG、GIF 或 WebP 圖片的 binary（原始檔案內容），最大 8 MB"
                            },
                            ["altText"] = new OpenApiSchema
                            {
                                Type = JsonSchemaType.String,
                                MaxLength = 200,
                                 Description = "altText（圖片替代文字），最多 200 個字元"
                            }
                        }
                    }
                }
            }
        };
        operation.Responses ??= new OpenApiResponses();
        operation.Responses.TryAdd("413", CreateProblemResponse(document, "上傳檔案超過 8 MB"));
    }
}
