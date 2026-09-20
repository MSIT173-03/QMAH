/* QMAH Store demonstration seed
   Applies only to existing generated/imported products and is safe to rerun.
   DiscountRate is the bulk pricing input; an administrator may still set a
   separate SalePrice override through the admin API for exact prices.
   The stable ExternalRef ordering makes the selected rows auditable without
   inventing product IDs that differ between database restores. */
;WITH candidates AS (
    SELECT TOP (3)
        Id,
        Price,
        ROW_NUMBER() OVER (ORDER BY ExternalRef, Id) AS SeedOrder
    FROM [store].[Products]
    WHERE IsActive = 1
      AND Price > 0
      AND ExternalRef LIKE N'artifact-%'
)
UPDATE product
SET DiscountRate = CASE candidates.SeedOrder
        WHEN 1 THEN 20.00
        WHEN 2 THEN 15.00
        ELSE 10.00
    END,
    SalePrice = NULL,
    UpdatedAt = SYSUTCDATETIME()
FROM [store].[Products] AS product
INNER JOIN candidates ON candidates.Id = product.Id;
GO
