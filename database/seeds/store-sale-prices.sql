/* QMAH Store demonstration seed — 與商城首頁輪播寫的特價一致，可重複執行。
   - 陶瓷全館 9 折：CERAMIC 類別所有商品 DiscountRate = 10
   - 錢幣精選 8 折：COIN 類別依 ExternalRef 排序的前 10 件 DiscountRate = 20
   其餘商品不打折。DiscountRate 是批次定價輸入，管理員仍可用後台另設 SalePrice。 */
UPDATE [store].[Products]
SET DiscountRate = 0, SalePrice = NULL, UpdatedAt = SYSUTCDATETIME()
WHERE DiscountRate <> 0 OR SalePrice IS NOT NULL;

UPDATE [store].[Products]
SET DiscountRate = 10.00, UpdatedAt = SYSUTCDATETIME()
WHERE CategoryCode = N'CERAMIC' AND IsActive = 1 AND Price > 0;

;WITH coins AS (
    SELECT Id, ROW_NUMBER() OVER (ORDER BY ExternalRef, Id) AS SeedOrder
    FROM [store].[Products]
    WHERE CategoryCode = N'COIN' AND IsActive = 1 AND Price > 0
)
UPDATE product
SET DiscountRate = 20.00, UpdatedAt = SYSUTCDATETIME()
FROM [store].[Products] AS product
INNER JOIN coins ON coins.Id = product.Id
WHERE coins.SeedOrder <= 10;
GO
