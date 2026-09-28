/* 從 db-v0.10.2 完整 Snapshot 升級商城訂單欄位；只影響 store.StoreOrders。
   舊訂單的運費視為 0，保留原有 TotalAmount、付款與會員資產資料。 */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'store.StoreOrders', N'ShippingMethod') IS NULL
    ALTER TABLE [store].[StoreOrders]
        ADD [ShippingMethod] nvarchar(40) NOT NULL
            CONSTRAINT [DF_StoreOrders_ShippingMethod] DEFAULT N'' WITH VALUES;

IF COL_LENGTH(N'store.StoreOrders', N'ShippingFee') IS NULL
    ALTER TABLE [store].[StoreOrders]
        ADD [ShippingFee] decimal(12, 2) NOT NULL
            CONSTRAINT [DF_StoreOrders_ShippingFee] DEFAULT ((0)) WITH VALUES;
GO

/* 舊 Snapshot 沒有配送方式來源；標為 LEGACY，不能猜作宅配或超商。 */
UPDATE [store].[StoreOrders]
SET [ShippingMethod] = N'LEGACY'
WHERE [ShippingMethod] = N'';

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'store.StoreOrders')
      AND name = N'CK_StoreOrders_Amounts'
)
    ALTER TABLE [store].[StoreOrders] DROP CONSTRAINT [CK_StoreOrders_Amounts];
GO

/* 新增欄位後以新批次編譯檢查約束，避免 SQL Server 誤判欄位不存在。 */
ALTER TABLE [store].[StoreOrders] WITH CHECK ADD CONSTRAINT [CK_StoreOrders_Amounts]
    CHECK ([Subtotal] >= 0 AND [DiscountAmount] >= 0 AND [PointsUsed] >= 0 AND [ShippingFee] >= 0
        AND [TotalAmount] >= 0 AND [TotalAmount] = [Subtotal] - [DiscountAmount] - [PointsUsed] + [ShippingFee]);

COMMIT TRANSACTION;
GO

SELECT COUNT(*) AS [ExistingOrderCount],
       SUM(CASE WHEN [ShippingFee] = 0 THEN 1 ELSE 0 END) AS [OrdersWithZeroShipping]
FROM [store].[StoreOrders];
