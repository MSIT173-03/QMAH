/* 在 db-v0.12.0 上補上綠界付款所需結構；只影響 store.Payments、store.PaymentAttempts 與 store.StoreOrders 索引。
   可重複執行，不改動既有訂單與付款資料。 */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* 每次產生綠界表單就記一筆嘗試；綠界的 MerchantTradeNo 最多 20 碼且不可重複，
   callback 與查詢訂單都以它找回 Payment。 */
IF OBJECT_ID(N'store.PaymentAttempts', N'U') IS NULL
BEGIN
    CREATE TABLE [store].[PaymentAttempts] (
        [Id] uniqueidentifier NOT NULL,
        [PaymentId] uniqueidentifier NOT NULL,
        [MerchantTradeNo] varchar(20) NOT NULL,
        [Status] nvarchar(20) NOT NULL CONSTRAINT [DF_PaymentAttempts_Status] DEFAULT N'CREATED',
        [EcpayTradeNo] nvarchar(30) NULL,
        [RtnCode] int NULL,
        [RtnMsg] nvarchar(200) NULL,
        [CallbackReceivedAt] datetime2(3) NULL,
        [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_PaymentAttempts_Created] DEFAULT ((sysutcdatetime())),
        CONSTRAINT [PK_PaymentAttempts] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_PaymentAttempts_Status] CHECK (([Status]=N'REFUND_REQUIRED' OR [Status]=N'FAILED' OR [Status]=N'PAID' OR [Status]=N'CREATED')),
        CONSTRAINT [FK_PaymentAttempts_Payment] FOREIGN KEY ([PaymentId]) REFERENCES [store].[Payments] ([Id])
    );
    CREATE UNIQUE INDEX [UQ_PaymentAttempts_MerchantTradeNo] ON [store].[PaymentAttempts] ([MerchantTradeNo]);
    CREATE INDEX [IX_PaymentAttempts_PaymentId] ON [store].[PaymentAttempts] ([PaymentId]);
END;

/* 取消或逾時後才付款的訂單需要人工退款，付款狀態新增 REFUND_REQUIRED。 */
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'store.Payments')
      AND name = N'CK_Payments_Status'
)
    ALTER TABLE [store].[Payments] DROP CONSTRAINT [CK_Payments_Status];

ALTER TABLE [store].[Payments] WITH CHECK ADD CONSTRAINT [CK_Payments_Status]
    CHECK ([Status] = N'REFUND_REQUIRED' OR [Status] = N'CANCELLED' OR [Status] = N'FAILED'
        OR [Status] = N'PAID' OR [Status] = N'PENDING');

/* 逾時取消背景工作依狀態與建立時間掃描待付款訂單。 */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'store.StoreOrders')
      AND name = N'IX_StoreOrders_Status_CreatedAt'
)
    CREATE INDEX [IX_StoreOrders_Status_CreatedAt] ON [store].[StoreOrders] ([Status], [CreatedAt]);

COMMIT TRANSACTION;
GO
