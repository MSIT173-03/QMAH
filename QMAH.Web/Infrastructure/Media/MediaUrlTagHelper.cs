using Microsoft.AspNetCore.Razor.TagHelpers;

using QMAH.Infrastructure.Media;

namespace QMAH.Web.Infrastructure.Media;

/// <summary>
/// 讓 Razor（伺服器端頁面）中的公開圖片標籤自動套用本機或 CDN 網址。
/// </summary>
[HtmlTargetElement("img", Attributes = "src")]
[HtmlTargetElement("source", Attributes = "src")]
public sealed class MediaUrlTagHelper(QmahMediaUrlResolver resolver) : TagHelper
{
    [HtmlAttributeName("src")]
    public string? Src { get; set; }

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        if (string.IsNullOrWhiteSpace(Src))
            return;

        output.Attributes.SetAttribute("src", resolver.Resolve(Src));
    }
}
