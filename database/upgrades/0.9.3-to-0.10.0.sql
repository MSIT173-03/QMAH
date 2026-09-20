/* QMAH db-v0.9.3 -> db-v0.10.0
   Store single-product sale price. NULL means no item-level discount. */
IF COL_LENGTH(N'store.Products', N'SalePrice') IS NULL
BEGIN
    ALTER TABLE [store].[Products]
        ADD [SalePrice] decimal(12,2) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_Products_SalePrice'
      AND parent_object_id = OBJECT_ID(N'[store].[Products]')
)
BEGIN
    ALTER TABLE [store].[Products]
        ADD CONSTRAINT [CK_Products_SalePrice]
        CHECK (([SalePrice] IS NULL OR ([SalePrice] > (0) AND [SalePrice] < [Price])));
END;
GO
