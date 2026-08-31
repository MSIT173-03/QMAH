using System;
using System.Collections.Generic;

namespace QMAH.Infrastructure.Models.Entities;

public partial class UserCoupon
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid CouponDefinitionId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime IssuedAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public virtual CouponDefinition CouponDefinition { get; set; } = null!;

    public virtual ICollection<StoreOrder> StoreOrders { get; set; } = new List<StoreOrder>();
}