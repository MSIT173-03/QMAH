using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

/// <summary>管理員強制解鎖文物的結果；Created 為 false 代表原本已解鎖。</summary>
public sealed record AdminArtifactUnlockDto(
    Guid UserId,
    Guid ArtifactId,
    bool Created,
    string UnlockMethod,
    DateTime UnlockedAt);

/// <summary>管理員設定商品單品折扣率；有效售價由後端依商品定價計算。</summary>
public sealed class UpdateProductDiscountRequest
{
    [Required]
    [Range(typeof(decimal), "0", "100")]
    public decimal? DiscountRate { get; set; }
}

/// <summary>管理員以同一折扣率批次更新商品；單次最多處理 100 件商品。</summary>
public sealed class BatchUpdateProductDiscountRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(100)]
    public List<Guid>? ProductIds { get; set; }

    [Required]
    [Range(typeof(decimal), "0", "100")]
    public decimal? DiscountRate { get; set; }
}

/// <summary>
/// 管理員指定單品折扣後售價；null 代表清除指定售價並回到 Price。
/// 提供數值時，後端會將 DiscountRate 歸零，避免兩個可寫來源同時生效。
/// </summary>
public sealed class UpdateProductSalePriceRequest
{
    [Range(typeof(decimal), "0.01", "9999999999")]
    public decimal? SalePrice { get; set; }
}

/// <summary>批次指定單品折扣後售價；單次最多處理 100 件商品。</summary>
public sealed class BatchUpdateProductSalePriceRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(100)]
    public List<Guid>? ProductIds { get; set; }

    [Range(typeof(decimal), "0.01", "9999999999")]
    public decimal? SalePrice { get; set; }
}

/// <summary>管理員更新商品折扣後的唯讀結果；SalePrice 可能是指定價或折扣率計算出的顯示售價。</summary>
public sealed record AdminProductDiscountDto(
    Guid Id,
    decimal Price,
    decimal DiscountRate,
    decimal EffectivePrice,
    decimal? SalePrice);
