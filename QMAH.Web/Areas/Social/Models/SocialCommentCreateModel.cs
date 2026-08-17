using System;
using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models;

public class SocialCommentCreateModel
{
    [Required]
    public Guid PostId { get; set; }

    [Required(ErrorMessage = "請輸入留言內容")]
    [StringLength(2000, ErrorMessage = "留言不能超過 2000 字")]
    public string Content { get; set; } = string.Empty;
}
