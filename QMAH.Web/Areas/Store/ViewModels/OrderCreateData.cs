using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderCreateData
{
    [Display(Name = "會員編號")]
    public Guid UserId { get; set; }
    [Display(Name = "訂單狀態")]
    public string Status { get; set; }

    // ----------

    [Display(Name = "使用優惠券")]
    public Guid CouponId { get; set; }
    [Display(Name = "使用點數")]
    public int PointUsed { get; set; }

    // ----------

    [Display(Name = "收件人姓名")]
    public string RecipientName { get; set; }
    [Display(Name = "收件人電話")]
    public string RecipientPhone { get; set; }

    // ----------

    [Display(Name = "寄送城市")]
    public string ShippingCity { get; set; }
    [Display(Name = "寄送縣市")]
    public string ShippingDistrict { get; set; }
    [Display(Name = "寄送地址")]
    public string ShippingAddressLine { get; set; }
    [Display(Name = "寄送郵遞區號")]
    public string ShippingPostalCode { get; set; }
}
