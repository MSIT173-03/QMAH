/*
   QMAH 參考資料庫展示資料

   這份腳本補入社群、遊戲與商城後台開發需要的情境資料
   不會新增或修改資料表欄位
   請在已完成 Schema、Identity 與正式文物資料匯入的 QMAH 資料庫執行
   各區段都有防重複條件，可以安全地再次執行
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @PrimaryUserId uniqueidentifier =
(
    SELECT TOP (1) [Id]
    FROM [user].[AspNetUsers]
    ORDER BY [CreatedAt], [Id]
);

IF @PrimaryUserId IS NULL
    THROW 50001, '需要先有會員資料才能建立展示資料', 1;

BEGIN TRANSACTION;

/* 社群貼文與留言 */
IF NOT EXISTS
(
    SELECT 1
    FROM [social].[SocialPosts]
    WHERE [Title] LIKE N'文物觀察｜第 % 則討論'
)
BEGIN
    DECLARE @PostIndex int = 1;
    DECLARE @PostId uniqueidentifier;
    DECLARE @ArtifactId uniqueidentifier;
    DECLARE @BoardCode nvarchar(30);
    DECLARE @PostStatus nvarchar(20);

    WHILE @PostIndex <= 48
    BEGIN
        SET @PostId = NEWID();
        SET @ArtifactId = NULL;

        IF @PostIndex % 3 <> 0
        BEGIN
            SELECT @ArtifactId = [Id]
            FROM [catalog].[Artifacts]
            ORDER BY [Id]
            OFFSET ((@PostIndex - 1) % 256) ROWS FETCH NEXT 1 ROW ONLY;
        END;

        SET @BoardCode = CASE @PostIndex % 6
            WHEN 0 THEN N'GENERAL'
            WHEN 1 THEN N'CATALOG'
            WHEN 2 THEN N'GAME'
            WHEN 3 THEN N'EVENTS'
            WHEN 4 THEN N'DISCOVERY'
            ELSE N'REVIEW' END;

        SET @PostStatus = CASE @PostIndex % 12
            WHEN 0 THEN N'HIDDEN'
            WHEN 1 THEN N'DELETED'
            ELSE N'PUBLISHED' END;

        INSERT INTO [social].[SocialPosts]
        (
            [Id], [BoardCode], [UserId], [ArtifactId], [Title], [Content],
            [Status], [CreatedAt], [UpdatedAt]
        )
        VALUES
        (
            @PostId,
            @BoardCode,
            @PrimaryUserId,
            @ArtifactId,
            CONCAT(N'文物觀察｜第 ', @PostIndex, N' 則討論'),
            CONCAT(
                N'從館藏圖片與年代線索出發，整理一段適合社群交流的觀察。',
                N' 歡迎分享你注意到的材質、構圖或時代特徵，讓不同角度的閱讀都能留下紀錄。'
            ),
            @PostStatus,
            DATEADD(HOUR, -@PostIndex, SYSUTCDATETIME()),
            DATEADD(MINUTE, -(@PostIndex % 40), SYSUTCDATETIME())
        );

        SET @PostIndex += 1;
    END;

    DECLARE @CommentIndex int = 1;
    DECLARE @CommentPostId uniqueidentifier;

    DECLARE comment_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT TOP (48) [Id]
        FROM [social].[SocialPosts]
        WHERE [Title] LIKE N'文物觀察｜第 % 則討論'
        ORDER BY [CreatedAt] DESC;

    OPEN comment_cursor;
    FETCH NEXT FROM comment_cursor INTO @CommentPostId;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO [social].[SocialComments]
        (
            [Id], [PostId], [ParentCommentId], [UserId], [Content],
            [Status], [CreatedAt], [UpdatedAt]
        )
        VALUES
        (
            NEWID(),
            @CommentPostId,
            NULL,
            @PrimaryUserId,
            CONCAT(N'這則討論的第 ', @CommentIndex, N' 筆回應，補充一個觀察角度。'),
            CASE WHEN @CommentIndex % 15 = 0 THEN N'HIDDEN' ELSE N'PUBLISHED' END,
            DATEADD(MINUTE, -@CommentIndex, SYSUTCDATETIME()),
            DATEADD(MINUTE, -@CommentIndex, SYSUTCDATETIME())
        );

        SET @CommentIndex += 1;
        FETCH NEXT FROM comment_cursor INTO @CommentPostId;
    END;

    CLOSE comment_cursor;
    DEALLOCATE comment_cursor;
END;

/* 遊戲房間與玩家 */
DECLARE @RoomSeeds TABLE
(
    [RoomCode] nvarchar(12) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [Visibility] nvarchar(10) NOT NULL,
    [MaxPlayers] tinyint NOT NULL,
    [TotalRounds] tinyint NOT NULL,
    [CurrentRoundNo] tinyint NOT NULL,
    [CreatedDaysAgo] int NOT NULL
);

INSERT INTO @RoomSeeds
    ([RoomCode], [Status], [Visibility], [MaxPlayers], [TotalRounds], [CurrentRoundNo], [CreatedDaysAgo])
VALUES
    (N'SHOW301', N'WAITING',   N'PUBLIC',  6, 3, 0, 0),
    (N'SHOW302', N'WAITING',   N'PUBLIC',  4, 2, 0, 1),
    (N'SHOW303', N'PLAYING',   N'PUBLIC',  6, 3, 1, 1),
    (N'SHOW304', N'PLAYING',   N'PUBLIC',  8, 5, 2, 2),
    (N'SHOW305', N'COMPLETED', N'PUBLIC',  4, 3, 3, 4),
    (N'SHOW306', N'COMPLETED', N'PUBLIC',  6, 2, 2, 6),
    (N'SHOW307', N'CANCELLED', N'PUBLIC',  5, 3, 0, 3),
    (N'SHOW308', N'CANCELLED', N'PUBLIC',  6, 4, 1, 8);

INSERT INTO [game].[GameRooms]
(
    [Id], [RoomCode], [Status], [Visibility], [PasswordHash], [MaxPlayers],
    [TotalRounds], [AnswerSeconds], [VotingSeconds], [CategoryFilterCode],
    [EraBucketFilterCode], [CurrentRoundNo], [StateVersion], [CreatedAt],
    [StartedAt], [EndedAt], [CompletedAt]
)
SELECT
    NEWID(),
    seed.[RoomCode],
    seed.[Status],
    seed.[Visibility],
    NULL,
    seed.[MaxPlayers],
    seed.[TotalRounds],
    120,
    60,
    NULL,
    NULL,
    seed.[CurrentRoundNo],
    CASE WHEN seed.[Status] = N'WAITING' THEN 0 ELSE seed.[CurrentRoundNo] + 1 END,
    DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME()),
    CASE WHEN seed.[Status] = N'WAITING' THEN NULL
         ELSE DATEADD(MINUTE, 5, DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME())) END,
    CASE WHEN seed.[Status] IN (N'COMPLETED', N'CANCELLED')
         THEN DATEADD(MINUTE, 35, DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME()))
         ELSE NULL END,
    CASE WHEN seed.[Status] IN (N'COMPLETED', N'CANCELLED')
         THEN DATEADD(MINUTE, 35, DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME()))
         ELSE NULL END
FROM @RoomSeeds AS seed
WHERE NOT EXISTS
(
    SELECT 1
    FROM [game].[GameRooms] AS existing
    WHERE existing.[RoomCode] = seed.[RoomCode]
);

DECLARE @GameUserId uniqueidentifier =
    COALESCE((SELECT [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'game@qmah.local'), @PrimaryUserId);
DECLARE @PlayerAUserId uniqueidentifier =
    COALESCE((SELECT [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'player-a@qmah.local'), @PrimaryUserId);
DECLARE @PlayerBUserId uniqueidentifier =
    COALESCE((SELECT [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'player-b@qmah.local'), @PrimaryUserId);

DECLARE @SeedRoomCode nvarchar(12);
DECLARE @SeedRoomStatus nvarchar(20);
DECLARE @SeedRoomId uniqueidentifier;
DECLARE @SeedRoomCreatedAt datetime2(3);

DECLARE room_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT room.[RoomCode], room.[Status], room.[Id], room.[CreatedAt]
    FROM [game].[GameRooms] AS room
    WHERE room.[RoomCode] IN (SELECT [RoomCode] FROM @RoomSeeds)
    ORDER BY room.[RoomCode];

OPEN room_cursor;
FETCH NEXT FROM room_cursor INTO @SeedRoomCode, @SeedRoomStatus, @SeedRoomId, @SeedRoomCreatedAt;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS
    (
        SELECT 1 FROM [game].[GamePlayers]
        WHERE [RoomId] = @SeedRoomId AND [PlayerKey] = CONCAT(N'host-', @SeedRoomCode)
    )
    BEGIN
        INSERT INTO [game].[GamePlayers]
        (
            [Id], [RoomId], [UserId], [PlayerKey], [DisplayName], [Role], [IsReady], [SeatNo],
            [JoinedAt], [ConnectionStatus], [LastSeenAt], [DisconnectedAt], [ReconnectDeadlineAt], [LeftAt]
        )
        VALUES
        (
            NEWID(), @SeedRoomId, @GameUserId, CONCAT(N'host-', @SeedRoomCode), N'館長小清', N'HOST', 1, 1,
            DATEADD(MINUTE, 2, @SeedRoomCreatedAt),
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED') THEN N'LEFT' ELSE N'ONLINE' END,
            DATEADD(MINUTE, 30, @SeedRoomCreatedAt),
            NULL,
            NULL,
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED')
                 THEN DATEADD(MINUTE, 30, @SeedRoomCreatedAt) ELSE NULL END
        );
    END;

    IF @PlayerAUserId <> @GameUserId AND NOT EXISTS
    (
        SELECT 1 FROM [game].[GamePlayers]
        WHERE [RoomId] = @SeedRoomId AND [PlayerKey] = CONCAT(N'player-', @SeedRoomCode)
    )
    BEGIN
        INSERT INTO [game].[GamePlayers]
        (
            [Id], [RoomId], [UserId], [PlayerKey], [DisplayName], [Role], [IsReady], [SeatNo],
            [JoinedAt], [ConnectionStatus], [LastSeenAt], [DisconnectedAt], [ReconnectDeadlineAt], [LeftAt]
        )
        VALUES
        (
            NEWID(), @SeedRoomId, @PlayerAUserId, CONCAT(N'player-', @SeedRoomCode), N'明明來鑑定', N'PLAYER',
            CASE WHEN @SeedRoomStatus = N'WAITING' THEN 0 ELSE 1 END, 2,
            DATEADD(MINUTE, 3, @SeedRoomCreatedAt),
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED') THEN N'LEFT'
                 WHEN @SeedRoomStatus = N'PLAYING' AND @SeedRoomCode = N'SHOW304' THEN N'OFFLINE'
                 ELSE N'ONLINE' END,
            DATEADD(MINUTE, 28, @SeedRoomCreatedAt),
            CASE WHEN @SeedRoomStatus = N'PLAYING' AND @SeedRoomCode = N'SHOW304'
                 THEN DATEADD(MINUTE, 28, @SeedRoomCreatedAt) ELSE NULL END,
            CASE WHEN @SeedRoomStatus = N'PLAYING' AND @SeedRoomCode = N'SHOW304'
                 THEN DATEADD(MINUTE, 30, @SeedRoomCreatedAt) ELSE NULL END,
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED')
                 THEN DATEADD(MINUTE, 28, @SeedRoomCreatedAt) ELSE NULL END
        );
    END;

    FETCH NEXT FROM room_cursor INTO @SeedRoomCode, @SeedRoomStatus, @SeedRoomId, @SeedRoomCreatedAt;
END;

CLOSE room_cursor;
DEALLOCATE room_cursor;

/* 商城訂單、明細與付款紀錄 */
DECLARE @OrderIndex int = 1;
DECLARE @OrderNo nvarchar(30);
DECLARE @OrderId uniqueidentifier;
DECLARE @OrderUserId uniqueidentifier;
DECLARE @ProductId uniqueidentifier;
DECLARE @ProductName nvarchar(200);
DECLARE @UnitPrice decimal(12,2);
DECLARE @Quantity int;
DECLARE @Subtotal decimal(12,2);
DECLARE @DiscountAmount decimal(12,2);
DECLARE @PointsUsed int;
DECLARE @TotalAmount decimal(12,2);
DECLARE @OrderStatus nvarchar(30);
DECLARE @PaymentStatus nvarchar(20);
DECLARE @OrderCreatedAt datetime2(3);

WHILE @OrderIndex <= 9
BEGIN
    SET @OrderNo = CONCAT(N'QMAH-SHOW-', RIGHT(CONCAT(N'0000', @OrderIndex), 4));

    IF NOT EXISTS (SELECT 1 FROM [store].[StoreOrders] WHERE [OrderNo] = @OrderNo)
    BEGIN
        SET @OrderId = NEWID();
        SET @OrderUserId = CASE @OrderIndex % 3
            WHEN 0 THEN @PrimaryUserId
            WHEN 1 THEN @PlayerAUserId
            ELSE @PlayerBUserId END;

        SELECT @ProductId = [Id], @ProductName = [Name], @UnitPrice = [Price]
        FROM [store].[Products]
        ORDER BY [Name], [Id]
        OFFSET (@OrderIndex * 7) ROWS FETCH NEXT 1 ROW ONLY;

        IF @ProductId IS NULL
            THROW 50002, '需要先有商城商品才能建立歷史交易資料', 1;

        SET @Quantity = CASE WHEN @OrderIndex IN (4, 8) THEN 2 ELSE 1 END;
        SET @Subtotal = @UnitPrice * @Quantity;
        SET @DiscountAmount = CASE WHEN @OrderIndex % 3 = 0 THEN 100 ELSE 0 END;
        SET @PointsUsed = CASE WHEN @OrderIndex % 4 = 0 THEN 50 ELSE 0 END;
        SET @TotalAmount = @Subtotal - @DiscountAmount - @PointsUsed;
        SET @OrderStatus = CASE @OrderIndex
            WHEN 1 THEN N'PENDING_PAYMENT'
            WHEN 2 THEN N'PAID'
            WHEN 3 THEN N'PAID'
            WHEN 4 THEN N'FULFILLING'
            WHEN 5 THEN N'FULFILLING'
            WHEN 6 THEN N'SHIPPED'
            WHEN 7 THEN N'SHIPPED'
            WHEN 8 THEN N'COMPLETED'
            ELSE N'CANCELLED' END;
        SET @PaymentStatus = CASE
            WHEN @OrderStatus = N'PENDING_PAYMENT' THEN N'PENDING'
            WHEN @OrderStatus = N'CANCELLED' THEN N'FAILED'
            ELSE N'PAID' END;
        SET @OrderCreatedAt = DATEADD(DAY, -(@OrderIndex * 2), SYSUTCDATETIME());

        INSERT INTO [store].[StoreOrders]
        (
            [Id], [OrderNo], [UserId], [UserCouponId], [Status], [Subtotal],
            [DiscountAmount], [PointsUsed], [TotalAmount], [RecipientName],
            [RecipientPhone], [ShippingPostalCode], [ShippingCity], [ShippingDistrict],
            [ShippingAddressLine], [CreatedAt], [PaidAt], [CancelledAt]
        )
        VALUES
        (
            @OrderId, @OrderNo, @OrderUserId, NULL, @OrderStatus, @Subtotal,
            @DiscountAmount, @PointsUsed, @TotalAmount,
            CASE @OrderIndex % 3 WHEN 0 THEN N'陳文華' WHEN 1 THEN N'林明慧' ELSE N'王子安' END,
            CONCAT(N'0912-345-', RIGHT(CONCAT(N'00', @OrderIndex), 3)),
            CASE @OrderIndex % 3 WHEN 0 THEN N'100' WHEN 1 THEN N'106' ELSE N'220' END,
            CASE @OrderIndex % 3 WHEN 0 THEN N'臺北市' WHEN 1 THEN N'臺北市' ELSE N'新北市' END,
            CASE @OrderIndex % 3 WHEN 0 THEN N'中正區' WHEN 1 THEN N'大安區' ELSE N'板橋區' END,
            CONCAT(N'專題展示路 ', @OrderIndex, N' 號'),
            @OrderCreatedAt,
            CASE WHEN @PaymentStatus = N'PAID' THEN DATEADD(MINUTE, 5, @OrderCreatedAt) ELSE NULL END,
            CASE WHEN @OrderStatus = N'CANCELLED' THEN DATEADD(MINUTE, 8, @OrderCreatedAt) ELSE NULL END
        );

        INSERT INTO [store].[OrderDetails]
            ([Id], [OrderId], [ProductId], [ProductNameSnapshot], [UnitPrice], [Quantity], [LineTotal])
        VALUES
            (NEWID(), @OrderId, @ProductId, @ProductName, @UnitPrice, @Quantity, @Subtotal);

        INSERT INTO [store].[Payments]
        (
            [Id], [OrderId], [MerchantTradeNo], [EcpayTradeNo], [Amount], [Status],
            [RtnCode], [RtnMsg], [PaymentType], [CallbackReceivedAt], [CreatedAt]
        )
        VALUES
        (
            NEWID(), @OrderId, CONCAT(N'QMSHOW', RIGHT(CONCAT(N'000000', @OrderIndex), 6)),
            CASE WHEN @PaymentStatus = N'PAID' THEN CONCAT(N'TEST', RIGHT(CONCAT(N'000000', @OrderIndex), 6)) ELSE NULL END,
            @TotalAmount, @PaymentStatus,
            CASE WHEN @PaymentStatus = N'PAID' THEN 1 WHEN @PaymentStatus = N'FAILED' THEN 0 ELSE NULL END,
            CASE WHEN @PaymentStatus = N'PAID' THEN N'付款成功'
                 WHEN @PaymentStatus = N'FAILED' THEN N'付款失敗'
                 ELSE NULL END,
            N'Credit_CreditCard',
            CASE WHEN @PaymentStatus IN (N'PAID', N'FAILED') THEN DATEADD(MINUTE, 5, @OrderCreatedAt) ELSE NULL END,
            @OrderCreatedAt
        );
    END;

    SET @OrderIndex += 1;
END;

COMMIT TRANSACTION;

SELECT
    (SELECT COUNT(*) FROM [social].[SocialPosts]) AS [SocialPosts],
    (SELECT COUNT(*) FROM [social].[SocialComments]) AS [SocialComments],
    (SELECT COUNT(*) FROM [game].[GameRooms]) AS [GameRooms],
    (SELECT COUNT(*) FROM [game].[GamePlayers]) AS [GamePlayers],
    (SELECT COUNT(*) FROM [store].[StoreOrders]) AS [StoreOrders],
    (SELECT COUNT(*) FROM [store].[OrderDetails]) AS [OrderDetails],
    (SELECT COUNT(*) FROM [store].[Payments]) AS [Payments];
