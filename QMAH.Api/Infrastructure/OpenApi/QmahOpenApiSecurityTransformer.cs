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
            Description = "ASP.NET Core Identity 登入 Cookie"
        };

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
        var controller = context.Description.ActionDescriptor.RouteValues["controller"];
        var action = context.Description.ActionDescriptor.RouteValues["action"];
        if (controller == "SocialMedia" && action == "Upload")
            ConfigureMediaUpload(operation);

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
            new OpenApiResponse { Description = "尚未登入或登入狀態已失效" });
        operation.Responses.TryAdd(
            StatusCodes.Status403Forbidden.ToString(),
            new OpenApiResponse { Description = "目前帳號沒有執行此操作的權限" });

        return Task.CompletedTask;
    }

    private static void ConfigureMediaUpload(OpenApiOperation operation)
    {
        operation.RequestBody = new OpenApiRequestBody
        {
            Required = true,
            Description = "使用 multipart/form-data 上傳圖片與替代文字",
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
                                Description = "JPEG、PNG、GIF 或 WebP 圖片，最大 8 MB"
                            },
                            ["altText"] = new OpenApiSchema
                            {
                                Type = JsonSchemaType.String,
                                MaxLength = 200,
                                Description = "圖片替代文字"
                            }
                        }
                    }
                }
            }
        };
        operation.Responses ??= new OpenApiResponses();
        operation.Responses.TryAdd("413", new OpenApiResponse { Description = "上傳檔案超過 8 MB" });
    }
}
