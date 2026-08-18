using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public sealed class CouponEditViewModel
{
    public Guid Id { get; set; }

    [Required(ErrorMessage = "請輸入優惠券代碼")]
    [StringLength(50)]
    [Display(Name = "優惠券代碼")]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入優惠券名稱")]
    [StringLength(100)]
    [Display(Name = "優惠券名稱")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入折扣類型")]
    [StringLength(20)]
    [Display(Name = "折扣類型")]
    public string DiscountType { get; set; } = "FIXED";

    [Range(0, 999999999, ErrorMessage = "折扣值不可小於 0")]
    [Display(Name = "折扣值")]
    public decimal DiscountValue { get; set; }

    [Range(0, 999999999, ErrorMessage = "最低消費不可小於 0")]
    [Display(Name = "最低消費")]
    public decimal MinimumAmount { get; set; }

    [Display(Name = "開始時間")]
    public DateTime StartAt { get; set; } = DateTime.Now;

    [Display(Name = "結束時間")]
    public DateTime EndAt { get; set; } = DateTime.Now.AddMonths(1);

    [Display(Name = "啟用")]
    public bool IsActive { get; set; } = true;
}
