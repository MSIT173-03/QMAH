using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Catalog.ViewModel;

/// <summary>管理員編輯鑰匙兌換比例時使用的表單模型。</summary>
public sealed class KeyExchangeEditViewModel
{
    public Guid Id { get; set; }

    [Required(ErrorMessage = "請選擇來源鑰匙。")]
    public Guid SourceKeyDefinitionId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "來源數量必須大於 0。")]
    public int SourceAmount { get; set; } = 2;

    [Required(ErrorMessage = "請選擇目標鑰匙。")]
    public Guid TargetKeyDefinitionId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "目標數量必須大於 0。")]
    public int TargetAmount { get; set; } = 1;

    [Range(0, int.MaxValue, ErrorMessage = "排序不可小於 0。")]
    public int SortOrder { get; set; }

    [StringLength(300, ErrorMessage = "說明不可超過 300 個字元。")]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public byte[] RowVersion { get; set; } = [];
}
