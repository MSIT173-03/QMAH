/* QMAH Store demonstration seed
   Applies only to existing generated/imported products and is safe to rerun.
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
SET SalePrice = ROUND(product.Price * CASE candidates.SeedOrder
        WHEN 1 THEN 0.80
        WHEN 2 THEN 0.85
        ELSE 0.90
    END, 2),
    UpdatedAt = SYSUTCDATETIME()
FROM [store].[Products] AS product
INNER JOIN candidates ON candidates.Id = product.Id;
GO
