/*
   QMAH 參考資料庫展示資料

   這份腳本只補展示用資料，不會新增或修改資料表欄位
   請在已完成 Schema 與正式文物資料匯入的 QMAH 資料庫執行
   腳本具備辨識標題的防重複判斷，重複執行只會回傳目前筆數
*/
USE [QMAH];

SET NOCOUNT ON;

IF EXISTS
(
    SELECT 1
    FROM [social].[SocialPosts]
    WHERE [Title] LIKE N'文物觀察｜第 % 則討論'
)
BEGIN
    SELECT
        (SELECT COUNT(*) FROM [social].[SocialPosts]) AS [SocialPosts],
        (SELECT COUNT(*) FROM [social].[SocialComments]) AS [SocialComments];
    RETURN;
END;

DECLARE @UserId uniqueidentifier =
(
    SELECT TOP (1) [Id]
    FROM [user].[AspNetUsers]
    ORDER BY [CreatedAt], [Id]
);

IF @UserId IS NULL
    THROW 50001, '需要先有會員資料才能建立社群展示資料', 1;

DECLARE @i int = 1;
DECLARE @PostId uniqueidentifier;
DECLARE @ArtifactId uniqueidentifier;
DECLARE @BoardCode nvarchar(30);
DECLARE @Status nvarchar(20);

WHILE @i <= 48
BEGIN
    SET @PostId = NEWID();
    SET @ArtifactId = NULL;

    IF @i % 3 <> 0
    BEGIN
        SELECT @ArtifactId = [Id]
        FROM [catalog].[Artifacts]
        ORDER BY [Id]
        OFFSET ((@i - 1) % 256) ROWS FETCH NEXT 1 ROW ONLY;
    END;

    SET @BoardCode = CASE @i % 6
        WHEN 0 THEN N'GENERAL'
        WHEN 1 THEN N'CATALOG'
        WHEN 2 THEN N'GAME'
        WHEN 3 THEN N'EVENTS'
        WHEN 4 THEN N'DISCOVERY'
        ELSE N'REVIEW' END;

    SET @Status = CASE @i % 12
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
        @UserId,
        @ArtifactId,
        CONCAT(N'文物觀察｜第 ', @i, N' 則討論'),
        CONCAT(
            N'從館藏圖片與年代線索出發，整理一段適合社群交流的觀察。',
            N' 歡迎分享你注意到的材質、構圖或時代特徵，讓不同角度的閱讀都能留下紀錄。'
        ),
        @Status,
        DATEADD(HOUR, -@i, SYSUTCDATETIME()),
        DATEADD(MINUTE, -(@i % 40), SYSUTCDATETIME())
    );

    SET @i += 1;
END;

DECLARE @CommentIndex int = 1;
DECLARE @CommentPostId uniqueidentifier;
DECLARE @CommentUserId uniqueidentifier =
(
    SELECT TOP (1) [Id]
    FROM [user].[AspNetUsers]
    ORDER BY [Id]
);

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
        @CommentUserId,
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

SELECT
    (SELECT COUNT(*) FROM [social].[SocialPosts]) AS [SocialPosts],
    (SELECT COUNT(*) FROM [social].[SocialComments]) AS [SocialComments];
