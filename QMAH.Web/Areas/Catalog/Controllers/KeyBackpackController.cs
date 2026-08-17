using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;


[Area("Catalog")]
[AdminNavigation("玩家鑰匙背包一覽", order: 10)]
public class KeyBackPackController : Controller
{

    private readonly QmahDbContext _db;
    public KeyBackPackController(QmahDbContext db)
    {
        _db = db;
    }


    public async Task<ActionResult> Index(CancellationToken cancellationToken)
    {
        IEnumerable<UserKeyBalance> datas_ukb = null;

        var ukb = await _db.UserKeyBalances
            .AsNoTracking()
            .Include(UserKeyBalances => UserKeyBalances.KeyDefinition)
            .OrderBy(UserKeyBalances => UserKeyBalances.UserId)
            .ToListAsync(cancellationToken);

        datas_ukb = from t in ukb
                    select t;

        return View(datas_ukb);
    }
}
