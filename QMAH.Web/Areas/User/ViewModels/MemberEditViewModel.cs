using Microsoft.AspNetCore.Http;

namespace QMAH.Web.Areas.User.ViewModels;

public class MemberEditViewModel
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = "";

    public string Nickname { get; set; } = "";

    public string? Bio { get; set; }

    // 資料庫目前儲存的頭像路徑
    public string? AvatarPath { get; set; }

    // 使用者這次選擇要上傳的圖片
    public IFormFile? AvatarFile { get; set; }

    public string Visibility { get; set; } = "";

    public byte[] RowVersion { get; set; } = null!;
}