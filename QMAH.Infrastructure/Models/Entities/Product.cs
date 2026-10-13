using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq.Expressions;

namespace QMAH.Infrastructure.Models.Entities;

public partial class Product
{
    public Guid Id { get; set; }

    public Guid? ArtifactId { get; set; }

    public string CategoryCode { get; set; } = null!;

    public string? ExternalRef { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string? SizeText { get; set; }

    public decimal Price { get; set; }

    /// <summary>商品折扣百分比；0 代表沒有單品折扣，100 代表全額折抵。</summary>
    public decimal DiscountRate { get; set; }

    /// <summary>管理員指定的單品折扣後售價；有效值優先於 DiscountRate。</summary>
    public decimal? SalePrice { get; set; }

    /// <summary>
    /// 有效售價的唯一定義：有效的 SalePrice（大於 0 且低於定價）優先，否則依 DiscountRate（夾在 0 到 100）折算，
    /// 四捨五入到小數兩位。寫成運算式是為了讓資料庫查詢（篩選、排序、投影）與記憶體中的
    /// <see cref="EffectivePrice"/> 共用同一份規則，不必在查詢裡另外重寫。
    /// 只能使用 EF Core 可翻譯成 SQL 的寫法：Math.Clamp 與指定 MidpointRounding 的 Math.Round 都不能翻譯，
    /// 而不指定時 C# 是四捨六入五成雙、SQL 是四捨五入，兩邊會不一致；金額不為負，所以用 Floor(x + 0.5) 四捨五入。
    /// </summary>
    public static readonly Expression<Func<Product, decimal>> EffectivePriceExpression = product =>
        product.SalePrice.HasValue && product.SalePrice.Value > 0m && product.SalePrice.Value < product.Price
            ? product.SalePrice.Value
            : Math.Floor(
                product.Price
                    * (100m - (product.DiscountRate < 0m ? 0m : product.DiscountRate > 100m ? 100m : product.DiscountRate))
                    + 0.5m) / 100m;

    private static readonly Func<Product, decimal> ComputeEffectivePrice = EffectivePriceExpression.Compile();

    /// <summary>依定價與折扣率計算的目前有效售價。</summary>
    [NotMapped]
    public decimal EffectivePrice => ComputeEffectivePrice(this);

    public int Stock { get; set; }

    public string? PrimaryImagePath { get; set; }

    public string? SourceUrl { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<CartItem> CartItems { get; set; } = new List<CartItem>();

    public virtual Artifact? Artifact { get; set; }

    public virtual ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();

    public virtual ICollection<ProductReview> ProductReviews { get; set; } = new List<ProductReview>();
}
