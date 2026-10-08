using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

using QMAH.Api.Controllers.V1;
using QMAH.Api.Infrastructure.Payments;
using QMAH.Api.Services;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

// 綠界付款流程檢查：簽章、設定驗證、callback 與取消狀態機。
// 資料庫以記憶體 SQLite 建立 store 相關資料表，綠界查詢 API 以假的 HttpMessageHandler 回應，不連線任何外部服務。
var ecpay = new EcpayOptions
{
    MerchantId = "2000132",
    HashKey = "5294y06JbISpM5x9",
    HashIv = "v77hoKGq4kWxNNIS",
    CheckoutUrl = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
    QueryTradeInfoUrl = "https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5",
    PublicBaseUrl = "https://api.example.com",
    ClientBaseUrl = "https://www.example.com"
};
var ecpayOptions = Options.Create(ecpay);

// ── 第 4 項：CheckMacValue ──
var sampleOrder = NewOrder(Guid.NewGuid(), "CREDIT_CARD", 1234m);
var form = EcpayCheckoutFormBuilder.Build(EcpayCheckoutFormBuilder.BuildRequestForOrder(sampleOrder)!, ecpay);
var formFields = new Dictionary<string, string>(form.Fields, StringComparer.Ordinal);
Check(EcpayCheckMac.Verify(formFields, ecpay), "送出的表單可以通過驗證（來回測試）");
Check(!EcpayCheckMac.Verify(With(formFields, "TotalAmount", "1"), ecpay), "竄改金額驗證失敗");
Check(!EcpayCheckMac.Verify(With(formFields, "MerchantID", "3002607"), ecpay), "換掉 MerchantID 驗證失敗");
Check(!EcpayCheckMac.Verify(Without(formFields, "CheckMacValue"), ecpay), "缺少 CheckMacValue 驗證失敗");
Check(EcpayCheckMac.Verify(With(formFields, "CheckMacValue", formFields["CheckMacValue"].ToLowerInvariant()), ecpay), "小寫檢查碼也接受");
Check(!EcpayCheckMac.Verify(With(formFields, "CheckMacValue", "00"), ecpay), "長度不符的檢查碼驗證失敗");
var specialChars = new Dictionary<string, string>(formFields) { ["ItemName"] = "A&B <C> (D) 文物 x1" };
specialChars["CheckMacValue"] = EcpayCheckMac.Compute(specialChars, ecpay.HashKey, ecpay.HashIv);
Check(EcpayCheckMac.Verify(specialChars, ecpay), "含 &、<、空白與中文的欄位可以驗證");
Check(WebUtility.UrlEncode("-_.!*() ~") == "-_.!*()+%7E", "WebUtility.UrlEncode 不編碼 -_.!*()，空白轉 +，與綠界規則相同");
// 綠界官方文件「檢查碼機制」的範例資料，確認編碼規則與官方一致。
var officialSample = new Dictionary<string, string>(StringComparer.Ordinal)
{
    ["TradeDesc"] = "促銷方案", ["PaymentType"] = "aio", ["MerchantTradeDate"] = "2013/03/12 15:30:23",
    ["MerchantTradeNo"] = "ecpay20130312153023", ["MerchantID"] = "2000132",
    ["ReturnURL"] = "https://www.ecpay.com.tw/receive.php", ["ItemName"] = "Apple iphone 7 手機殼",
    ["TotalAmount"] = "1000", ["ChoosePayment"] = "ALL", ["EncryptType"] = "1"
};
Check(EcpayCheckMac.Compute(officialSample, ecpay.HashKey, ecpay.HashIv)
    == "CFA9BDE377361FBDD8F160274930E815D1A8A2E3E80CE7D404C45FC9A0A1E407", "官方範例資料算出的檢查碼與文件一致（對照測試）");
Check(form.Fields["ReturnURL"] =="https://api.example.com/api/v1/store/checkout/ecpay-return", "ReturnURL 由 PublicBaseUrl 組成");
Check(form.Fields["ClientBackURL"] == "https://www.example.com/store/orders", "ClientBackURL 指向我的訂單頁");
Check(form.ActionUrl == ecpay.CheckoutUrl && form.Fields["MerchantID"] == ecpay.MerchantId, "商店代號與端點來自設定");
Check(form.Fields["TotalAmount"] == "1234", "表單金額為整數");

// ── 第 3 項：交易編號 ──
var tradeNos = Enumerable.Range(0, 200)
    .Select(_ => EcpayCheckoutFormBuilder.BuildRequestForOrder(sampleOrder)!.MerchantTradeNo)
    .ToList();
Check(tradeNos.Distinct().Count() == tradeNos.Count, "同一秒連續產生的交易編號不重複");
Check(tradeNos.All(no => Regex.IsMatch(no, "^[0-9A-Z]{20}$")), "交易編號為 20 碼英數字");
Check(EcpayCheckoutFormBuilder.BuildRequestForOrder(NewOrder(Guid.NewGuid(), "COD", 100m)) is null, "貨到付款不產生表單");
var cancelledSample = NewOrder(Guid.NewGuid(), "CREDIT_CARD", 100m);
cancelledSample.Status = "CANCELLED";
Check(EcpayCheckoutFormBuilder.BuildRequestForOrder(cancelledSample) is null, "已取消的訂單不產生表單");

// ── 第 1、2 項：設定驗證 ──
var production = new EcpayOptionsValidator(new FakeEnvironment("Production"));
var development = new EcpayOptionsValidator(new FakeEnvironment("Development"));
Check(production.Validate(null, ecpay).Succeeded, "正式環境接受公開 https 網址");
foreach (var bad in new[] { "https://localhost", "http://api.example.com", "https://api.example.com:8443", "https://10.0.0.5", "https://192.168.1.2", "https://127.0.0.1" })
    Check(production.Validate(null, Copy(ecpay, publicBaseUrl: bad)).Failed, $"正式環境拒絕 PublicBaseUrl={bad}");
Check(production.Validate(null, Copy(ecpay, clientBaseUrl: "http://localhost:4200")).Failed, "正式環境拒絕 localhost 前端網址");
Check(development.Validate(null, Copy(ecpay, publicBaseUrl: "https://localhost:7249", clientBaseUrl: "http://localhost:4200")).Succeeded, "開發環境允許本機網址");

// ── 第 3、5、7、8 項：資料庫狀態機 ──
await using var connection = new SqliteConnection("DataSource=:memory:;Foreign Keys=False");
connection.Open();
var dbOptions = new DbContextOptionsBuilder<QmahDbContext>().UseSqlite(connection).Options;
CreateSchema(connection, dbOptions);

var userId = Guid.NewGuid();
var product = new Product
{
    Id = Guid.NewGuid(), CategoryCode = "TEST", Name = "測試商品", Price = 1000m, DiscountRate = 0m,
    Stock = 10, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
};
await using (var db = NewDb())
{
    db.Products.Add(product);
    db.PointBalances.Add(new PointBalance { UserId = userId, Balance = 100, UpdatedAt = DateTime.UtcNow });
    await db.SaveChangesAsync();
}

// 付款成功：訂單轉已付款、點數入帳；重送不重複入帳
var paid = await SeedOrderAsync(userId, "CREDIT_CARD", 1234m);
var attemptA = await AddAttemptAsync(paid);
var attemptB = await AddAttemptAsync(paid);   // 使用者開了兩個付款頁
Check((await ApplyAsync(Success(attemptA, "T001", 1234))).Accepted, "付款成功 callback 被接受");
await using (var db = NewDb())
{
    var order = await db.StoreOrders.Include(o => o.Payment).SingleAsync(o => o.Id == paid);
    Check(order.Status == "PAID" && order.PaidAt is not null, "付款成功後訂單為已付款");
    Check(order.Payment!.Status == "PAID" && order.Payment.EcpayTradeNo == "T001" && order.Payment.RtnCode == 1, "付款紀錄寫入綠界交易編號與 RtnCode");
    Check((await db.PointBalances.SingleAsync(b => b.UserId == userId)).Balance == 112, "回饋點數 floor(1234 × 1%) = 12 入帳");
    Check(await db.PointTransactions.CountAsync(t => t.ReferenceId == paid && t.Reason == "ORDER_REWARD") == 1, "新增 ORDER_REWARD 點數流水");
}
Check((await ApplyAsync(Success(attemptA, "T001", 1234))).Accepted, "重送的 callback 仍回成功");
await using (var db = NewDb())
    Check((await db.PointBalances.SingleAsync(b => b.UserId == userId)).Balance == 112, "重送 callback 不重複入帳");

// 兩個付款頁都付款：第二筆標記需退款，訂單維持第一筆付款
Check((await ApplyAsync(Success(attemptB, "T002", 1234))).Accepted, "第二筆付款 callback 被接受");
await using (var db = NewDb())
{
    var payment = await db.Payments.SingleAsync(p => p.OrderId == paid);
    var second = await db.PaymentAttempts.SingleAsync(a => a.MerchantTradeNo == attemptB);
    Check(payment.Status == "PAID" && payment.EcpayTradeNo == "T001", "重複付款不覆蓋原付款");
    Check(second.Status == "REFUND_REQUIRED" && second.EcpayTradeNo == "T002", "重複付款的付款嘗試標記需人工退款");
    Check((await db.PointBalances.SingleAsync(b => b.UserId == userId)).Balance == 112, "重複付款不重複入帳");
}

// 金額不符、模擬付款、未知編號、付款失敗
var pending = await SeedOrderAsync(userId, "CREDIT_CARD", 500m);
var attemptC = await AddAttemptAsync(pending);
Check(!(await ApplyAsync(Success(attemptC, "T003", 1))).Accepted, "金額不符的 callback 被拒絕");
Check((await ApplyAsync(Success(attemptC, "T003", 500) with { Simulated = true })).Accepted, "模擬付款回成功");
Check(!(await ApplyAsync(Success("UNKNOWN0000000000000", "T004", 500))).Accepted, "未知交易編號被拒絕");
Check((await ApplyAsync(new EcpayPaymentResult(attemptC, false, null, 500, 10100058, "付款失敗", false))).Accepted, "付款失敗 callback 被接受");
await using (var db = NewDb())
{
    var order = await db.StoreOrders.Include(o => o.Payment).SingleAsync(o => o.Id == pending);
    Check(order.Status == "PENDING_PAYMENT" && order.Payment!.Status == "FAILED" && order.Payment.RtnCode == 10100058, "付款失敗時訂單維持待付款、付款記為失敗");
}

// 小額訂單沒有回饋點數，也不寫入金額為 0 的流水
var small = await SeedOrderAsync(userId, "CREDIT_CARD", 50m);
var attemptSmall = await AddAttemptAsync(small);
Check((await ApplyAsync(Success(attemptSmall, "T005", 50))).Accepted, "小額訂單付款成功");
await using (var db = NewDb())
    Check(await db.PointTransactions.CountAsync(t => t.ReferenceId == small) == 0, "回饋 0 點時不寫入點數流水");

// 沒有點數帳戶的會員付款後建立帳戶
var newUser = Guid.NewGuid();
var noBalance = await SeedOrderAsync(newUser, "CREDIT_CARD", 300m);
Check((await ApplyAsync(Success(await AddAttemptAsync(noBalance), "T006", 300))).Accepted, "無點數帳戶的會員付款成功");
await using (var db = NewDb())
    Check((await db.PointBalances.SingleAsync(b => b.UserId == newUser)).Balance == 3, "付款後建立點數帳戶並入帳");

// 第 8 項：取消前查詢綠界
var handler = new FakeEcpayHandler(ecpay);
var unpaid = await SeedOrderAsync(userId, "CREDIT_CARD", 200m, pointsUsed: 5);
var unpaidAttempt = await AddAttemptAsync(unpaid);
handler.Respond = _ => handler.Signed(new() { ["MerchantTradeNo"] = unpaidAttempt, ["TradeStatus"] = "10200047", ["TradeNo"] = "", ["TradeAmt"] = "" });
Check(await CancelAsync(unpaid, userId) == StoreOrderCancelResult.Cancelled, "綠界查無付款時可以取消");
await using (var db = NewDb())
{
    var order = await db.StoreOrders.Include(o => o.Payment).SingleAsync(o => o.Id == unpaid);
    Check(order.Status == "CANCELLED" && order.Payment!.Status == "CANCELLED", "取消後訂單與付款為已取消");
    Check((await db.Products.SingleAsync(p => p.Id == product.Id)).Stock == 11, "取消後歸還庫存");
    Check(await db.PointTransactions.CountAsync(t => t.ReferenceId == unpaid && t.Reason == "ORDER_CANCEL_REFUND" && t.Amount == 5) == 1, "取消後歸還使用的點數");
}
Check(await CancelAsync(unpaid, userId) == StoreOrderCancelResult.AlreadyCancelled, "重複取消回已取消");
Check((await ApplyAsync(Success(unpaidAttempt, "T007", 200))).Accepted, "取消後才付款的 callback 被接受");
await using (var db = NewDb())
{
    var order = await db.StoreOrders.Include(o => o.Payment).SingleAsync(o => o.Id == unpaid);
    Check(order.Status == "CANCELLED" && order.Payment!.Status == "REFUND_REQUIRED", "取消後才付款：訂單維持已取消、付款需人工退款");
}

var paidBeforeCancel = await SeedOrderAsync(userId, "CREDIT_CARD", 400m);
var paidAttempt = await AddAttemptAsync(paidBeforeCancel);
handler.Respond = _ => handler.Signed(new() { ["MerchantTradeNo"] = paidAttempt, ["TradeStatus"] = "1", ["TradeNo"] = "T008", ["TradeAmt"] = "400" });
Check(await CancelAsync(paidBeforeCancel, userId) == StoreOrderCancelResult.AlreadyPaid, "綠界已付款時不取消");
await using (var db = NewDb())
    Check((await db.StoreOrders.SingleAsync(o => o.Id == paidBeforeCancel)).Status == "PAID", "callback 漏接時由查詢補記為已付款");

var amountMismatch = await SeedOrderAsync(userId, "CREDIT_CARD", 400m);
var mismatchAttempt = await AddAttemptAsync(amountMismatch);
handler.Respond = _ => handler.Signed(new() { ["MerchantTradeNo"] = mismatchAttempt, ["TradeStatus"] = "1", ["TradeNo"] = "T010", ["TradeAmt"] = "1" });
Check(await CancelAsync(amountMismatch, userId) == StoreOrderCancelResult.PaymentNeedsReview, "綠界已付款但金額不符時回報需人工核對");
await using (var db = NewDb())
    Check((await db.StoreOrders.SingleAsync(o => o.Id == amountMismatch)).Status == "PENDING_PAYMENT", "金額不符時訂單維持待付款，不取消也不改為已付款");

var rateLimited = await SeedOrderAsync(userId, "CREDIT_CARD", 400m);
await AddAttemptAsync(rateLimited);
handler.Respond = _ => new HttpResponseMessage(HttpStatusCode.Forbidden);
Check(await CancelAsync(rateLimited, userId) == StoreOrderCancelResult.PaymentStatusUnknown, "綠界回 403 時暫時無法取消");
handler.Respond = request => { var r = handler.Signed(new() { ["MerchantTradeNo"] = "x", ["TradeStatus"] = "1" }); return r; };
Check(await CancelAsync(rateLimited, userId) == StoreOrderCancelResult.PaymentStatusUnknown, "查詢回應的交易編號不符時不取消");
handler.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("TradeStatus=1&MerchantID=2000132&CheckMacValue=BAD") };
Check(await CancelAsync(rateLimited, userId) == StoreOrderCancelResult.PaymentStatusUnknown, "查詢回應檢查碼不符時不取消");
await using (var db = NewDb())
    Check((await db.StoreOrders.SingleAsync(o => o.Id == rateLimited)).Status == "PENDING_PAYMENT", "無法確認付款狀態時資料不變");

var cod = await SeedOrderAsync(userId, "COD", 300m);
handler.Calls = 0;
Check(await CancelAsync(cod, Guid.NewGuid()) == StoreOrderCancelResult.NotFound, "不能取消別人的訂單");
Check(await CancelAsync(cod, null) == StoreOrderCancelResult.Cancelled && handler.Calls == 0, "貨到付款訂單取消不查詢綠界");
Check(await CancelAsync(paid, userId) == StoreOrderCancelResult.NotCancellable, "已付款訂單不可取消");

// 第 3 項：前往付款端點
var payAgain = await SeedOrderAsync(userId, "CREDIT_CARD", 600m);
var first = await CheckoutAsync(payAgain, userId);
var second2 = await CheckoutAsync(payAgain, userId);
Check(first is OkObjectResult { Value: EcpayCheckoutFormDto f1 } && second2 is OkObjectResult { Value: EcpayCheckoutFormDto f2 }
    && f1.Fields["MerchantTradeNo"] != f2.Fields["MerchantTradeNo"], "連續前往付款兩次得到不同交易編號");
await using (var db = NewDb())
    Check(await db.PaymentAttempts.CountAsync(a => a.Payment.OrderId == payAgain) == 2, "每次前往付款都記下付款嘗試");
Check(await CheckoutAsync(unpaid, userId) is ObjectResult { StatusCode: 409 }, "已取消的訂單不能前往付款");
Check(await CheckoutAsync(cod, userId) is ObjectResult { StatusCode: 409 }, "貨到付款的訂單不能前往付款");
Check(await CheckoutAsync(payAgain, Guid.NewGuid()) is ObjectResult { StatusCode: 404 }, "不能替別人的訂單付款");

// 第 5 項：callback 控制器
var callbackOrder = await SeedOrderAsync(userId, "CREDIT_CARD", 700m);
var callbackAttempt = await AddAttemptAsync(callbackOrder);
var callback = new Dictionary<string, string>(StringComparer.Ordinal)
{
    ["MerchantID"] = ecpay.MerchantId, ["MerchantTradeNo"] = callbackAttempt, ["RtnCode"] = "1", ["RtnMsg"] = "交易成功",
    ["TradeNo"] = "T009", ["TradeAmt"] = "700", ["PaymentDate"] = "2026/10/07 12:00:00", ["PaymentType"] = "Credit_CreditCard",
    ["PaymentTypeChargeFee"] = "14", ["TradeDate"] = "2026/10/07 11:59:00", ["SimulatePaid"] = "0", ["CustomField1"] = "", ["StoreID"] = ""
};
callback["CheckMacValue"] = EcpayCheckMac.Compute(callback, ecpay.HashKey, ecpay.HashIv);
Check(await PostCallbackAsync(With(callback, "TradeAmt", "1")) is BadRequestObjectResult, "竄改 TradeAmt 的 callback 被拒絕");
Check(await PostCallbackAsync(With(callback, "CheckMacValue", "BAD")) is BadRequestObjectResult, "竄改 CheckMacValue 的 callback 被拒絕");
await using (var db = NewDb())
    Check((await db.StoreOrders.SingleAsync(o => o.Id == callbackOrder)).Status == "PENDING_PAYMENT", "被拒絕的 callback 不改資料");
Check(await PostCallbackAsync(callback) is ContentResult { Content: "1|OK", ContentType: "text/plain" }, "正確的 callback 回 1|OK");
await using (var db = NewDb())
    Check((await db.StoreOrders.SingleAsync(o => o.Id == callbackOrder)).Status == "PAID", "callback 後訂單為已付款");

Console.WriteLine("ECPay checks passed.");
return;

QmahDbContext NewDb() => new(dbOptions);

EcpayPaymentService NewPayments(QmahDbContext db) => new(db, ecpayOptions, NullLogger<EcpayPaymentService>.Instance);

async Task<EcpayApplyOutcome> ApplyAsync(EcpayPaymentResult result)
{
    await using var db = NewDb();
    return await NewPayments(db).ApplyResultAsync(result, CancellationToken.None);
}

async Task<StoreOrderCancelResult> CancelAsync(Guid orderId, Guid? byUser)
{
    await using var db = NewDb();
    var query = new EcpayQueryClient(new HttpClient(handler), ecpayOptions, NullLogger<EcpayQueryClient>.Instance);
    var service = new StoreOrderCancellationService(db, query, NewPayments(db), NullLogger<StoreOrderCancellationService>.Instance);
    return await service.CancelAsync(orderId, byUser, CancellationToken.None);
}

async Task<ActionResult<EcpayCheckoutFormDto>> CheckoutAsyncCore(Guid orderId, Guid byUser)
{
    await using var db = NewDb();
    var controller = new StoreOrdersController(db, NewPayments(db), null!)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, byUser.ToString())], "checks"))
            }
        }
    };
    return await controller.CreateEcpayCheckout(orderId);
}

async Task<ActionResult?> CheckoutAsync(Guid orderId, Guid byUser) => (await CheckoutAsyncCore(orderId, byUser)).Result;

async Task<IActionResult> PostCallbackAsync(Dictionary<string, string> fields)
{
    await using var db = NewDb();
    var httpContext = new DefaultHttpContext();
    var body = new FormUrlEncodedContent(fields).ReadAsStringAsync().Result;
    httpContext.Request.Method = "POST";
    httpContext.Request.ContentType = "application/x-www-form-urlencoded";
    httpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
    var controller = new EcpayCallbackController(NewPayments(db), ecpayOptions, NullLogger<EcpayCallbackController>.Instance)
    {
        ControllerContext = new ControllerContext { HttpContext = httpContext }
    };
    return await controller.Return(CancellationToken.None);
}

async Task<Guid> SeedOrderAsync(Guid owner, string paymentType, decimal total, int pointsUsed = 0)
{
    await using var db = NewDb();
    var order = NewOrder(owner, paymentType, total, pointsUsed);
    order.OrderDetails.Add(new OrderDetail
    {
        Id = Guid.NewGuid(), OrderId = order.Id, ProductId = product.Id, ProductNameSnapshot = product.Name,
        UnitPrice = total, Quantity = 1, LineTotal = total
    });
    db.StoreOrders.Add(order);
    await db.SaveChangesAsync();
    return order.Id;
}

async Task<string> AddAttemptAsync(Guid orderId)
{
    await using var db = NewDb();
    var order = await db.StoreOrders.Include(o => o.OrderDetails).Include(o => o.Payment).SingleAsync(o => o.Id == orderId);
    var created = NewPayments(db).AddCheckoutForm(order) ?? throw new InvalidOperationException("訂單不能產生表單");
    await db.SaveChangesAsync();
    return created.Fields["MerchantTradeNo"];
}

static StoreOrder NewOrder(Guid owner, string paymentType, decimal total, int pointsUsed = 0)
{
    var id = Guid.NewGuid();
    return new StoreOrder
    {
        Id = id, OrderNo = $"QMAH-{id:N}"[..28], UserId = owner, Status = "PENDING_PAYMENT",
        Subtotal = total + pointsUsed, DiscountAmount = 0m, PointsUsed = pointsUsed, ShippingFee = 0m, TotalAmount = total,
        RecipientName = "測試", RecipientPhone = "0900000000", ShippingPostalCode = "100", ShippingCity = "臺北市",
        ShippingDistrict = "中正區", ShippingAddressLine = "測試路 1 號", ShippingMethod = "STANDARD", CreatedAt = DateTime.UtcNow,
        Payment = new Payment
        {
            Id = Guid.NewGuid(), OrderId = id, MerchantTradeNo = $"QMAH-{Guid.NewGuid():N}"[..28], Amount = total,
            Status = "PENDING", PaymentType = paymentType, CreatedAt = DateTime.UtcNow
        }
    };
}

static EcpayPaymentResult Success(string merchantTradeNo, string tradeNo, int amount) =>
    new(merchantTradeNo, true, tradeNo, amount, 1, "交易成功", false);

static Dictionary<string, string> With(Dictionary<string, string> fields, string key, string value) =>
    new(fields, StringComparer.Ordinal) { [key] = value };

static Dictionary<string, string> Without(Dictionary<string, string> fields, string key)
{
    var copy = new Dictionary<string, string>(fields, StringComparer.Ordinal);
    copy.Remove(key);
    return copy;
}

static EcpayOptions Copy(EcpayOptions source, string? publicBaseUrl = null, string? clientBaseUrl = null) => new()
{
    MerchantId = source.MerchantId, HashKey = source.HashKey, HashIv = source.HashIv,
    CheckoutUrl = source.CheckoutUrl, QueryTradeInfoUrl = source.QueryTradeInfoUrl,
    PublicBaseUrl = publicBaseUrl ?? source.PublicBaseUrl, ClientBaseUrl = clientBaseUrl ?? source.ClientBaseUrl
};

static void CreateSchema(SqliteConnection connection, DbContextOptions<QmahDbContext> options)
{
    // 模型含 SQL Server 專用語法；只轉換必要部分，store 以外失敗的資料表與這裡的檢查無關。
    using var db = new QmahDbContext(options);
    var script = Regex.Replace(db.Database.GenerateCreateScript(), @"\(max\)", "", RegexOptions.IgnoreCase)
        .Replace("sysutcdatetime()", "CURRENT_TIMESTAMP");
    // GenerateCreateScript 以 Environment.NewLine 換行，Windows 上是 \r\n。
    foreach (var statement in Regex.Split(script, @";\r?\n").Where(text => !string.IsNullOrWhiteSpace(text)))
    {
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = statement;
            command.ExecuteNonQuery();
        }
        catch (SqliteException) when (!statement.Contains("\"store\"") && !Regex.IsMatch(statement, "\"(StoreOrders|Payments|PaymentAttempts|OrderDetails|Products|PointBalances|PointTransactions)\""))
        {
        }
    }
}

static void Check(bool condition, string name)
{
    if (!condition)
        throw new InvalidOperationException($"檢查失敗：{name}");
    Console.WriteLine($"✓ {name}");
}

sealed class FakeEcpayHandler(EcpayOptions options) : HttpMessageHandler
{
    public Func<HttpRequestMessage, HttpResponseMessage> Respond { get; set; } = _ => new HttpResponseMessage(HttpStatusCode.InternalServerError);
    public int Calls { get; set; }

    public HttpResponseMessage Signed(Dictionary<string, string> fields)
    {
        fields["MerchantID"] = options.MerchantId;
        fields["CheckMacValue"] = EcpayCheckMac.Compute(fields, options.HashKey, options.HashIv);
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new FormUrlEncodedContent(fields) };
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        var body = request.Content!.ReadAsStringAsync(cancellationToken).Result;
        var fields = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(body)
            .ToDictionary(pair => pair.Key, pair => pair.Value.ToString(), StringComparer.Ordinal);
        if (!EcpayCheckMac.Verify(fields, options))
            throw new InvalidOperationException("查詢訂單的請求簽章錯誤");
        return Task.FromResult(Respond(request));
    }
}

sealed class FakeEnvironment(string name) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = name;
    public string ApplicationName { get; set; } = "QMAH.Api";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
