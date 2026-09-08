using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Catalog.ViewModel;

/// <summary>
/// 管理員調整會員鑰匙時使用的輸入模型；餘額由後端重新讀取，表單不能直接指定結果值。
/// </summary>
public sealed class KeyAdjustViewModel
{
    public Guid UserId { get; set; }

    public Guid KeyDefinitionId { get; set; }

    public string MemberName { get; set; } = string.Empty;

    public string KeyName { get; set; } = string.Empty;

    public string KeyCode { get; set; } = string.Empty;

    public int CurrentBalance { get; set; }

    public bool IsKeyActive { get; set; }

    [Required]
    public string Operation { get; set; } = "ADD";

    [Range(1, 1000000, ErrorMessage = "調整數量必須介於 1 至 1,000,000")]
    public int UnitAmount { get; set; } = 1;

    [Required(ErrorMessage = "請輸入調整原因")]
    [StringLength(40, ErrorMessage = "調整原因不可超過 40 個字元")]
    public string Reason { get; set; } = string.Empty;
}
