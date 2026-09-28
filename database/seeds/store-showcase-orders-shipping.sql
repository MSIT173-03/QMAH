/* 僅重整 db-v0.10.2 的展示訂單；先執行 0.10.2-store-order-shipping.sql。
   保留訂單／明細的識別碼、會員關聯與原付款方式，只同步配送、運費與付款金額。 */
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH(N'store.StoreOrders', N'ShippingMethod') IS NULL
       OR COL_LENGTH(N'store.StoreOrders', N'ShippingFee') IS NULL
        THROW 51001, '請先執行商城訂單欄位升級。', 1;

    IF EXISTS (
        SELECT 1 FROM [store].[StoreOrders]
        WHERE [OrderNo] NOT LIKE N'QMAH-GEN-%'
          AND [OrderNo] NOT LIKE N'QMAH-SHOW-%'
    )
        THROW 51002, '資料庫包含非展示訂單，停止重整以免更動真實資料。', 1;

    IF EXISTS (
        SELECT 1 FROM [store].[StoreOrders] AS o
        WHERE o.[Subtotal] <> (
            SELECT SUM(d.[LineTotal]) FROM [store].[OrderDetails] AS d WHERE d.[OrderId] = o.[Id]
        ) OR NOT EXISTS (
            SELECT 1 FROM [store].[Payments] AS p WHERE p.[OrderId] = o.[Id]
        )
    )
        THROW 51003, '展示訂單明細或付款資料不完整，停止重整。', 1;

    /* 依穩定訂單編號交替選擇宅配／超商；滿 1500 元免運，其餘分別收 80／60 元。 */
    ;WITH RankedOrders AS (
        SELECT [Id], ROW_NUMBER() OVER (ORDER BY [OrderNo]) AS [SequenceNo]
        FROM [store].[StoreOrders]
    )
    UPDATE o
    SET [ShippingMethod] = CASE WHEN r.[SequenceNo] % 2 = 1 THEN N'STANDARD' ELSE N'CVS' END,
        [ShippingFee] = CASE WHEN o.[Subtotal] >= 1500 THEN 0
                             WHEN r.[SequenceNo] % 2 = 1 THEN 80 ELSE 60 END,
        [TotalAmount] = o.[Subtotal] - o.[DiscountAmount] - o.[PointsUsed]
                      + CASE WHEN o.[Subtotal] >= 1500 THEN 0
                             WHEN r.[SequenceNo] % 2 = 1 THEN 80 ELSE 60 END
    FROM [store].[StoreOrders] AS o
    INNER JOIN RankedOrders AS r ON r.[Id] = o.[Id];

    /* 保留原付款方式、付款狀態與交易欄位；配送費異動只同步應付金額。 */
    UPDATE p
    SET [Amount] = o.[TotalAmount]
    FROM [store].[Payments] AS p
    INNER JOIN [store].[StoreOrders] AS o ON o.[Id] = p.[OrderId];

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT COUNT(*) AS [ShowcaseOrders],
       SUM(CASE WHEN [ShippingMethod] = N'STANDARD' THEN 1 ELSE 0 END) AS [StandardOrders],
       SUM(CASE WHEN [ShippingMethod] = N'CVS' THEN 1 ELSE 0 END) AS [CvsOrders],
       SUM(CASE WHEN [ShippingFee] > 0 THEN 1 ELSE 0 END) AS [ChargedShippingOrders]
FROM [store].[StoreOrders];
