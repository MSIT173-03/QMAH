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
        ('C0416075-B472-EEAA-D50F-3D6C38387B71', N'FIXTURE-NORMAL', N'開發測試鑰匙', N'NORMAL', NULL, NULL, 0),
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
        ('4151AED3-AD2F-4F2E-82C9-BED4632B89D2', N'KEY-ERA-REPUBLIC', N'民國時代解鎖鑰匙', N'ERA', NULL, N'REPUBLIC', 1),
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
        (N'social@qmah.local',  N'KEY-ERA-REPUBLIC',           1),
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
        [StartDays] int NOT NULL,
        [DurationHours] int NOT NULL,
        [RegistrationDays] int NULL,
        [Capacity] int NULL,
        [ReviewStatus] nvarchar(20) NOT NULL,
        [PublishStatus] nvarchar(20) NOT NULL,
        [ReviewNote] nvarchar(500) NULL,
        [ReviewedByUserId] uniqueidentifier NULL
    );

    INSERT INTO @EventSeeds
        ([Title], [EventType], [OrganizerUserId], [Content], [Location], [StartDays], [DurationHours], [RegistrationDays], [Capacity], [ReviewStatus], [PublishStatus], [ReviewNote], [ReviewedByUserId])
    VALUES
        (N'展示活動｜青銅器紋飾讀圖工作坊', N'OFFICIAL', @CatalogUserId, N'從幾何紋與動物紋切入，帶著參加者練習觀察器物表面的構圖與鑄造痕跡。', N'清明鑑定屋｜一樓研究室', 5, 3, 2, 24, N'APPROVED', N'PUBLISHED', N'活動內容與報名資訊已確認。', @AdminUserId),
        (N'展示活動｜週末館藏導讀：從器形看年代', N'OFFICIAL', @CatalogUserId, N'以三件不同時期的器物為例，整理器形、材質與用途之間的線索，適合第一次接觸圖鑑的參加者。', N'線上直播教室', 12, 2, 9, 40, N'APPROVED', N'PUBLISHED', N'已完成場次與講者資料確認。', @AdminUserId),
        (N'展示活動｜玩家交流：我第一次看懂的細節', N'PLAYER', @PlayerAUserId, N'開放玩家分享自己在圖鑑中第一次注意到的細節，從辨識方法到查找資料的過程都可以聊。', N'社群線上交流室', 18, 2, 16, 16, N'APPROVED', N'PUBLISHED', N'符合玩家交流活動規範。', @AdminUserId),
        (N'展示活動｜夜間文物猜謎會', N'PLAYER', @PlayerBUserId, N'以局部圖像與提示卡進行分組猜謎，完成後一起回看每個答案背後的判斷線索。', N'清明鑑定屋｜二樓活動室', 25, 2, 22, 30, N'PENDING', N'DRAFT', NULL, NULL),
        (N'展示活動｜古典色彩與保存觀察', N'OFFICIAL', @CatalogUserId, N'介紹常見顏料與表面保存狀態，帶領參加者比較色彩變化在辨識上的幫助與限制。', N'清明鑑定屋｜修復教室', -5, 3, -12, 18, N'APPROVED', N'CANCELLED', N'因場地維護取消本場活動，後續將另行公告。', @AdminUserId),
        (N'展示活動｜玩家提案：我的地方文物小旅行', N'PLAYER', @PlayerAUserId, N'分享地方博物館與古蹟走訪筆記，歡迎帶著自己的觀察照片來交換路線與資料來源。', N'社群線上交流室', 30, 2, 24, 20, N'REJECTED', N'DRAFT', N'目前提案缺少明確的活動流程與資料來源，請補充後重新送審。', @AdminUserId),
        (N'展示活動｜小型器物的手感與比例', N'OFFICIAL', @GameUserId, N'從遊戲裡常見的器物題目延伸，練習比較比例、重量感與使用痕跡如何影響判讀。', N'線上交流室', 8, 2, 6, 28, N'PENDING', N'DRAFT', NULL, NULL),
        (N'展示活動｜館藏問答特別場', N'OFFICIAL', @SocialUserId, N'用問答方式回顧本季社群裡最常被提到的館藏主題，並整理成方便查找的觀察筆記。', N'清明鑑定屋｜多功能室', -20, 2, -28, 32, N'APPROVED', N'PUBLISHED', N'已完成活動紀錄整理。', @AdminUserId),
        (N'展示活動｜新手鑑定練習桌', N'PLAYER', @PlayerBUserId, N'提供數個入門題目，讓剛開始使用圖鑑的玩家可以一起練習如何拆解題目與查找線索。', N'線上交流室', -2, 2, -6, 12, N'APPROVED', N'PUBLISHED', N'已確認活動內容與參加人數上限。', @AdminUserId),
        (N'展示活動｜材質觀察小聚', N'PLAYER', @UserId, N'以陶、木、金屬與織品為主題，分享不同材質在光線下呈現的差異，以及拍攝紀錄的小技巧。', N'清明鑑定屋｜一樓研究室', 40, 2, 35, 15, N'PENDING', N'DRAFT', NULL, NULL);

    INSERT INTO [social].[Events]
    (
        [Id], [EventType], [OrganizerUserId], [Title], [Content], [Location], [StartAt], [EndAt], [RegistrationEndAt], [Capacity], [ReviewStatus], [PublishStatus], [ReviewNote], [ReviewedByUserId], [ReviewedAt], [CreatedAt]
    )
    SELECT NEWID(), s.[EventType], s.[OrganizerUserId], s.[Title], s.[Content], s.[Location],
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
        (N'展示活動｜青銅器紋飾讀圖工作坊', @UserId, N'REGISTERED'),
        (N'展示活動｜青銅器紋飾讀圖工作坊', @PlayerAUserId, N'REGISTERED'),
        (N'展示活動｜週末館藏導讀：從器形看年代', @PlayerBUserId, N'ATTENDED'),
        (N'展示活動｜玩家交流：我第一次看懂的細節', @UserId, N'REGISTERED'),
        (N'展示活動｜夜間文物猜謎會', @SocialUserId, N'REGISTERED'),
        (N'展示活動｜館藏問答特別場', @PlayerAUserId, N'CANCELLED'),
        (N'展示活動｜新手鑑定練習桌', @UserId, N'REGISTERED'),
        (N'展示活動｜新手鑑定練習桌', @PlayerBUserId, N'REGISTERED');

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
    INSERT INTO @ReportSeeds VALUES
        (1, N'POST', N'SPAM', N'展示檢舉｜01｜同一段宣傳內容在不同板塊重複出現，建議確認是否為重複貼文。', N'PENDING'),
        (2, N'COMMENT', N'HARASSMENT', N'展示檢舉｜02｜留言語氣帶有針對個人的嘲諷，請檢查前後文並確認是否需要處理。', N'PENDING'),
        (3, N'POST', N'MISINFORMATION', N'展示檢舉｜03｜貼文把推測內容寫成確定年代，與圖鑑資料不一致，請核對來源。', N'RESOLVED'),
        (4, N'COMMENT', N'COPYRIGHT', N'展示檢舉｜04｜留言附上的圖片疑似不是本人拍攝，已有來源線索可供查驗。', N'PENDING'),
        (5, N'POST', N'ILLEGAL_CONTENT', N'展示檢舉｜05｜內容包含不適合在社群公開分享的交易資訊，請確認是否違反使用規範。', N'REJECTED'),
        (6, N'COMMENT', N'SPAM', N'展示檢舉｜06｜短時間內連續留下相同網址，疑似與討論主題無關。', N'RESOLVED'),
        (7, N'POST', N'OTHER', N'展示檢舉｜07｜貼文標題與內容不符，閱讀者很難從板塊分類判斷主題。', N'PENDING'),
        (8, N'COMMENT', N'MISINFORMATION', N'展示檢舉｜08｜留言引用的館藏編號可能有誤，建議請發文者補上查證來源。', N'RESOLVED'),
        (9, N'POST', N'COPYRIGHT', N'展示檢舉｜09｜貼文使用其他網站的完整文字，可能涉及未標示來源的轉載。', N'PENDING'),
        (10, N'COMMENT', N'OTHER', N'展示檢舉｜10｜留言內容與原討論無關，但目前資料不足以判定為違規。', N'REJECTED'),
        (11, N'POST', N'HARASSMENT', N'展示檢舉｜11｜貼文回覆區出現針對特定會員的連續指責，請一併查看留言串。', N'PENDING'),
        (12, N'COMMENT', N'ILLEGAL_CONTENT', N'展示檢舉｜12｜留言提供疑似違規交易方式，請確認內容是否應該移除。', N'RESOLVED');

    ;WITH PostTargets AS
    (
        SELECT [Id], ROW_NUMBER() OVER (ORDER BY [CreatedAt], [Id]) AS [No]
        FROM [social].[SocialPosts]
        WHERE [Title] LIKE N'文物觀察｜第 % 則討論' AND [Status] <> N'DELETED'
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
        (N'user@qmah.local', N'小滿', N'喜歡從器形與材質開始認識文物。', N'PUBLIC'),
        (N'player-a@qmah.local', N'明明來鑑定', N'把每次遊戲都當成一次觀察練習。', N'PUBLIC'),
        (N'player-b@qmah.local', N'拾光玩家', N'記錄在博物館裡遇到的細節。', N'FRIENDS'),
        (N'catalog@qmah.local', N'圖鑑編輯室', N'整理館藏資料，也歡迎大家提供不同角度的觀察。', N'PUBLIC'),
        (N'social@qmah.local', N'社群小編', N'協助大家找到適合交流的主題與活動。', N'PUBLIC')
    ) v([Email], [Nickname], [Bio], [Visibility])
    INNER JOIN [user].[AspNetUsers] u ON u.[Email] = v.[Email]
    WHERE NOT EXISTS (SELECT 1 FROM [user].[UserProfiles] p WHERE p.[UserId] = u.[Id]);

    INSERT INTO [user].[UserAddresses] ([Id], [UserId], [AddressLabel], [RecipientName], [RecipientPhone], [PostalCode], [City], [District], [AddressLine], [IsDefault], [CreatedAt], [UpdatedAt])
    SELECT NEWID(), u.[Id], a.[AddressLabel], a.[RecipientName], a.[RecipientPhone], a.[PostalCode], a.[City], a.[District], a.[AddressLine], a.[IsDefault], DATEADD(DAY, -30, @Now), @Now
    FROM (VALUES
        (N'user@qmah.local', N'住家', N'林小滿', N'0912-345-678', N'106', N'臺北市', N'大安區', N'復興南路一段 100 號', CAST(1 AS bit)),
        (N'player-a@qmah.local', N'工作室', N'陳明明', N'0922-456-789', N'400', N'臺中市', N'西區', N'公益路 88 號 3 樓', CAST(1 AS bit)),
        (N'catalog@qmah.local', N'辦公室', N'圖鑑編輯室', N'0933-567-890', N'100', N'臺北市', N'中正區', N'重慶南路一段 20 號', CAST(1 AS bit))
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

SELECT N'活動' AS [資料類型], COUNT(*) AS [筆數] FROM [social].[Events] WHERE [Title] LIKE N'展示活動｜%'
UNION ALL SELECT N'檢舉', COUNT(*) FROM [social].[ContentReports] WHERE [Detail] LIKE N'展示檢舉｜%'
UNION ALL SELECT N'成就', COUNT(*) FROM [user].[Achievements] WHERE [Code] LIKE N'SHOWCASE_ACHIEVEMENT_%'
UNION ALL SELECT N'優惠券', COUNT(*) FROM [store].[CouponDefinitions] WHERE [Code] LIKE N'SHOWCASE_COUPON_%';
