using System;
using System.Collections.Generic;

namespace QMAH.Web.Models.Entities;

public partial class CouponDefinition
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string DiscountType { get; set; } = null!;

    public decimal DiscountValue { get; set; }

    public decimal MinimumAmount { get; set; }

    public DateTime StartAt { get; set; }

    public DateTime EndAt { get; set; }

    public bool IsActive { get; set; }

    public virtual ICollection<UserCoupon> UserCoupons { get; set; } = new List<UserCoupon>();
}