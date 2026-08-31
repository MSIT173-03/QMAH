/*
   QMAH 後台展示資料

   補足活動、檢舉、成就、優惠券，以及會員相關的管理情境。
   本腳本不修改 Schema、不使用 Migration，也不碰 256 件固定文物。
   每筆展示資料都有固定識別碼或標題，可安全重複執行。
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

DECLARE @Now datetime2(3) = SYSUTCDATETIME();
DECLARE @AdminUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'admin@qmah.local');
DECLARE @UserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'user@qmah.local');
DECLARE @CatalogUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'catalog@qmah.local');
DECLARE @GameUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'game@qmah.local');
DECLARE @SocialUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'social@qmah.local');
DECLARE @StoreUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'store@qmah.local');
DECLARE @PlayerAUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'player-a@qmah.local');
DECLARE @PlayerBUserId uniqueidentifier = (SELECT TOP (1) [Id] FROM [user].[AspNetUsers] WHERE [Email] = N'player-b@qmah.local');

IF @AdminUserId IS NULL OR @UserId IS NULL
    THROW 50002, '需要先有基本會員資料才能建立後台展示資料', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* 整理早期基準資料的可讀文字，保留既有識別碼與狀態用途。 */
    UPDATE [catalog].[KeyDefinitions]
    SET [Name] = N'一般解鎖鑰匙（停用）'
    WHERE [Code] = N'FIXTURE-NORMAL';

    UPDATE [store].[CouponDefinitions]
    SET [Name] = N'入門收藏折價券'
    WHERE [Code] = N'FIXTURE100';

    UPDATE player
    SET player.[DisplayName] = CASE player.[PlayerKey]
        WHEN N'fixture-completed-host' THEN N'Demo Game Host'
        WHEN N'fixture-completed-player' THEN N'Demo Player 01'
        WHEN N'fixture-waiting-host' THEN N'Demo Player 02'
        ELSE player.[DisplayName] END
    FROM [game].[GamePlayers] AS player
    WHERE player.[PlayerKey] IN (N'fixture-completed-host', N'fixture-completed-player', N'fixture-waiting-host');

    UPDATE orderData
    SET orderData.[RecipientName] = CASE orderData.[OrderNo]
            WHEN N'QMAH-FIX-0001' THEN N'Demo Store Editor 收'
            WHEN N'QMAH-FIX-0002' THEN N'Demo Player 01 收'
            WHEN N'QMAH-FIX-0003' THEN N'Demo Catalog 收'
            ELSE orderData.[RecipientName] END,
        orderData.[RecipientPhone] = CASE orderData.[OrderNo]
            WHEN N'QMAH-FIX-0001' THEN N'0900001001'
            WHEN N'QMAH-FIX-0002' THEN N'0900001002'
            WHEN N'QMAH-FIX-0003' THEN N'0900001003'
            ELSE orderData.[RecipientPhone] END,
        orderData.[ShippingAddressLine] = CASE orderData.[OrderNo]
            WHEN N'QMAH-FIX-0001' THEN N'重慶南路一段 20 號'
            WHEN N'QMAH-FIX-0002' THEN N'公益路 88 號 3 樓'
            WHEN N'QMAH-FIX-0003' THEN N'復興南路一段 100 號'
            ELSE orderData.[ShippingAddressLine] END
    FROM [store].[StoreOrders] AS orderData
    WHERE orderData.[OrderNo] IN (N'QMAH-FIX-0001', N'QMAH-FIX-0002', N'QMAH-FIX-0003');

    UPDATE addressData
    SET addressData.[RecipientName] = N'Demo Store Editor 收',
        addressData.[RecipientPhone] = N'0900001004',
        addressData.[AddressLine] = N'重慶南路一段 20 號'
    FROM [user].[UserAddresses] AS addressData
    INNER JOIN [user].[AspNetUsers] AS member ON member.[Id] = addressData.[UserId]
    WHERE member.[Email] = N'store@qmah.local'
      AND addressData.[AddressLabel] = N'主要收件地址';

    UPDATE payment
    SET payment.[RtnMsg] = N'付款授權未完成'
    FROM [store].[Payments] AS payment
    INNER JOIN [store].[StoreOrders] AS orderData ON orderData.[Id] = payment.[OrderId]
    WHERE orderData.[OrderNo] = N'QMAH-FIX-0003';

    /* 鑰匙展示：使用正式的分類、年代、一般與萬用鑰匙代碼。 */
    DECLARE @KeyDefinitionSeeds TABLE
    (
        [Id] uniqueidentifier NOT NULL,
        [Code] nvarchar(50) NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [ScopeType] nvarchar(20) NOT NULL,
        [CategoryCode] nvarchar(50) NULL,
        [EraCode] nvarchar(50) NULL,
        [IsActive] bit NOT NULL
    );

    INSERT INTO @KeyDefinitionSeeds ([Id], [Code], [Name], [ScopeType], [CategoryCode], [EraCode], [IsActive]) VALUES
        ('7EB482DF-4424-4F4B-815E-19A0C32FCB03', N'KEY-CATEGORY-JADE', N'玉器類解鎖鑰匙', N'CATEGORY', N'JADE', NULL, 1),
        ('080A1E6E-8699-4CAE-ABBE-1FA6AD089B0A', N'KEY-ERA-YUAN', N'元代解鎖鑰匙', N'ERA', NULL, N'YUAN', 1),
        ('6629D8AB-E0AC-4A7D-87B7-2796E7445545', N'KEY-ERA-HAN', N'漢代解鎖鑰匙', N'ERA', NULL, N'HAN', 1),
        ('53947C08-AC6C-4F0D-A2CB-2A62B2188A6F', N'KEY-CATEGORY-CERAMIC', N'陶瓷類解鎖鑰匙', N'CATEGORY', N'CERAMIC', NULL, 1),
        ('C0416075-B472-EEAA-D50F-3D6C38387B71', N'FIXTURE-NORMAL', N'一般解鎖鑰匙（停用）', N'NORMAL', NULL, NULL, 0),
        ('31C6847E-F26F-46D8-AF0D-4091C639FEA5', N'KEY-ERA-WESTERN_XIA', N'西夏時代解鎖鑰匙', N'ERA', NULL, N'WESTERN_XIA', 0),
        ('5B95B67B-22C6-4197-969C-426D82706A54', N'KEY-CATEGORY-CARVING', N'雕刻類解鎖鑰匙', N'CATEGORY', N'CARVING', NULL, 1),
        ('085BDF22-F48A-4DB3-BA08-4DBFF728105E', N'KEY-CATEGORY-BRONZE', N'銅器類解鎖鑰匙', N'CATEGORY', N'BRONZE', NULL, 1),
        ('BBBFC0B7-9BA9-4FF8-A70F-586579176EE5', N'KEY-ERA-JAPAN_MEIJI', N'日本明治時代解鎖鑰匙', N'ERA', NULL, N'JAPAN_MEIJI', 1),
        ('55DE4B72-2F61-454F-A2D7-7071C51E3A65', N'KEY-ERA-TANG', N'唐代解鎖鑰匙', N'ERA', NULL, N'TANG', 1),
        ('31F956B9-F0E8-43D2-B132-73B9B65A6A28', N'KEY-ERA-SONG', N'宋代解鎖鑰匙', N'ERA', NULL, N'SONG', 1),
        ('3C8CEE82-7167-4993-A2C6-7636C2629784', N'KEY-ERA-SPRING_AUTUMN', N'春秋時代解鎖鑰匙', N'ERA', NULL, N'SPRING_AUTUMN', 1),
        ('43DBFB41-3D4F-4D12-85AB-A13D195F8A6E', N'KEY-ERA-ZHOU', N'周代解鎖鑰匙', N'ERA', NULL, N'ZHOU', 1),
        ('1B373CA6-9675-4E5B-B7F6-A3BEC491BABE', N'KEY-CATEGORY-ENAMEL', N'琺瑯器類解鎖鑰匙', N'CATEGORY', N'ENAMEL', NULL, 1),
        ('9104E01E-BD06-48BD-8124-B2538B3EDBCA', N'KEY-ERA-MING', N'明代解鎖鑰匙', N'ERA', NULL, N'MING', 1),
        ('7A59FC2A-447D-4696-BD23-BC102AF137C2', N'KEY-UNIVERSAL', N'萬能鑰匙', N'UNIVERSAL', NULL, NULL, 1),
        ('4151AED3-AD2F-4F2E-82C9-BED4632B89D2', N'KEY-ERA-QING', N'清代解鎖鑰匙', N'ERA', NULL, N'QING', 1),
        ('0086AE0C-B8E5-4123-8044-C3326E2953E8', N'KEY-NORMAL', N'一般鑰匙', N'NORMAL', NULL, NULL, 0),
        ('B022EB08-061C-44F6-8A93-C8F88E43F8A1', N'KEY-ERA-WARRING_STATES', N'戰國時代解鎖鑰匙', N'ERA', NULL, N'WARRING_STATES', 1),
        ('ED5C2044-FCCE-405F-AED6-E9526F603DBE', N'KEY-CATEGORY-COIN', N'錢幣類解鎖鑰匙', N'CATEGORY', N'COIN', NULL, 1),
        ('4210DDB4-A9EE-4424-89F8-EF9633322866', N'KEY-CATEGORY-PAINTING', N'繪畫類解鎖鑰匙', N'CATEGORY', N'PAINTING', NULL, 1),
        ('059E7BCA-48E8-484A-B5D5-FB38976F9E9B', N'KEY-CATEGORY-LACQUER', N'漆器類解鎖鑰匙', N'CATEGORY', N'LACQUER', NULL, 1),
        ('96D7978B-F625-4D87-BB1A-FD95CDADB2CD', N'KEY-ERA-JAPAN_TAISHO', N'日本大正時代解鎖鑰匙', N'ERA', NULL, N'JAPAN_TAISHO', 1);

    IF EXISTS
    (
        SELECT 1
        FROM @KeyDefinitionSeeds s
        LEFT JOIN [catalog].[ArtifactCategories] c ON c.[Code] = s.[CategoryCode]
        LEFT JOIN [catalog].[EraBuckets] e ON e.[Code] = s.[EraCode]
        WHERE (s.[CategoryCode] IS NOT NULL AND c.[Id] IS NULL)
           OR (s.[EraCode] IS NOT NULL AND e.[Id] IS NULL)
    )
        THROW 50003, '鑰匙展示資料所需的分類或年代不存在', 1;

    INSERT INTO [catalog].[KeyDefinitions] ([Id], [Code], [Name], [ScopeType], [CategoryId], [EraBucketId], [IsActive])
    SELECT s.[Id], s.[Code], s.[Name], s.[ScopeType], c.[Id], e.[Id], s.[IsActive]
    FROM @KeyDefinitionSeeds s
    LEFT JOIN [catalog].[ArtifactCategories] c ON c.[Code] = s.[CategoryCode]
    LEFT JOIN [catalog].[EraBuckets] e ON e.[Code] = s.[EraCode]
    WHERE NOT EXISTS (SELECT 1 FROM [catalog].[KeyDefinitions] k WHERE k.[Code] = s.[Code]);

    DECLARE @KeyGrants TABLE
    (
        [Email] nvarchar(256) NOT NULL,
        [KeyCode] nvarchar(50) NOT NULL,
        [Balance] int NOT NULL
    );

    /* 每位會員持有不同組合與數量，涵蓋分類、年代、一般與萬能鑰匙。 */
    INSERT INTO @KeyGrants ([Email], [KeyCode], [Balance]) VALUES
        (N'admin@qmah.local',   N'KEY-UNIVERSAL',          5),
        (N'admin@qmah.local',   N'KEY-NORMAL',             3),
        (N'admin@qmah.local',   N'KEY-CATEGORY-BRONZE',    2),
        (N'admin@qmah.local',   N'KEY-ERA-MING',            1),
        (N'admin@qmah.local',   N'KEY-CATEGORY-JADE',      1),
        (N'admin@qmah.local',   N'KEY-ERA-HAN',             2),
        (N'catalog@qmah.local', N'KEY-UNIVERSAL',           2),
        (N'catalog@qmah.local', N'KEY-NORMAL',              5),
        (N'catalog@qmah.local', N'KEY-CATEGORY-CERAMIC',    3),
        (N'catalog@qmah.local', N'KEY-ERA-TANG',             2),
        (N'catalog@qmah.local', N'KEY-ERA-SONG',             1),
        (N'catalog@qmah.local', N'KEY-CATEGORY-ENAMEL',      2),
        (N'game@qmah.local',    N'KEY-UNIVERSAL',           4),
        (N'game@qmah.local',    N'KEY-NORMAL',              2),
        (N'game@qmah.local',    N'KEY-CATEGORY-BRONZE',     1),
        (N'game@qmah.local',    N'KEY-ERA-MING',             2),
        (N'game@qmah.local',    N'KEY-CATEGORY-COIN',        2),
        (N'game@qmah.local',    N'KEY-ERA-YUAN',              1),
        (N'player-a@qmah.local', N'KEY-UNIVERSAL',          1),
        (N'player-a@qmah.local', N'KEY-NORMAL',             1),
        (N'player-a@qmah.local', N'KEY-CATEGORY-JADE',      4),
        (N'player-a@qmah.local', N'KEY-ERA-HAN',             2),
        (N'player-a@qmah.local', N'KEY-CATEGORY-CARVING',    1),
        (N'player-a@qmah.local', N'KEY-ERA-WARRING_STATES',  2),
        (N'player-b@qmah.local', N'KEY-UNIVERSAL',          3),
        (N'player-b@qmah.local', N'KEY-NORMAL',             2),
        (N'player-b@qmah.local', N'KEY-CATEGORY-CERAMIC',    2),
        (N'player-b@qmah.local', N'KEY-ERA-YUAN',             3),
        (N'player-b@qmah.local', N'KEY-ERA-WESTERN_XIA',      1),
        (N'player-b@qmah.local', N'KEY-CATEGORY-LACQUER',     1),
        (N'social@qmah.local',  N'KEY-UNIVERSAL',           2),
        (N'social@qmah.local',  N'KEY-NORMAL',              4),
        (N'social@qmah.local',  N'KEY-CATEGORY-PAINTING',    2),
        (N'social@qmah.local',  N'KEY-ERA-SONG',              2),
        (N'social@qmah.local',  N'KEY-ERA-SPRING_AUTUMN',     1),
        (N'social@qmah.local',  N'KEY-ERA-QING',                1),
        (N'store@qmah.local',   N'KEY-UNIVERSAL',           1),
        (N'store@qmah.local',   N'KEY-NORMAL',              3),
        (N'store@qmah.local',   N'KEY-CATEGORY-ENAMEL',      1),
        (N'store@qmah.local',   N'KEY-ERA-MING',              3),
        (N'store@qmah.local',   N'KEY-ERA-JAPAN_MEIJI',       1),
        (N'store@qmah.local',   N'KEY-CATEGORY-BRONZE',       2),
        (N'user@qmah.local',    N'KEY-UNIVERSAL',           2),
        (N'user@qmah.local',    N'KEY-NORMAL',              1),
        (N'user@qmah.local',    N'KEY-CATEGORY-LACQUER',     2),
        (N'user@qmah.local',    N'KEY-ERA-TANG',              1),
        (N'user@qmah.local',    N'KEY-ERA-JAPAN_TAISHO',      2),
        (N'user@qmah.local',    N'KEY-CATEGORY-COIN',          1),
        (N'user@qmah.local',    N'KEY-ERA-ZHOU',               1);

    UPDATE b
    SET b.[Balance] = g.[Balance], b.[UpdatedAt] = @Now
    FROM [catalog].[UserKeyBalances] b
    INNER JOIN [user].[AspNetUsers] u ON u.[Id] = b.[UserId]
    INNER JOIN [catalog].[KeyDefinitions] k ON k.[Id] = b.[KeyDefinitionId]
    INNER JOIN @KeyGrants g ON g.[Email] = u.[Email] AND g.[KeyCode] = k.[Code];

    INSERT INTO [catalog].[UserKeyBalances] ([UserId], [KeyDefinitionId], [Balance], [UpdatedAt])
    SELECT u.[Id], k.[Id], g.[Balance], @Now
    FROM @KeyGrants g
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = g.[Email]
    INNER JOIN [catalog].[KeyDefinitions] k ON k.[Code] = g.[KeyCode]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [catalog].[UserKeyBalances] b
        WHERE b.[UserId] = u.[Id] AND b.[KeyDefinitionId] = k.[Id]
    );

    INSERT INTO [catalog].[KeyTransactions]
    ([Id], [UserId], [KeyDefinitionId], [Amount], [Reason], [ReferenceType], [ReferenceId], [CreatedAt])
    SELECT NEWID(), u.[Id], k.[Id], g.[Balance], N'ADMIN_GRANT', N'SHOWCASE_GRANT', NULL, DATEADD(DAY, -1, @Now)
    FROM @KeyGrants g
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = g.[Email]
    INNER JOIN [catalog].[KeyDefinitions] k ON k.[Code] = g.[KeyCode]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [catalog].[KeyTransactions] t
        WHERE t.[UserId] = u.[Id]
          AND t.[KeyDefinitionId] = k.[Id]
          AND t.[ReferenceType] = N'SHOWCASE_GRANT'
    );

    /* 活動：涵蓋官方／玩家、審核狀態與發布狀態。 */
    DECLARE @EventSeeds TABLE
    (
        [Title] nvarchar(150) NOT NULL,
        [EventType] nvarchar(20) NOT NULL,
        [OrganizerUserId] uniqueidentifier NULL,
        [Content] nvarchar(max) NOT NULL,
        [Location] nvarchar(200) NULL,
        [Latitude] decimal(9,6) NULL,
        [Longitude] decimal(9,6) NULL,
        [StartDays] int NOT NULL,
        [DurationHours] int NOT NULL,
        [RegistrationDays] int NULL,
        [Capacity] int NULL,
        [ReviewStatus] nvarchar(20) NOT NULL,
        [PublishStatus] nvarchar(20) NOT NULL,
        [ReviewNote] nvarchar(500) NULL,
        [ReviewedByUserId] uniqueidentifier NULL
    );

    /* 舊版曾在標題前加上展示前綴，這裡只整理文字，不改變活動主鍵或審核狀態。 */
    UPDATE eventData
    SET eventData.[Title] = REPLACE(eventData.[Title], N'展示活動｜', N'')
    FROM [social].[Events] AS eventData
    WHERE eventData.[Title] LIKE N'展示活動｜%';

    /* 將早期展示腳本多出的活動清掉，保留一筆既有基礎活動與七筆展示活動。 */
    DELETE registration
    FROM [social].[EventRegistrations] AS registration
    INNER JOIN [social].[Events] AS eventData ON eventData.[Id] = registration.[EventId]
    WHERE eventData.[Title] IN (N'館藏問答特別場', N'新手鑑定練習桌', N'材質觀察小聚');

    DELETE FROM [social].[Events]
    WHERE [Title] IN (N'館藏問答特別場', N'新手鑑定練習桌', N'材質觀察小聚');

    INSERT INTO @EventSeeds
        ([Title], [EventType], [OrganizerUserId], [Content], [Location], [Latitude], [Longitude], [StartDays], [DurationHours], [RegistrationDays], [Capacity], [ReviewStatus], [PublishStatus], [ReviewNote], [ReviewedByUserId])
    VALUES
        (N'青銅器紋飾讀圖工作坊', N'OFFICIAL', @CatalogUserId, N'本場從幾何紋、動物紋與器身轉折開始，帶著參加者練習把「看見的線條」和「對紋飾的推測」分開記錄。前半段會以完整影像建立觀看順序，後半段再放大器口、腹部與底部的局部，對照鑄造痕跡、構圖節奏與容易被光線掩蓋的細節。參加者不需要先熟悉專有名詞，只要帶著一個想查證的問題即可。', N'國立故宮博物院正館｜文獻導讀室', 25.102400, 121.548500, 5, 3, 2, 24, N'APPROVED', N'PUBLISHED', N'活動內容與報名資訊已確認。', @AdminUserId),
        (N'週末館藏導讀：從器形看年代', N'OFFICIAL', @CatalogUserId, N'本次導讀挑選三件不同時期的器物，先從通高、口徑、腹部比例與器足觀察整體形制，再回到材質、紋飾和來源欄位交叉比對。講者會示範如何保留年代原文與不確定範圍，也會安排一段讓參加者把自己的第一印象改寫成可以回查的觀察筆記，適合第一次使用圖鑑或想練習慢慢看作品的參加者。', N'國立故宮博物院南部院區（故宮南院）｜多功能展廳', 23.470900, 120.294100, 12, 2, 9, 40, N'APPROVED', N'PUBLISHED', N'已完成場次與講者資料確認。', @AdminUserId),
        (N'玩家交流：我第一次看懂的細節', N'PLAYER', @PlayerAUserId, N'這是一場由玩家帶路的交流，大家可以分享自己在圖鑑裡第一次真正看懂的細節，也可以帶著曾經猜錯的作品來討論。流程會先用五分鐘說明作品名稱與資料來源，再交換辨識方法、查找過程和仍然沒有答案的問題；不要求每個人得出相同結論，重點是讓其他會員知道你的觀察從哪裡開始。', N'社群線上交流室', NULL, NULL, 18, 2, 16, 16, N'APPROVED', N'PUBLISHED', N'符合玩家交流活動規範。', @AdminUserId),
        (N'夜間文物猜謎會', N'PLAYER', @PlayerBUserId, N'活動會以局部圖像、簡短提示卡和分組討論進行三個回合；每回合先讓大家寫下看到的線索，再逐步開放材質、器形或來源提示。揭曉後不只公布答案，也會一起回看哪些判斷有圖鑑資料支持、哪些只是當下的直覺。適合想用輕鬆方式練習觀察，又願意把推理過程說出來的玩家。', N'清明鑑定屋｜二樓活動室', NULL, NULL, 25, 2, 22, 30, N'PENDING', N'DRAFT', NULL, NULL),
        (N'古典色彩與保存觀察', N'OFFICIAL', @CatalogUserId, N'本場會從常見顏料、釉色與表面保存狀態切入，帶領參加者比較色彩變化在辨識上的幫助與限制。除了看作品本身，也會討論拍攝光線、反光、修復痕跡和螢幕顯示可能造成的誤判，最後將一段過度肯定的描述改寫成保留證據範圍的觀察筆記。活動結束後可回到圖鑑繼續查找相關作品。', N'國立故宮博物院南部院區（故宮南院）｜教育展廳', 23.470900, 120.294100, -5, 3, -12, 18, N'APPROVED', N'CANCELLED', N'因場地維護取消本場活動，後續將另行公告。', @AdminUserId),
        (N'玩家提案：我的地方文物小旅行', N'PLAYER', @PlayerAUserId, N'這個提案想從地方博物館、歷史建築與沿線街區開始，分享一條可以實際走訪的文物小旅行。發起人預計整理交通方式、開放時間、建議停留長度、照片來源與每一站想觀察的問題，也歡迎其他會員補充自己的路線。正式成團前會先確認活動流程、集合方式與可公開使用的資料來源。', N'社群線上交流室', NULL, NULL, 30, 2, 24, 20, N'REJECTED', N'DRAFT', N'目前提案缺少明確的活動流程與資料來源，請補充後重新送審。', @AdminUserId),
        (N'小型器物的手感與比例', N'OFFICIAL', @GameUserId, N'本場從鑑定遊戲裡常見的小型器物題目延伸，先讓參加者比較不同作品的通高、口徑、器壁厚薄與可想像的拿取方式，再討論「手感」哪些可以從資料推測、哪些必須保留為想像。活動會把遊戲作答、圖鑑欄位和個人筆記放在一起回顧，練習不要只用一個醒目的特徵替作品下結論。', N'線上交流室', NULL, NULL, 8, 2, 6, 28, N'PENDING', N'DRAFT', NULL, NULL);

    /* 讓重跑腳本時，既有展示活動也能同步最新的地點與座標。 */
    UPDATE eventData
    SET eventData.[Content] = seed.[Content],
        eventData.[Location] = seed.[Location],
        eventData.[Latitude] = seed.[Latitude],
        eventData.[Longitude] = seed.[Longitude]
    FROM [social].[Events] AS eventData
    INNER JOIN @EventSeeds AS seed ON seed.[Title] = eventData.[Title];

    INSERT INTO [social].[Events]
    (
        [Id], [EventType], [OrganizerUserId], [Title], [Content], [Location], [Latitude], [Longitude], [StartAt], [EndAt], [RegistrationEndAt], [Capacity], [ReviewStatus], [PublishStatus], [ReviewNote], [ReviewedByUserId], [ReviewedAt], [CreatedAt]
    )
    SELECT NEWID(), s.[EventType], s.[OrganizerUserId], s.[Title], s.[Content], s.[Location], s.[Latitude], s.[Longitude],
           DATEADD(DAY, s.[StartDays], @Now), DATEADD(HOUR, s.[DurationHours], DATEADD(DAY, s.[StartDays], @Now)),
           CASE WHEN s.[RegistrationDays] IS NULL THEN NULL ELSE DATEADD(DAY, s.[RegistrationDays], @Now) END,
           s.[Capacity], s.[ReviewStatus], s.[PublishStatus], s.[ReviewNote], s.[ReviewedByUserId],
           CASE WHEN s.[ReviewedByUserId] IS NULL THEN NULL ELSE DATEADD(DAY, s.[StartDays] - 2, @Now) END,
           DATEADD(DAY, s.[StartDays] - 10, @Now)
    FROM @EventSeeds s
    WHERE NOT EXISTS (SELECT 1 FROM [social].[Events] e WHERE e.[Title] = s.[Title]);

    /* 活動報名：同時保留已報名、候補與取消的操作情境。 */
    DECLARE @RegistrationSeeds TABLE ([Title] nvarchar(150), [UserId] uniqueidentifier, [Status] nvarchar(20));
    INSERT INTO @RegistrationSeeds VALUES
        (N'青銅器紋飾讀圖工作坊', @UserId, N'REGISTERED'),
        (N'青銅器紋飾讀圖工作坊', @PlayerAUserId, N'REGISTERED'),
        (N'週末館藏導讀：從器形看年代', @PlayerBUserId, N'ATTENDED'),
        (N'玩家交流：我第一次看懂的細節', @UserId, N'REGISTERED'),
        (N'夜間文物猜謎會', @SocialUserId, N'REGISTERED');

    INSERT INTO [social].[EventRegistrations] ([Id], [EventId], [UserId], [Status], [RegisteredAt])
    SELECT NEWID(), e.[Id], r.[UserId], r.[Status], DATEADD(DAY, -3, @Now)
    FROM @RegistrationSeeds r
    INNER JOIN [social].[Events] e ON e.[Title] = r.[Title]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [social].[EventRegistrations] x
        WHERE x.[EventId] = e.[Id] AND x.[UserId] = r.[UserId]
    );

    /* 檢舉：使用不同原因、目標類型與處理結果，方便展示篩選與審核。 */
    DECLARE @ReportSeeds TABLE
    (
        [No] int NOT NULL,
        [TargetType] nvarchar(20) NOT NULL,
        [Reason] nvarchar(100) NOT NULL,
        [Detail] nvarchar(1000) NOT NULL,
        [Status] nvarchar(20) NOT NULL
    );

    /* 移除舊版資料的流水號前綴，保留檢舉主鍵、目標與處理狀態。 */
    UPDATE reportData
    SET reportData.[Reason] = N'OTHER',
        reportData.[Detail] = N'留言內容與討論主題無關，請依上下文確認是否需要隱藏。'
    FROM [social].[ContentReports] AS reportData
    WHERE reportData.[Reason] = N'測試檢舉流程'
       OR reportData.[Detail] = N'這筆資料用於後台待審核列表。';

    UPDATE reportData
    SET reportData.[Detail] = CASE
        WHEN reportData.[Detail] = N'測試檢舉流程'
            THEN N'留言內容與討論主題無關，請依上下文確認是否需要隱藏。'
        ELSE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(reportData.[Detail],
                    N'展示檢舉｜01｜', N''), N'展示檢舉｜02｜', N''), N'展示檢舉｜03｜', N''),
                    N'展示檢舉｜04｜', N''), N'展示檢舉｜05｜', N''), N'展示檢舉｜06｜', N''),
                    N'展示檢舉｜07｜', N''), N'展示檢舉｜08｜', N''), N'展示檢舉｜09｜', N''),
                    N'展示檢舉｜10｜', N''), N'展示檢舉｜11｜', N''), N'展示檢舉｜12｜', N'')
        END
    FROM [social].[ContentReports] AS reportData
    WHERE reportData.[Detail] LIKE N'展示檢舉｜%'
       OR reportData.[Detail] = N'測試檢舉流程';

    /* 將早期展示腳本多出的五筆檢舉清掉，保留既有基礎資料與七筆展示情境。 */
    DELETE FROM [social].[ContentReports]
    WHERE [Detail] IN
    (
        N'留言引用的館藏編號可能有誤，建議請發文者補上查證來源。',
        N'貼文使用其他網站的完整文字，可能涉及未標示來源的轉載。',
        N'留言內容與原討論無關，但目前資料不足以判定為違規。',
        N'貼文回覆區出現針對特定會員的連續指責，請一併查看留言串。',
        N'留言提供疑似違規交易方式，請確認內容是否應該移除。'
    );

    INSERT INTO @ReportSeeds VALUES
        (1, N'POST', N'SPAM', N'同一段宣傳內容在不同板塊重複出現，建議確認是否為重複貼文。', N'PENDING'),
        (2, N'COMMENT', N'HARASSMENT', N'留言語氣帶有針對個人的嘲諷，請檢查前後文並確認是否需要處理。', N'PENDING'),
        (3, N'POST', N'MISINFORMATION', N'貼文把推測內容寫成確定年代，與圖鑑資料不一致，請核對來源。', N'RESOLVED'),
        (4, N'COMMENT', N'COPYRIGHT', N'留言附上的圖片疑似不是本人拍攝，已有來源線索可供查驗。', N'PENDING'),
        (5, N'POST', N'ILLEGAL_CONTENT', N'內容包含不適合在社群公開分享的交易資訊，請確認是否違反使用規範。', N'REJECTED'),
        (6, N'COMMENT', N'SPAM', N'短時間內連續留下相同網址，疑似與討論主題無關。', N'RESOLVED'),
        (7, N'POST', N'OTHER', N'貼文標題與內容不符，閱讀者很難從板塊分類判斷主題。', N'PENDING');

    ;WITH PostTargets AS
    (
        SELECT [Id], ROW_NUMBER() OVER (ORDER BY [CreatedAt], [Id]) AS [No]
        FROM [social].[SocialPosts]
        WHERE [Title] LIKE N'觀察筆記｜%' AND [Status] <> N'DELETED'
    ), CommentTargets AS
    (
        SELECT [Id], ROW_NUMBER() OVER (ORDER BY [CreatedAt], [Id]) AS [No]
        FROM [social].[SocialComments]
        WHERE [Status] <> N'HIDDEN'
    )
    INSERT INTO [social].[ContentReports]
    ([Id], [ReporterUserId], [TargetType], [TargetId], [Reason], [Detail], [Status], [Resolution], [ReviewedByUserId], [ReviewedAt], [CreatedAt])
    SELECT NEWID(), COALESCE(@SocialUserId, @UserId), s.[TargetType],
           CASE WHEN s.[TargetType] = N'POST' THEN p.[Id] ELSE c.[Id] END,
           s.[Reason], s.[Detail], s.[Status],
           CASE s.[Status] WHEN N'RESOLVED' THEN N'已確認內容與主題不符，完成提醒或隱藏處理。'
                            WHEN N'REJECTED' THEN N'檢視內容後未達處理條件，保留原內容。' ELSE NULL END,
           CASE WHEN s.[Status] = N'PENDING' THEN NULL ELSE COALESCE(@AdminUserId, @UserId) END,
           CASE WHEN s.[Status] = N'PENDING' THEN NULL ELSE DATEADD(DAY, -1, @Now) END,
           DATEADD(DAY, -(14 - s.[No]), @Now)
    FROM @ReportSeeds s
    LEFT JOIN PostTargets p ON p.[No] = s.[No] AND s.[TargetType] = N'POST'
    LEFT JOIN CommentTargets c ON c.[No] = s.[No] AND s.[TargetType] = N'COMMENT'
    WHERE (s.[TargetType] = N'POST' AND p.[Id] IS NOT NULL OR s.[TargetType] = N'COMMENT' AND c.[Id] IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM [social].[ContentReports] x WHERE x.[Detail] = s.[Detail]);

    /* 成就：使用後台已支援的條件代碼，並提供不同解鎖門檻。 */
    DECLARE @AchievementSeeds TABLE
    (
        [Code] nvarchar(80) NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Title] nvarchar(120) NOT NULL,
        [Description] nvarchar(500) NOT NULL,
        [ConditionType] nvarchar(40) NOT NULL,
        [ThresholdValue] bigint NOT NULL,
        [Status] nvarchar(20) NOT NULL
    );
    INSERT INTO @AchievementSeeds VALUES
        (N'SHOWCASE_ACHIEVEMENT_FIRST_POST', N'留下第一筆觀察', N'把發現寫下來', N'發布第一篇與文物觀察有關的貼文。', N'POST_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_ACTIVE_READER', N'認真讀者', N'每則留言都有線索', N'在社群中留下五則有內容的留言。', N'COMMENT_COUNT', 5, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_START', N'圖鑑起步', N'打開第一件文物', N'解鎖第一件圖鑑文物，開始建立自己的收藏紀錄。', N'ARTIFACT_UNLOCK_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_EXPLORER', N'館藏探索者', N'走過十件文物', N'累積解鎖十件不同的圖鑑文物。', N'ARTIFACT_UNLOCK_COUNT', 10, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_GAME_PARTICIPANT', N'鑑定練習生', N'先從參加開始', N'參與三次鑑定遊戲，不論結果都能累積經驗。', N'GAME_PLAY_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_GAME_WINNER', N'眼力初成', N'答對三場鑑定', N'在鑑定遊戲中累積三場勝利。', N'GAME_WIN_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_EVENT_VISITOR', N'活動常客', N'在現場遇見同好', N'完成三次活動報名並參與交流。', N'EVENT_JOIN_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_POINT_COLLECTOR', N'點數收藏家', N'把每次互動留下來', N'累積取得一千點會員點數。', N'POINT_TOTAL', 1000, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CAREFUL_READER', N'細節觀察家', N'放大才看見的線索', N'完成二十五件文物的解鎖紀錄。', N'ARTIFACT_UNLOCK_COUNT', 25, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_EVENT_HOST', N'交流發起人', N'讓討論有一個開始', N'建立一場玩家活動並完成審核。', N'EVENT_JOIN_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_QUIET_ARCHIVE', N'資料整理員', N'把線索慢慢收好', N'累積發布十篇貼文，整理個人的觀察脈絡。', N'POST_COUNT', 10, N'INACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_GAME_MASTER', N'鑑定老手', N'穩定找出答案', N'在鑑定遊戲中累積十場勝利。', N'GAME_WIN_COUNT', 10, N'ACTIVE');

    INSERT INTO [user].[Achievements]
    ([Id], [Code], [Name], [Title], [Description], [IconPath], [ConditionType], [ThresholdValue], [Status], [CreatedAt], [UpdatedAt])
    SELECT NEWID(), s.[Code], s.[Name], s.[Title], s.[Description], NULL, s.[ConditionType], s.[ThresholdValue], s.[Status], DATEADD(DAY, -60, @Now), @Now
    FROM @AchievementSeeds s
    WHERE NOT EXISTS (SELECT 1 FROM [user].[Achievements] a WHERE a.[Code] = s.[Code]);

    DECLARE @AchievementAwards TABLE ([Email] nvarchar(256), [Code] nvarchar(80), [DaysAgo] int, [IsDisplayed] bit);
    INSERT INTO @AchievementAwards VALUES
        (N'user@qmah.local', N'SHOWCASE_ACHIEVEMENT_FIRST_POST', 30, 1),
        (N'user@qmah.local', N'SHOWCASE_ACHIEVEMENT_CATALOG_START', 28, 1),
        (N'user@qmah.local', N'SHOWCASE_ACHIEVEMENT_EVENT_VISITOR', 12, 0),
        (N'player-a@qmah.local', N'SHOWCASE_ACHIEVEMENT_GAME_PARTICIPANT', 20, 1),
        (N'player-a@qmah.local', N'SHOWCASE_ACHIEVEMENT_GAME_WINNER', 9, 1),
        (N'player-a@qmah.local', N'SHOWCASE_ACHIEVEMENT_POINT_COLLECTOR', 3, 0),
        (N'player-b@qmah.local', N'SHOWCASE_ACHIEVEMENT_ACTIVE_READER', 15, 1),
        (N'player-b@qmah.local', N'SHOWCASE_ACHIEVEMENT_CATALOG_EXPLORER', 7, 1),
        (N'social@qmah.local', N'SHOWCASE_ACHIEVEMENT_EVENT_HOST', 5, 0),
        (N'catalog@qmah.local', N'SHOWCASE_ACHIEVEMENT_CAREFUL_READER', 40, 1);

    INSERT INTO [user].[UserAchievements] ([Id], [UserId], [AchievementId], [AchievedAt], [IsDisplayed], [DisplayedAt])
    SELECT NEWID(), u.[Id], a.[Id], DATEADD(DAY, -w.[DaysAgo], @Now), w.[IsDisplayed],
           CASE WHEN w.[IsDisplayed] = 1 THEN DATEADD(DAY, -w.[DaysAgo] + 1, @Now) ELSE NULL END
    FROM @AchievementAwards w
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = w.[Email]
    INNER JOIN [user].[Achievements] a ON a.[Code] = w.[Code]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [user].[UserAchievements] x WHERE x.[UserId] = u.[Id] AND x.[AchievementId] = a.[Id]
    );

    /* 優惠券：包含未開始、進行中、已過期，以及固定金額／百分比。 */
    DECLARE @CouponSeeds TABLE
    (
        [Code] nvarchar(50) NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [DiscountType] nvarchar(20) NOT NULL,
        [DiscountValue] decimal(12,2) NOT NULL,
        [MinimumAmount] decimal(12,2) NOT NULL,
        [StartDays] int NOT NULL,
        [EndDays] int NOT NULL,
        [IsActive] bit NOT NULL
    );
    INSERT INTO @CouponSeeds VALUES
        (N'SHOWCASE_COUPON_WELCOME', N'新會員圖鑑禮', N'FIXED', 80, 500, -20, 35, 1),
        (N'SHOWCASE_COUPON_CATALOG10', N'圖鑑研究折扣', N'PERCENT', 10, 300, -5, 12, 1),
        (N'SHOWCASE_COUPON_EVENT150', N'活動同好回饋', N'FIXED', 150, 900, -2, 28, 1),
        (N'SHOWCASE_COUPON_AUTUMN15', N'秋日收藏優惠', N'PERCENT', 15, 1200, 7, 45, 1),
        (N'SHOWCASE_COUPON_ARCHIVE200', N'典藏專題回饋', N'FIXED', 200, 1800, -75, -20, 0),
        (N'SHOWCASE_COUPON_SMALL5', N'小額入門折扣', N'PERCENT', 5, 200, -40, 10, 0),
        (N'SHOWCASE_COUPON_GAME100', N'鑑定遊戲獎勵', N'FIXED', 100, 700, -10, 20, 1),
        (N'SHOWCASE_COUPON_REPAIR12', N'修復主題優惠', N'PERCENT', 12, 1500, 15, 60, 1),
        (N'SHOWCASE_COUPON_MEMBER300', N'會員日收藏券', N'FIXED', 300, 2200, -8, 3, 1),
        (N'SHOWCASE_COUPON_RESEARCH8', N'研究資料小折扣', N'PERCENT', 8, 600, -3, 90, 0),
        (N'SHOWCASE_COUPON_WINTER20', N'冬季預約優惠', N'PERCENT', 20, 2500, 60, 120, 1),
        (N'SHOWCASE_COUPON_LAST50', N'展期最後回饋', N'FIXED', 50, 350, -100, -3, 0);

    INSERT INTO [store].[CouponDefinitions]
    ([Id], [Code], [Name], [DiscountType], [DiscountValue], [MinimumAmount], [StartAt], [EndAt], [IsActive])
    SELECT NEWID(), s.[Code], s.[Name], s.[DiscountType], s.[DiscountValue], s.[MinimumAmount], DATEADD(DAY, s.[StartDays], @Now), DATEADD(DAY, s.[EndDays], @Now), s.[IsActive]
    FROM @CouponSeeds s
    WHERE NOT EXISTS (SELECT 1 FROM [store].[CouponDefinitions] c WHERE c.[Code] = s.[Code]);

    DECLARE @UserCouponSeeds TABLE ([Email] nvarchar(256), [Code] nvarchar(50), [Status] nvarchar(20), [DaysAgo] int);
    INSERT INTO @UserCouponSeeds VALUES
        (N'user@qmah.local', N'SHOWCASE_COUPON_WELCOME', N'AVAILABLE', 4),
        (N'user@qmah.local', N'SHOWCASE_COUPON_MEMBER300', N'USED', 6),
        (N'player-a@qmah.local', N'SHOWCASE_COUPON_GAME100', N'AVAILABLE', 3),
        (N'player-a@qmah.local', N'SHOWCASE_COUPON_ARCHIVE200', N'EXPIRED', 70),
        (N'player-b@qmah.local', N'SHOWCASE_COUPON_CATALOG10', N'USED', 11),
        (N'player-b@qmah.local', N'SHOWCASE_COUPON_REPAIR12', N'AVAILABLE', 1),
        (N'catalog@qmah.local', N'SHOWCASE_COUPON_RESEARCH8', N'AVAILABLE', 8),
        (N'social@qmah.local', N'SHOWCASE_COUPON_EVENT150', N'USED', 14),
        (N'game@qmah.local', N'SHOWCASE_COUPON_SMALL5', N'EXPIRED', 45);

    INSERT INTO [store].[UserCoupons] ([Id], [UserId], [CouponDefinitionId], [Status], [IssuedAt], [UsedAt])
    SELECT NEWID(), u.[Id], c.[Id], s.[Status], DATEADD(DAY, -s.[DaysAgo], @Now),
           CASE WHEN s.[Status] = N'USED' THEN DATEADD(DAY, -s.[DaysAgo] + 1, @Now) ELSE NULL END
    FROM @UserCouponSeeds s
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = s.[Email]
    INNER JOIN [store].[CouponDefinitions] c ON c.[Code] = s.[Code]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [store].[UserCoupons] x WHERE x.[UserId] = u.[Id] AND x.[CouponDefinitionId] = c.[Id]
    );

    /* 會員摘要資料：只補沒有資料的會員，不覆蓋組員原本的內容。 */
    INSERT INTO [user].[UserProfiles] ([UserId], [Nickname], [AvatarPath], [Bio], [Visibility], [CreatedAt], [UpdatedAt])
    SELECT u.[Id], v.[Nickname], NULL, v.[Bio], v.[Visibility], DATEADD(DAY, -50, @Now), @Now
    FROM (VALUES
        (N'user@qmah.local', N'Demo Member 01', N'喜歡從器形與材質開始認識文物。', N'PUBLIC'),
        (N'player-a@qmah.local', N'Demo Player 01', N'把每次遊戲都當成一次觀察練習。', N'PUBLIC'),
        (N'player-b@qmah.local', N'Demo Player 02', N'記錄在博物館裡遇到的細節。', N'FRIENDS'),
        (N'catalog@qmah.local', N'Demo Catalog', N'整理館藏資料，也歡迎大家提供不同角度的觀察。', N'PUBLIC'),
        (N'social@qmah.local', N'Demo Social Editor', N'協助大家找到適合交流的主題與活動。', N'PUBLIC')
    ) v([Email], [Nickname], [Bio], [Visibility])
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = v.[Email]
    WHERE NOT EXISTS (SELECT 1 FROM [user].[UserProfiles] p WHERE p.[UserId] = u.[Id]);

    INSERT INTO [user].[UserAddresses] ([Id], [UserId], [AddressLabel], [RecipientName], [RecipientPhone], [PostalCode], [City], [District], [AddressLine], [IsDefault], [CreatedAt], [UpdatedAt])
    SELECT NEWID(), u.[Id], a.[AddressLabel], a.[RecipientName], a.[RecipientPhone], a.[PostalCode], a.[City], a.[District], a.[AddressLine], a.[IsDefault], DATEADD(DAY, -30, @Now), @Now
    FROM (VALUES
        (N'user@qmah.local', N'住家', N'Demo Member 01', N'0912-345-678', N'106', N'臺北市', N'大安區', N'復興南路一段 100 號', CAST(1 AS bit)),
        (N'player-a@qmah.local', N'工作室', N'Demo Player 01', N'0922-456-789', N'400', N'臺中市', N'西區', N'公益路 88 號 3 樓', CAST(1 AS bit)),
        (N'catalog@qmah.local', N'辦公室', N'Demo Catalog', N'0933-567-890', N'100', N'臺北市', N'中正區', N'重慶南路一段 20 號', CAST(1 AS bit))
    ) a([Email], [AddressLabel], [RecipientName], [RecipientPhone], [PostalCode], [City], [District], [AddressLine], [IsDefault])
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = a.[Email]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [user].[UserAddresses] x WHERE x.[UserId] = u.[Id] AND x.[AddressLabel] = a.[AddressLabel]
    );

    /* 點數餘額與異動：保留可追溯的展示原因。 */
    INSERT INTO [store].[PointBalances] ([UserId], [Balance], [UpdatedAt])
    SELECT u.[Id], p.[Balance], @Now
    FROM (VALUES
        (N'user@qmah.local', 680),
        (N'player-a@qmah.local', 1280),
        (N'player-b@qmah.local', 420),
        (N'catalog@qmah.local', 2050),
        (N'social@qmah.local', 760)
    ) p([Email], [Balance])
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = p.[Email]
    WHERE NOT EXISTS (SELECT 1 FROM [store].[PointBalances] b WHERE b.[UserId] = u.[Id]);

    DECLARE @PointSeeds TABLE ([Email] nvarchar(256), [Amount] int, [Reason] nvarchar(40), [ReferenceType] nvarchar(40), [DaysAgo] int);
    INSERT INTO @PointSeeds VALUES
        (N'user@qmah.local', 120, N'完成會員資料', N'SHOWCASE', 30),
        (N'user@qmah.local', 260, N'參加社群活動', N'SHOWCASE', 12),
        (N'player-a@qmah.local', 500, N'完成鑑定遊戲', N'SHOWCASE', 20),
        (N'player-a@qmah.local', 780, N'遊戲連勝獎勵', N'SHOWCASE', 9),
        (N'player-b@qmah.local', 150, N'發布研究貼文', N'SHOWCASE', 15),
        (N'player-b@qmah.local', -80, N'兌換活動優惠券', N'SHOWCASE', 11),
        (N'catalog@qmah.local', 1000, N'完成館藏整理', N'SHOWCASE', 40),
        (N'social@qmah.local', 300, N'協助活動交流', N'SHOWCASE', 5);

    INSERT INTO [store].[PointTransactions] ([Id], [UserId], [Amount], [Reason], [ReferenceType], [ReferenceId], [CreatedAt])
    SELECT NEWID(), u.[Id], p.[Amount], p.[Reason], p.[ReferenceType], NULL, DATEADD(DAY, -p.[DaysAgo], @Now)
    FROM @PointSeeds p
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = p.[Email]
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [store].[PointTransactions] x
        WHERE x.[UserId] = u.[Id] AND x.[Amount] = p.[Amount] AND x.[Reason] = p.[Reason] AND x.[ReferenceType] = p.[ReferenceType]
    );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT N'活動' AS [資料類型], COUNT(*) AS [筆數] FROM [social].[Events] WHERE [Title] IN (N'青銅器紋飾讀圖工作坊', N'週末館藏導讀：從器形看年代', N'玩家交流：我第一次看懂的細節', N'夜間文物猜謎會', N'古典色彩與保存觀察', N'玩家提案：我的地方文物小旅行', N'小型器物的手感與比例')
UNION ALL SELECT N'檢舉', COUNT(*) FROM [social].[ContentReports] WHERE [Detail] IN (N'同一段宣傳內容在不同板塊重複出現，建議確認是否為重複貼文。', N'留言語氣帶有針對個人的嘲諷，請檢查前後文並確認是否需要處理。', N'貼文把推測內容寫成確定年代，與圖鑑資料不一致，請核對來源。', N'留言附上的圖片疑似不是本人拍攝，已有來源線索可供查驗。', N'內容包含不適合在社群公開分享的交易資訊，請確認是否違反使用規範。', N'短時間內連續留下相同網址，疑似與討論主題無關。', N'貼文標題與內容不符，閱讀者很難從板塊分類判斷主題。')
UNION ALL SELECT N'成就', COUNT(*) FROM [user].[Achievements] WHERE [Code] LIKE N'SHOWCASE_ACHIEVEMENT_%'
UNION ALL SELECT N'優惠券', COUNT(*) FROM [store].[CouponDefinitions] WHERE [Code] LIKE N'SHOWCASE_COUPON_%';
