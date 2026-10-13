SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

-- 重跑保護：先移除先前產生的歷史訂單（OrderNo 以 QMAH-HIST- 開頭）
DELETE d FROM store.OrderDetails d JOIN store.StoreOrders o ON o.Id = d.OrderId WHERE o.OrderNo LIKE 'QMAH-HIST-%';
DELETE p FROM store.Payments p JOIN store.StoreOrders o ON o.Id = p.OrderId WHERE o.OrderNo LIKE 'QMAH-HIST-%';
DELETE FROM store.StoreOrders WHERE OrderNo LIKE 'QMAH-HIST-%';

-- 商品人氣權重：少數熱門、多數普通（冪次分布）
SELECT Id AS ProductId, Name, COALESCE(SalePrice, Price) AS UnitPrice,
       POWER(ABS(CHECKSUM(NEWID())) / 2147483647.0, 3) + 0.03 AS W
INTO #Pop FROM store.Products WHERE IsActive = 1;

DECLARE @Users TABLE (UserId uniqueidentifier, N int);
INSERT @Users SELECT UserId, ROW_NUMBER() OVER (ORDER BY UserId) FROM (SELECT DISTINCT UserId FROM store.StoreOrders WHERE OrderNo LIKE 'QMAH-GEN-%') u;
DECLARE @UserCount int = (SELECT COUNT(*) FROM @Users);

-- 1200 筆訂單，2025-11-01 到 2026-10-13，每筆 1–3 個品項
;WITH n AS (SELECT TOP (1200) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS i FROM sys.all_objects a CROSS JOIN sys.all_objects b)
SELECT i, NEWID() AS Id,
       'QMAH-HIST-' + RIGHT('00000' + CAST(i AS varchar(5)), 5) AS OrderNo,
       1 + (ABS(CHECKSUM(NEWID())) % @UserCount) AS Ui,
       DATEADD(MINUTE, ABS(CHECKSUM(NEWID())) % 1440, DATEADD(DAY, ABS(CHECKSUM(NEWID())) % 347, CAST('2025-11-01' AS datetime2))) AS CreatedAt,
       1 + (ABS(CHECKSUM(NEWID())) % 3) AS Items
INTO #O0 FROM n;
SELECT o.i, o.Id, o.OrderNo, u.UserId, o.CreatedAt, o.Items INTO #O FROM #O0 o JOIN @Users u ON u.N = o.Ui;

-- 每個品項：依人氣權重抽商品（-ln(rand)/w 最小者），數量偏向 1–2
SELECT o.Id AS OrderId, p.ProductId, p.Name, p.UnitPrice,
       CASE WHEN r.q < 40 THEN 1 WHEN r.q < 70 THEN 2 WHEN r.q < 85 THEN 3 WHEN r.q < 95 THEN 4 ELSE 5 END AS Qty
INTO #S
FROM #O o
JOIN (VALUES (1),(2),(3)) k(k) ON k.k <= o.Items
CROSS APPLY (SELECT TOP 1 ProductId, Name, UnitPrice FROM #Pop ORDER BY -LOG(ABS(CHECKSUM(NEWID())) / 2147483647.0 + 1e-9) / W + 0 * k.k * o.i) p
CROSS APPLY (SELECT ABS(CHECKSUM(NEWID())) % 100 AS q) r;

SELECT OrderId, ProductId, MAX(Name) Name, MAX(UnitPrice) UnitPrice, SUM(Qty) Qty INTO #D FROM #S GROUP BY OrderId, ProductId;

INSERT store.StoreOrders (Id, OrderNo, UserId, UserCouponId, Status, Subtotal, DiscountAmount, PointsUsed, TotalAmount,
    RecipientName, RecipientPhone, ShippingPostalCode, ShippingCity, ShippingDistrict, ShippingAddressLine,
    CreatedAt, PaidAt, CancelledAt, ShippingMethod, ShippingFee)
SELECT o.Id, o.OrderNo, o.UserId, NULL,
       CASE WHEN o.CreatedAt < '2026-10-03' THEN 'COMPLETED'
            WHEN o.CreatedAt < '2026-10-10' THEN 'SHIPPED' ELSE 'PAID' END,
       s.Sub, 0, 0, s.Sub + CASE WHEN s.Sub >= 1500 THEN 0 ELSE 60 END,
       a.RecipientName, a.RecipientPhone, a.ShippingPostalCode, a.ShippingCity, a.ShippingDistrict, a.ShippingAddressLine,
       o.CreatedAt, DATEADD(MINUTE, 5, o.CreatedAt), NULL,
       CASE WHEN s.Sub >= 1500 THEN 'STANDARD' ELSE 'CVS' END,
       CASE WHEN s.Sub >= 1500 THEN 0 ELSE 60 END
FROM #O o
CROSS APPLY (SELECT SUM(UnitPrice * Qty) AS Sub FROM #D WHERE OrderId = o.Id) s
OUTER APPLY (SELECT TOP 1 RecipientName, RecipientPhone, ShippingPostalCode, ShippingCity, ShippingDistrict, ShippingAddressLine
             FROM store.StoreOrders WHERE UserId = o.UserId AND OrderNo LIKE 'QMAH-GEN-%') a;

INSERT store.OrderDetails (Id, OrderId, ProductId, ProductNameSnapshot, UnitPrice, Quantity, LineTotal)
SELECT NEWID(), OrderId, ProductId, Name, UnitPrice, Qty, UnitPrice * Qty FROM #D;

INSERT store.Payments (Id, OrderId, MerchantTradeNo, EcpayTradeNo, Amount, Status, RtnCode, RtnMsg, PaymentType, CallbackReceivedAt, CreatedAt)
SELECT NEWID(), o.Id, 'QMAH-GP-H' + RIGHT('00000' + CAST(h.i AS varchar(5)), 5), 'QMAH-HIST-' + RIGHT('00000' + CAST(h.i AS varchar(5)), 5),
       o.TotalAmount, 'PAID', 1, N'付款成功', CASE WHEN h.i % 3 = 0 THEN 'WebATM' ELSE 'Credit_CreditCard' END,
       DATEADD(MINUTE, 5, o.CreatedAt), o.CreatedAt
FROM store.StoreOrders o JOIN #O h ON h.Id = o.Id;

COMMIT;

SELECT COUNT(*) AS orders FROM store.StoreOrders WHERE OrderNo LIKE 'QMAH-HIST-%';
SELECT TOP 8 p.Name, SUM(d.Quantity) sold FROM store.OrderDetails d JOIN store.StoreOrders o ON o.Id = d.OrderId JOIN store.Products p ON p.Id = d.ProductId WHERE o.Status = 'COMPLETED' GROUP BY p.Name ORDER BY 2 DESC;
SELECT MIN(s) mn, AVG(s) av, MAX(s) mx FROM (SELECT SUM(d.Quantity) s FROM store.OrderDetails d JOIN store.StoreOrders o ON o.Id = d.OrderId WHERE o.Status = 'COMPLETED' GROUP BY d.ProductId) t;
