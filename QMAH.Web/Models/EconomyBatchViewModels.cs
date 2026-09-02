using System.ComponentModel.DataAnnotations;

using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Web.Models;

/// <summary>
/// 營運中心批次資產活動頁面的表單與預覽結果。
/// </summary>
public sealed class EconomyBatchPageViewModel
{
    [Required]
    public string AssetType { get; set; } = "POINT";

    [Required]
    public string Operation { get; set; } = "ADD";

    [Range(1, 1_000_000, ErrorMessage = "每位會員的異動數量必須大於 0。")]
    public int UnitAmount { get; set; } = 10;

    public Guid? CouponDefinitionId { get; set; }

    [Required(ErrorMessage = "批次原因必須填寫。")]
    [StringLength(200, ErrorMessage = "批次原因不可超過 200 個字元。")]
    public string Reason { get; set; } = string.Empty;

    [StringLength(100, ErrorMessage = "會員搜尋文字不可超過 100 個字元。")]
    [Display(Name = "會員搜尋")]
    public string? Keyword { get; set; }

    [Display(Name = "會員角色")]
    public string? Role { get; set; }

    [Display(Name = "會員狀態")]
    public string? Status { get; set; } = "ACTIVE";

    [DataType(DataType.Date)]
    [Display(Name = "建立日期起")]
    public DateTime? CreatedFrom { get; set; }

    [DataType(DataType.Date)]
    [Display(Name = "建立日期迄")]
    public DateTime? CreatedTo { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "點數最低值不可小於 0。")]
    [Display(Name = "目前點數最低")]
    public int? MinPointBalance { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "點數最高值不可小於 0。")]
    [Display(Name = "目前點數最高")]
    public int? MaxPointBalance { get; set; }

    /// <summary>執行按鈕的第二道確認；正式執行時服務仍會重新套用所有條件。</summary>
    public bool Confirm { get; set; }

    public bool HasPreview { get; set; }
    public int PreviewCount { get; set; }
    public string? PreviewCouponName { get; set; }
    public IReadOnlyList<BulkMemberPreview> PreviewMembers { get; set; } = [];
    public string? ExecutionError { get; set; }
    public IReadOnlyList<EconomyBatchListItemViewModel> RecentBatches { get; set; } = [];

    public BulkEconomyRequest ToRequest() => new(
        AssetType,
        Operation,
        UnitAmount,
        CouponDefinitionId,
        Reason,
        new BulkMemberFilter(
            Keyword,
            Role,
            Status,
            CreatedFrom,
            CreatedTo,
            MinPointBalance,
            MaxPointBalance));

    public void ApplyPreview(BulkEconomyPreview preview)
    {
        HasPreview = preview.IsValid;
        PreviewCount = preview.TargetCount;
        PreviewCouponName = preview.CouponName;
        PreviewMembers = preview.Sample;
        ExecutionError = preview.Error;
    }
}

public sealed class EconomyBatchListItemViewModel
{
    public Guid Id { get; init; }
    public string AssetType { get; init; } = string.Empty;
    public string Operation { get; init; } = string.Empty;
    public int UnitAmount { get; init; }
    public string? CouponName { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int TargetCount { get; init; }
    public int SucceededCount { get; init; }
    public int FailedCount { get; init; }
    public long AffectedAssetCount { get; init; }
    public string? FailureReason { get; init; }
    public string AdminName { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime? CompletedAt { get; init; }

    public static EconomyBatchListItemViewModel From(BulkEconomyBatchView batch) => new()
    {
        Id = batch.Id,
        AssetType = batch.AssetType,
        Operation = batch.Operation,
        UnitAmount = batch.UnitAmount,
        CouponName = batch.CouponName,
        Reason = batch.Reason,
        Status = batch.Status,
        TargetCount = batch.TargetCount,
        SucceededCount = batch.SucceededCount,
        FailedCount = batch.FailedCount,
        AffectedAssetCount = batch.AffectedAssetCount,
        FailureReason = batch.FailureReason,
        AdminName = batch.AdminName,
        CreatedAt = batch.CreatedAt,
        CompletedAt = batch.CompletedAt
    };
}
