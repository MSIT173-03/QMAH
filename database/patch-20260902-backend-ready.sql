/*
    QMAH Backend Ready 增量資料庫更新
    目的：將經濟、鑰匙進度、Mini Game、稱號、優惠券稽核與批次活動所需結構
    安全地補到既有 QMAH 資料庫。腳本可在已存在資料或由 Schema.sql／QMAH.sql
    建立的資料庫上重複執行；既有流水與會員資料不會被刪除。
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE [QMAH];
GO

BEGIN TRANSACTION;
BEGIN TRY
    IF SCHEMA_ID(N'admin') IS NULL EXEC(N'CREATE SCHEMA [admin]');
    IF SCHEMA_ID(N'common') IS NULL EXEC(N'CREATE SCHEMA [common]');
    IF SCHEMA_ID(N'catalog') IS NULL EXEC(N'CREATE SCHEMA [catalog]');
    IF SCHEMA_ID(N'game') IS NULL EXEC(N'CREATE SCHEMA [game]');
    IF SCHEMA_ID(N'store') IS NULL EXEC(N'CREATE SCHEMA [store]');
    IF SCHEMA_ID(N'user') IS NULL EXEC(N'CREATE SCHEMA [user]');

    /* 每日登入／簽到是跨系統會員活動，獨立放在 common schema，不綁定任一功能區。 */
    IF OBJECT_ID(N'common.DailyMemberActivities', N'U') IS NULL
    BEGIN
        CREATE TABLE [common].[DailyMemberActivities]
        (
            [Id] uniqueidentifier NOT NULL,
            [UserId] uniqueidentifier NOT NULL,
            [ActivityType] nvarchar(20) NOT NULL,
            [ActivityDate] date NOT NULL,
            [OccurrenceCount] int NOT NULL CONSTRAINT [DF_DailyMemberActivities_OccurrenceCount] DEFAULT (1),
            [FirstOccurredAt] datetime2(3) NOT NULL,
            [LastOccurredAt] datetime2(3) NOT NULL,
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_DailyMemberActivities_CreatedAt] DEFAULT (SYSUTCDATETIME()),
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_DailyMemberActivities_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_DailyMemberActivities] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_DailyMemberActivities_Type] CHECK ([ActivityType] IN (N'LOGIN', N'CHECK_IN')),
            CONSTRAINT [CK_DailyMemberActivities_OccurrenceCount] CHECK ([OccurrenceCount] > 0),
            CONSTRAINT [CK_DailyMemberActivities_Times] CHECK ([LastOccurredAt] >= [FirstOccurredAt] AND [UpdatedAt] >= [CreatedAt]),
            CONSTRAINT [FK_DailyMemberActivities_User] FOREIGN KEY ([UserId]) REFERENCES [user].[AspNetUsers] ([Id])
        );
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'common.DailyMemberActivities') AND name = N'UX_DailyMemberActivities_User_Type_Date')
        CREATE UNIQUE INDEX [UX_DailyMemberActivities_User_Type_Date]
            ON [common].[DailyMemberActivities] ([UserId], [ActivityType], [ActivityDate]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'common.DailyMemberActivities') AND name = N'IX_DailyMemberActivities_Type_Date_User')
        CREATE INDEX [IX_DailyMemberActivities_Type_Date_User]
            ON [common].[DailyMemberActivities] ([ActivityType], [ActivityDate], [UserId]);
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'common.DailyMemberActivities') AND name = N'IX_DailyMemberActivities_User_Type_Date')
        DROP INDEX [IX_DailyMemberActivities_User_Type_Date] ON [common].[DailyMemberActivities];

    /* KeyDefinition 的回收價值由後台調整，0 仍代表尚未設定。 */
    IF COL_LENGTH(N'catalog.KeyDefinitions', N'RecyclePointValue') IS NULL
    BEGIN
        ALTER TABLE [catalog].[KeyDefinitions]
            ADD [RecyclePointValue] int NOT NULL
                CONSTRAINT [DF_KeyDefinitions_RecyclePointValue] DEFAULT (0) WITH VALUES;
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_KeyDefinitions_RecyclePointValue')
        EXEC sys.sp_executesql N'
            ALTER TABLE [catalog].[KeyDefinitions]
                ADD CONSTRAINT [CK_KeyDefinitions_RecyclePointValue] CHECK ([RecyclePointValue] >= 0);';

    /* 優惠券定義區分取得方式，並以每張 UserCoupon 的 IssuedAt 計算期限。 */
    IF COL_LENGTH(N'store.CouponDefinitions', N'AcquisitionType') IS NULL
        ALTER TABLE [store].[CouponDefinitions]
            ADD [AcquisitionType] nvarchar(30) NOT NULL
                CONSTRAINT [DF_CouponDefinitions_AcquisitionType] DEFAULT (N'ADMIN_GRANT') WITH VALUES;
    IF COL_LENGTH(N'store.CouponDefinitions', N'PointCost') IS NULL
        ALTER TABLE [store].[CouponDefinitions] ADD [PointCost] int NULL;
    IF COL_LENGTH(N'store.CouponDefinitions', N'ValidityDays') IS NULL
        ALTER TABLE [store].[CouponDefinitions]
            ADD [ValidityDays] int NOT NULL
                CONSTRAINT [DF_CouponDefinitions_ValidityDays] DEFAULT (365) WITH VALUES;
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_CouponDefinitions_Acquisition')
        EXEC sys.sp_executesql N'
            ALTER TABLE [store].[CouponDefinitions]
                ADD CONSTRAINT [CK_CouponDefinitions_Acquisition]
                    CHECK ([AcquisitionType] IN (N''POINT_EXCHANGE'', N''ADMIN_GRANT''));';
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_CouponDefinitions_PointCost')
        EXEC sys.sp_executesql N'
            ALTER TABLE [store].[CouponDefinitions]
                ADD CONSTRAINT [CK_CouponDefinitions_PointCost]
                    CHECK (([AcquisitionType] = N''ADMIN_GRANT'' AND [PointCost] IS NULL)
                        OR ([AcquisitionType] = N''POINT_EXCHANGE'' AND [PointCost] > 0));';
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_CouponDefinitions_ValidityDays')
        EXEC sys.sp_executesql N'
            ALTER TABLE [store].[CouponDefinitions]
                ADD CONSTRAINT [CK_CouponDefinitions_ValidityDays] CHECK ([ValidityDays] > 0);';

    /* 先補齊舊券期限，再把欄位固定為必填；歷史券仍保留原狀態與資料列。 */
    IF COL_LENGTH(N'store.UserCoupons', N'ExpiresAt') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [ExpiresAt] datetime2(3) NULL;
    EXEC sys.sp_executesql N'
        UPDATE coupon
           SET [ExpiresAt] = DATEADD(DAY, definition.[ValidityDays], coupon.[IssuedAt])
          FROM [store].[UserCoupons] coupon
          INNER JOIN [store].[CouponDefinitions] definition
            ON definition.[Id] = coupon.[CouponDefinitionId]
         WHERE coupon.[ExpiresAt] IS NULL;';
    IF EXISTS (
        SELECT 1
          FROM sys.columns
         WHERE object_id = OBJECT_ID(N'store.UserCoupons')
           AND name = N'ExpiresAt'
           AND is_nullable = 1)
    BEGIN
        ALTER TABLE [store].[UserCoupons] ALTER COLUMN [ExpiresAt] datetime2(3) NOT NULL;
    END;
    IF NOT EXISTS (
        SELECT 1
          FROM sys.default_constraints
         WHERE parent_object_id = OBJECT_ID(N'store.UserCoupons')
           AND name = N'DF_UserCoupons_ExpiresAt')
        ALTER TABLE [store].[UserCoupons]
            ADD CONSTRAINT [DF_UserCoupons_ExpiresAt]
                DEFAULT (DATEADD(DAY, 365, SYSUTCDATETIME())) FOR [ExpiresAt];
    IF COL_LENGTH(N'store.UserCoupons', N'IssuedByAdminUserId') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [IssuedByAdminUserId] uniqueidentifier NULL;
    IF COL_LENGTH(N'store.UserCoupons', N'IssueReason') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [IssueReason] nvarchar(200) NULL;
    IF COL_LENGTH(N'store.UserCoupons', N'RevokedAt') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [RevokedAt] datetime2(3) NULL;
    IF COL_LENGTH(N'store.UserCoupons', N'RevokedByAdminUserId') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [RevokedByAdminUserId] uniqueidentifier NULL;
    IF COL_LENGTH(N'store.UserCoupons', N'RevokeReason') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [RevokeReason] nvarchar(200) NULL;
    IF COL_LENGTH(N'store.UserCoupons', N'GrantBatchId') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [GrantBatchId] uniqueidentifier NULL;
    IF COL_LENGTH(N'store.UserCoupons', N'RevokeBatchId') IS NULL
        ALTER TABLE [store].[UserCoupons] ADD [RevokeBatchId] uniqueidentifier NULL;

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_UserCoupons_Status')
        ALTER TABLE [store].[UserCoupons] DROP CONSTRAINT [CK_UserCoupons_Status];
    ALTER TABLE [store].[UserCoupons]
        ADD CONSTRAINT [CK_UserCoupons_Status]
            CHECK ([Status] IN (N'AVAILABLE', N'USED', N'EXPIRED', N'REVOKED'));

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'store.UserCoupons') AND name = N'UQ_UserCoupons_UserCoupon')
        DROP INDEX [UQ_UserCoupons_UserCoupon] ON [store].[UserCoupons];
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'store.UserCoupons') AND name = N'IX_UserCoupons_User_Status_ExpiresAt')
        CREATE INDEX [IX_UserCoupons_User_Status_ExpiresAt]
            ON [store].[UserCoupons] ([UserId], [Status], [ExpiresAt]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'store.UserCoupons') AND name = N'IX_UserCoupons_Definition_IssuedAt')
        CREATE INDEX [IX_UserCoupons_Definition_IssuedAt]
            ON [store].[UserCoupons] ([CouponDefinitionId], [IssuedAt] DESC);

    /* 活動報名保存實際取得的加碼與使用的規則，讓重複請求不會再次發放。 */
    IF COL_LENGTH(N'social.EventRegistrations', N'RewardPointAmount') IS NULL
        EXEC sys.sp_executesql N'
            ALTER TABLE [social].[EventRegistrations]
                ADD [RewardPointAmount] int NOT NULL
                    CONSTRAINT [DF_EventRegistrations_RewardPointAmount] DEFAULT (0) WITH VALUES;';
    IF COL_LENGTH(N'social.EventRegistrations', N'RewardCampaignId') IS NULL
        EXEC sys.sp_executesql N'ALTER TABLE [social].[EventRegistrations] ADD [RewardCampaignId] uniqueidentifier NULL;';
    IF COL_LENGTH(N'social.EventRegistrations', N'RewardKeyDefinitionId') IS NULL
        EXEC sys.sp_executesql N'ALTER TABLE [social].[EventRegistrations] ADD [RewardKeyDefinitionId] uniqueidentifier NULL;';
    IF COL_LENGTH(N'social.EventRegistrations', N'RewardKeyAmount') IS NULL
        EXEC sys.sp_executesql N'
            ALTER TABLE [social].[EventRegistrations]
                ADD [RewardKeyAmount] int NOT NULL
                    CONSTRAINT [DF_EventRegistrations_RewardKeyAmount] DEFAULT (0) WITH VALUES;';
    IF COL_LENGTH(N'social.EventRegistrations', N'RewardGrantedAt') IS NULL
        EXEC sys.sp_executesql N'ALTER TABLE [social].[EventRegistrations] ADD [RewardGrantedAt] datetime2(3) NULL;';
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_EventRegistrations_RewardAmounts')
        EXEC sys.sp_executesql N'
            ALTER TABLE [social].[EventRegistrations]
                ADD CONSTRAINT [CK_EventRegistrations_RewardAmounts]
                    CHECK ([RewardPointAmount] >= 0 AND [RewardKeyAmount] >= 0
                        AND (([RewardKeyAmount] = 0 AND [RewardKeyDefinitionId] IS NULL)
                          OR ([RewardKeyAmount] > 0 AND [RewardKeyDefinitionId] IS NOT NULL)));';

    /* 批次主檔記錄活動原因與篩選快照，明細仍寫入原有點數流水或 UserCoupon。 */
    IF OBJECT_ID(N'admin.EconomyAdjustmentBatches', N'U') IS NULL
    BEGIN
        CREATE TABLE [admin].[EconomyAdjustmentBatches]
        (
            [Id] uniqueidentifier NOT NULL,
            [AssetType] nvarchar(20) NOT NULL,
            [Operation] nvarchar(20) NOT NULL,
            [UnitAmount] int NOT NULL,
            [CouponDefinitionId] uniqueidentifier NULL,
            [FilterJson] nvarchar(max) NOT NULL,
            [Reason] nvarchar(200) NOT NULL,
            [CreatedByAdminUserId] uniqueidentifier NOT NULL,
            [Status] nvarchar(20) NOT NULL,
            [TargetCount] int NOT NULL,
            [SucceededCount] int NOT NULL,
            [FailedCount] int NOT NULL,
            [AffectedAssetCount] bigint NOT NULL,
            [FailureReason] nvarchar(500) NULL,
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_EconomyAdjustmentBatches_Created] DEFAULT (SYSUTCDATETIME()),
            [CompletedAt] datetime2(3) NULL,
            CONSTRAINT [PK_EconomyAdjustmentBatches] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_EconomyAdjustmentBatches_AssetType] CHECK ([AssetType] IN (N'POINT', N'COUPON')),
            CONSTRAINT [CK_EconomyAdjustmentBatches_Operation] CHECK ([Operation] IN (N'ADD', N'DEDUCT')),
            CONSTRAINT [CK_EconomyAdjustmentBatches_Status] CHECK ([Status] IN (N'PROCESSING', N'COMPLETED', N'FAILED', N'EMPTY')),
            CONSTRAINT [CK_EconomyAdjustmentBatches_Amounts] CHECK ([UnitAmount] > 0 AND [TargetCount] >= 0 AND [SucceededCount] >= 0 AND [FailedCount] >= 0 AND [AffectedAssetCount] >= 0)
        );
    END;

    /*
        CommunityRewardCampaigns 是跨社群、遊戲與經濟領域共用的加碼設定。
        MEMBER 只能使用 LIMITED 並受發起人背包與預算限制；OFFICIAL 使用
        UNLIMITED，只受 ValidFrom／ValidUntil 控制，不扣管理員個人資產。
    */
    IF OBJECT_ID(N'admin.CommunityRewardCampaigns', N'U') IS NULL
    BEGIN
        CREATE TABLE [admin].[CommunityRewardCampaigns]
        (
            [Id] uniqueidentifier NOT NULL,
            [TargetType] nvarchar(20) NOT NULL,
            [EventId] uniqueidentifier NULL,
            [GameRoomId] uniqueidentifier NULL,
            [OwnerUserId] uniqueidentifier NOT NULL,
            [SponsorType] nvarchar(20) NOT NULL,
            [BudgetMode] nvarchar(20) NOT NULL,
            [PointPerRecipient] int NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_PointPerRecipient] DEFAULT (0),
            [KeyDefinitionId] uniqueidentifier NULL,
            [KeyPerRecipient] int NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_KeyPerRecipient] DEFAULT (0),
            [PointBudget] int NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_PointBudget] DEFAULT (0),
            [PointIssued] int NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_PointIssued] DEFAULT (0),
            [KeyBudget] int NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_KeyBudget] DEFAULT (0),
            [KeyIssued] int NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_KeyIssued] DEFAULT (0),
            [ValidFrom] datetime2(3) NOT NULL,
            [ValidUntil] datetime2(3) NOT NULL,
            [IsActive] bit NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_Active] DEFAULT (1),
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_Created] DEFAULT (SYSUTCDATETIME()),
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_CommunityRewardCampaigns_Updated] DEFAULT (SYSUTCDATETIME()),
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_CommunityRewardCampaigns] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_CommunityRewardCampaigns_Target] CHECK (([TargetType] = N'EVENT' AND [EventId] IS NOT NULL AND [GameRoomId] IS NULL) OR ([TargetType] = N'GAME_ROOM' AND [EventId] IS NULL AND [GameRoomId] IS NOT NULL)),
            CONSTRAINT [CK_CommunityRewardCampaigns_Sponsor] CHECK (([SponsorType] = N'MEMBER' AND [BudgetMode] = N'LIMITED') OR ([SponsorType] = N'OFFICIAL' AND [BudgetMode] = N'UNLIMITED')),
            CONSTRAINT [CK_CommunityRewardCampaigns_Amounts] CHECK ([PointPerRecipient] >= 0 AND [KeyPerRecipient] >= 0 AND [PointBudget] >= 0 AND [PointIssued] >= 0 AND [KeyBudget] >= 0 AND [KeyIssued] >= 0 AND ([BudgetMode] = N'UNLIMITED' OR ([PointIssued] <= [PointBudget] AND [KeyIssued] <= [KeyBudget])) AND (([KeyPerRecipient] = 0 AND [KeyDefinitionId] IS NULL) OR ([KeyPerRecipient] > 0 AND [KeyDefinitionId] IS NOT NULL))),
            CONSTRAINT [CK_CommunityRewardCampaigns_Time] CHECK ([ValidUntil] > [ValidFrom] AND [UpdatedAt] >= [CreatedAt]),
            CONSTRAINT [FK_CommunityRewardCampaigns_Event] FOREIGN KEY ([EventId]) REFERENCES [social].[Events] ([Id]),
            CONSTRAINT [FK_CommunityRewardCampaigns_GameRoom] FOREIGN KEY ([GameRoomId]) REFERENCES [game].[GameRooms] ([Id]),
            CONSTRAINT [FK_CommunityRewardCampaigns_OwnerUser] FOREIGN KEY ([OwnerUserId]) REFERENCES [user].[AspNetUsers] ([Id]),
            CONSTRAINT [FK_CommunityRewardCampaigns_KeyDefinition] FOREIGN KEY ([KeyDefinitionId]) REFERENCES [catalog].[KeyDefinitions] ([Id])
        );
        CREATE UNIQUE INDEX [UX_CommunityRewardCampaigns_Event]
            ON [admin].[CommunityRewardCampaigns] ([EventId]) WHERE [EventId] IS NOT NULL;
        CREATE UNIQUE INDEX [UX_CommunityRewardCampaigns_GameRoom]
            ON [admin].[CommunityRewardCampaigns] ([GameRoomId]) WHERE [GameRoomId] IS NOT NULL;
        CREATE INDEX [IX_CommunityRewardCampaigns_ActiveWindow]
            ON [admin].[CommunityRewardCampaigns] ([IsActive], [ValidFrom], [ValidUntil]);
    END;

    /* 邀請保留完整生命週期與實際加碼結果；接受邀請時才會呼叫共用結算服務。 */
    IF OBJECT_ID(N'game.GameRoomInvitations', N'U') IS NULL
    BEGIN
        CREATE TABLE [game].[GameRoomInvitations]
        (
            [Id] uniqueidentifier NOT NULL,
            [RoomId] uniqueidentifier NOT NULL,
            [InviterUserId] uniqueidentifier NOT NULL,
            [InviteeUserId] uniqueidentifier NOT NULL,
            [Status] nvarchar(20) NOT NULL CONSTRAINT [DF_GameRoomInvitations_Status] DEFAULT (N'PENDING'),
            [Message] nvarchar(300) NULL,
            [RewardPointAmount] int NOT NULL CONSTRAINT [DF_GameRoomInvitations_RewardPointAmount] DEFAULT (0),
            [RewardCampaignId] uniqueidentifier NULL,
            [RewardKeyDefinitionId] uniqueidentifier NULL,
            [RewardKeyAmount] int NOT NULL CONSTRAINT [DF_GameRoomInvitations_RewardKeyAmount] DEFAULT (0),
            [RewardGrantedAt] datetime2(3) NULL,
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_GameRoomInvitations_Created] DEFAULT (SYSUTCDATETIME()),
            [RespondedAt] datetime2(3) NULL,
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_GameRoomInvitations] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_GameRoomInvitations_Status] CHECK ([Status] IN (N'PENDING', N'ACCEPTED', N'DECLINED', N'EXPIRED', N'CANCELLED')),
            CONSTRAINT [CK_GameRoomInvitations_NotSelf] CHECK ([InviterUserId] <> [InviteeUserId]),
            CONSTRAINT [CK_GameRoomInvitations_RewardAmounts] CHECK ([RewardPointAmount] >= 0 AND [RewardKeyAmount] >= 0 AND (([RewardKeyAmount] = 0 AND [RewardKeyDefinitionId] IS NULL) OR ([RewardKeyAmount] > 0 AND [RewardKeyDefinitionId] IS NOT NULL))),
            CONSTRAINT [FK_GameRoomInvitations_Room] FOREIGN KEY ([RoomId]) REFERENCES [game].[GameRooms] ([Id]),
            CONSTRAINT [FK_GameRoomInvitations_InviterUser] FOREIGN KEY ([InviterUserId]) REFERENCES [user].[AspNetUsers] ([Id]),
            CONSTRAINT [FK_GameRoomInvitations_InviteeUser] FOREIGN KEY ([InviteeUserId]) REFERENCES [user].[AspNetUsers] ([Id]),
            CONSTRAINT [FK_GameRoomInvitations_RewardCampaign] FOREIGN KEY ([RewardCampaignId]) REFERENCES [admin].[CommunityRewardCampaigns] ([Id]),
            CONSTRAINT [FK_GameRoomInvitations_RewardKeyDefinition] FOREIGN KEY ([RewardKeyDefinitionId]) REFERENCES [catalog].[KeyDefinitions] ([Id])
        );
        CREATE INDEX [IX_GameRoomInvitations_Invitee_Status_CreatedAt]
            ON [game].[GameRoomInvitations] ([InviteeUserId], [Status], [CreatedAt] DESC);
        CREATE INDEX [IX_GameRoomInvitations_Room_CreatedAt]
            ON [game].[GameRoomInvitations] ([RoomId], [CreatedAt] DESC);
        CREATE UNIQUE INDEX [UX_GameRoomInvitations_Pending]
            ON [game].[GameRoomInvitations] ([RoomId], [InviteeUserId]) WHERE [Status] = N'PENDING';
    END;

    IF OBJECT_ID(N'game.GameEconomySettings', N'U') IS NULL
    BEGIN
        CREATE TABLE [game].[GameEconomySettings]
        (
            [Id] tinyint NOT NULL,
            [MinimumPointReward] int NOT NULL,
            [MaximumPointReward] int NOT NULL,
            [BasePointReward] int NOT NULL,
            [MaximumVoteBonus] int NOT NULL,
            [MaximumWinBonus] int NOT NULL,
            [CompletedNormalKey] int NOT NULL,
            [ExcellentExtraNormalKey] int NOT NULL,
            [ExcellentThreshold] int NOT NULL,
            [DailyMiniGameRewardLimit] int NOT NULL,
            [KeyProgressToNormalKey] int NOT NULL,
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_GameEconomySettings_Updated] DEFAULT (SYSUTCDATETIME()),
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_GameEconomySettings] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_GameEconomySettings_Values] CHECK ([MinimumPointReward] >= 0 AND [MaximumPointReward] >= [MinimumPointReward] AND [BasePointReward] >= 0 AND [MaximumVoteBonus] >= 0 AND [MaximumWinBonus] >= 0 AND [CompletedNormalKey] >= 0 AND [ExcellentExtraNormalKey] >= 0 AND [ExcellentThreshold] BETWEEN 0 AND 100 AND [DailyMiniGameRewardLimit] >= 0 AND [KeyProgressToNormalKey] > 0)
        );
    END;

    IF OBJECT_ID(N'game.GameModeDefinitions', N'U') IS NULL
    BEGIN
        CREATE TABLE [game].[GameModeDefinitions]
        (
            [Id] uniqueidentifier NOT NULL,
            [Code] nvarchar(40) NOT NULL,
            [Name] nvarchar(100) NOT NULL,
            [Description] nvarchar(500) NOT NULL,
            [ConfigJson] nvarchar(max) NULL,
            [IsActive] bit NOT NULL CONSTRAINT [DF_GameModeDefinitions_Active] DEFAULT (1),
            [GradeBThreshold] int NOT NULL,
            [GradeAThreshold] int NOT NULL,
            [GradeSThreshold] int NOT NULL,
            [FailPointReward] int NOT NULL,
            [FailKeyProgressReward] int NOT NULL,
            [BPointReward] int NOT NULL,
            [BKeyProgressReward] int NOT NULL,
            [APointReward] int NOT NULL,
            [AKeyProgressReward] int NOT NULL,
            [SPointReward] int NOT NULL,
            [SKeyProgressReward] int NOT NULL,
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_GameModeDefinitions_Created] DEFAULT (SYSUTCDATETIME()),
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_GameModeDefinitions_Updated] DEFAULT (SYSUTCDATETIME()),
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_GameModeDefinitions] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_GameModeDefinitions_Thresholds] CHECK ([GradeBThreshold] BETWEEN 0 AND 100 AND [GradeAThreshold] BETWEEN [GradeBThreshold] AND 100 AND [GradeSThreshold] BETWEEN [GradeAThreshold] AND 100),
            CONSTRAINT [CK_GameModeDefinitions_Rewards] CHECK ([FailPointReward] >= 0 AND [FailKeyProgressReward] >= 0 AND [BPointReward] >= 0 AND [BKeyProgressReward] >= 0 AND [APointReward] >= 0 AND [AKeyProgressReward] >= 0 AND [SPointReward] >= 0 AND [SKeyProgressReward] >= 0)
        );
        CREATE UNIQUE INDEX [UX_GameModeDefinitions_Code] ON [game].[GameModeDefinitions] ([Code]);
        CREATE INDEX [IX_GameModeDefinitions_Active_Code] ON [game].[GameModeDefinitions] ([IsActive], [Code]);
    END;

    IF OBJECT_ID(N'game.MiniGameAttempts', N'U') IS NULL
    BEGIN
        CREATE TABLE [game].[MiniGameAttempts]
        (
            [Id] uniqueidentifier NOT NULL,
            [UserId] uniqueidentifier NOT NULL,
            [GameModeDefinitionId] uniqueidentifier NOT NULL,
            [ArtifactId] uniqueidentifier NULL,
            [ArtifactPoolJson] nvarchar(max) NULL,
            [Difficulty] nvarchar(30) NOT NULL,
            [Seed] nvarchar(128) NOT NULL,
            [ConfigJson] nvarchar(max) NULL,
            [Status] nvarchar(20) NOT NULL CONSTRAINT [DF_MiniGameAttempts_Status] DEFAULT (N'STARTED'),
            [RawScore] int NULL,
            [RawResultJson] nvarchar(max) NULL,
            [NormalizedScore] int NULL,
            [Grade] nvarchar(2) NULL,
            [PointReward] int NOT NULL,
            [KeyProgressReward] int NOT NULL,
            [RewardAttemptNo] int NULL,
            [RewardGranted] bit NOT NULL,
            [StartedAt] datetime2(3) NOT NULL CONSTRAINT [DF_MiniGameAttempts_Started] DEFAULT (SYSUTCDATETIME()),
            [CompletedAt] datetime2(3) NULL,
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_MiniGameAttempts] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_MiniGameAttempts_Status] CHECK ([Status] IN (N'STARTED', N'COMPLETED', N'EXPIRED')),
            CONSTRAINT [CK_MiniGameAttempts_Score] CHECK (([RawScore] IS NULL OR [RawScore] BETWEEN 0 AND 100) AND ([NormalizedScore] IS NULL OR [NormalizedScore] BETWEEN 0 AND 100)),
            CONSTRAINT [CK_MiniGameAttempts_Reward] CHECK ([PointReward] >= 0 AND [KeyProgressReward] >= 0),
            CONSTRAINT [FK_MiniGameAttempts_Mode] FOREIGN KEY ([GameModeDefinitionId]) REFERENCES [game].[GameModeDefinitions] ([Id]),
            CONSTRAINT [FK_MiniGameAttempts_Artifact] FOREIGN KEY ([ArtifactId]) REFERENCES [catalog].[Artifacts] ([Id]),
            CONSTRAINT [FK_MiniGameAttempts_User] FOREIGN KEY ([UserId]) REFERENCES [user].[AspNetUsers] ([Id])
        );
        CREATE INDEX [IX_MiniGameAttempts_User_StartedAt] ON [game].[MiniGameAttempts] ([UserId], [StartedAt] DESC);
        CREATE INDEX [IX_MiniGameAttempts_User_Mode_Status] ON [game].[MiniGameAttempts] ([UserId], [GameModeDefinitionId], [Status]);
    END;

    IF OBJECT_ID(N'catalog.KeyExchangeRules', N'U') IS NULL
    BEGIN
        CREATE TABLE [catalog].[KeyExchangeRules]
        (
            [Id] uniqueidentifier NOT NULL,
            [SourceKeyDefinitionId] uniqueidentifier NOT NULL,
            [SourceAmount] int NOT NULL,
            [TargetKeyDefinitionId] uniqueidentifier NOT NULL,
            [TargetAmount] int NOT NULL,
            [SortOrder] int NOT NULL,
            [IsActive] bit NOT NULL CONSTRAINT [DF_KeyExchangeRules_Active] DEFAULT (1),
            [Description] nvarchar(300) NULL,
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_KeyExchangeRules_Created] DEFAULT (SYSUTCDATETIME()),
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_KeyExchangeRules_Updated] DEFAULT (SYSUTCDATETIME()),
            [RowVersion] rowversion NOT NULL,
            CONSTRAINT [PK_KeyExchangeRules] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_KeyExchangeRules_Amounts] CHECK ([SourceAmount] > 0 AND [TargetAmount] > 0),
            CONSTRAINT [FK_KeyExchangeRules_SourceKey] FOREIGN KEY ([SourceKeyDefinitionId]) REFERENCES [catalog].[KeyDefinitions] ([Id]),
            CONSTRAINT [FK_KeyExchangeRules_TargetKey] FOREIGN KEY ([TargetKeyDefinitionId]) REFERENCES [catalog].[KeyDefinitions] ([Id])
        );
        CREATE UNIQUE INDEX [UX_KeyExchangeRules_Source_Target] ON [catalog].[KeyExchangeRules] ([SourceKeyDefinitionId], [TargetKeyDefinitionId]);
        CREATE INDEX [IX_KeyExchangeRules_Active_SortOrder] ON [catalog].[KeyExchangeRules] ([IsActive], [SortOrder]);
    END;

    IF OBJECT_ID(N'catalog.KeyProgressBalances', N'U') IS NULL
    BEGIN
        CREATE TABLE [catalog].[KeyProgressBalances]
        (
            [UserId] uniqueidentifier NOT NULL,
            [Balance] int NOT NULL,
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_KeyProgressBalances_Updated] DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT [PK_KeyProgressBalances] PRIMARY KEY ([UserId]),
            CONSTRAINT [CK_KeyProgressBalances_NonNegative] CHECK ([Balance] >= 0),
            CONSTRAINT [FK_KeyProgressBalances_User] FOREIGN KEY ([UserId]) REFERENCES [user].[AspNetUsers] ([Id])
        );
    END;

    IF OBJECT_ID(N'catalog.KeyProgressTransactions', N'U') IS NULL
    BEGIN
        CREATE TABLE [catalog].[KeyProgressTransactions]
        (
            [Id] uniqueidentifier NOT NULL,
            [UserId] uniqueidentifier NOT NULL,
            [Amount] int NOT NULL,
            [Reason] nvarchar(40) NOT NULL,
            [ReferenceType] nvarchar(40) NULL,
            [ReferenceId] uniqueidentifier NULL,
            [CreatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_KeyProgressTransactions_Created] DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT [PK_KeyProgressTransactions] PRIMARY KEY ([Id]),
            CONSTRAINT [CK_KeyProgressTransactions_Amount] CHECK ([Amount] <> 0),
            CONSTRAINT [FK_KeyProgressTransactions_User] FOREIGN KEY ([UserId]) REFERENCES [user].[AspNetUsers] ([Id])
        );
        CREATE INDEX [IX_KeyProgressTransactions_User] ON [catalog].[KeyProgressTransactions] ([UserId], [CreatedAt] DESC);
    END;

    IF OBJECT_ID(N'user.EquippedTitles', N'U') IS NULL
    BEGIN
        CREATE TABLE [user].[EquippedTitles]
        (
            [UserId] uniqueidentifier NOT NULL,
            [UserAchievementId] uniqueidentifier NOT NULL,
            [EquippedAt] datetime2(3) NOT NULL CONSTRAINT [DF_EquippedTitles_Equipped] DEFAULT (SYSUTCDATETIME()),
            [UpdatedAt] datetime2(3) NOT NULL CONSTRAINT [DF_EquippedTitles_Updated] DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT [PK_EquippedTitles] PRIMARY KEY ([UserId]),
            CONSTRAINT [FK_EquippedTitles_User] FOREIGN KEY ([UserId]) REFERENCES [user].[AspNetUsers] ([Id]),
            CONSTRAINT [FK_EquippedTitles_UserAchievement] FOREIGN KEY ([UserAchievementId]) REFERENCES [user].[UserAchievements] ([Id])
        );
        CREATE UNIQUE INDEX [UX_EquippedTitles_UserAchievement] ON [user].[EquippedTitles] ([UserAchievementId]);
    END;

    /* 補上新欄位與批次主檔的外鍵；均禁止連鎖刪除，以保存稽核歷史。 */
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EconomyAdjustmentBatches_CouponDefinition')
        ALTER TABLE [admin].[EconomyAdjustmentBatches] ADD CONSTRAINT [FK_EconomyAdjustmentBatches_CouponDefinition]
            FOREIGN KEY ([CouponDefinitionId]) REFERENCES [store].[CouponDefinitions] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EconomyAdjustmentBatches_AdminUser')
        ALTER TABLE [admin].[EconomyAdjustmentBatches] ADD CONSTRAINT [FK_EconomyAdjustmentBatches_AdminUser]
            FOREIGN KEY ([CreatedByAdminUserId]) REFERENCES [user].[AspNetUsers] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_UserCoupons_IssuedByAdminUser')
        ALTER TABLE [store].[UserCoupons] ADD CONSTRAINT [FK_UserCoupons_IssuedByAdminUser]
            FOREIGN KEY ([IssuedByAdminUserId]) REFERENCES [user].[AspNetUsers] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_UserCoupons_RevokedByAdminUser')
        ALTER TABLE [store].[UserCoupons] ADD CONSTRAINT [FK_UserCoupons_RevokedByAdminUser]
            FOREIGN KEY ([RevokedByAdminUserId]) REFERENCES [user].[AspNetUsers] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_UserCoupons_GrantBatch')
        ALTER TABLE [store].[UserCoupons] ADD CONSTRAINT [FK_UserCoupons_GrantBatch]
            FOREIGN KEY ([GrantBatchId]) REFERENCES [admin].[EconomyAdjustmentBatches] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_UserCoupons_RevokeBatch')
        ALTER TABLE [store].[UserCoupons] ADD CONSTRAINT [FK_UserCoupons_RevokeBatch]
            FOREIGN KEY ([RevokeBatchId]) REFERENCES [admin].[EconomyAdjustmentBatches] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventRegistrations_RewardCampaign')
        ALTER TABLE [social].[EventRegistrations] ADD CONSTRAINT [FK_EventRegistrations_RewardCampaign]
            FOREIGN KEY ([RewardCampaignId]) REFERENCES [admin].[CommunityRewardCampaigns] ([Id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventRegistrations_RewardKeyDefinition')
        ALTER TABLE [social].[EventRegistrations] ADD CONSTRAINT [FK_EventRegistrations_RewardKeyDefinition]
            FOREIGN KEY ([RewardKeyDefinitionId]) REFERENCES [catalog].[KeyDefinitions] ([Id]);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'admin.EconomyAdjustmentBatches') AND name = N'IX_EconomyAdjustmentBatches_Created_Asset_Operation')
        CREATE INDEX [IX_EconomyAdjustmentBatches_Created_Asset_Operation]
            ON [admin].[EconomyAdjustmentBatches] ([CreatedAt] DESC, [AssetType], [Operation]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'admin.EconomyAdjustmentBatches') AND name = N'IX_EconomyAdjustmentBatches_Status')
        CREATE INDEX [IX_EconomyAdjustmentBatches_Status]
            ON [admin].[EconomyAdjustmentBatches] ([Status]);

    /* 暫定種子只在資料不存在時建立；後台後續調整不會被腳本覆蓋。 */
    IF NOT EXISTS (SELECT 1 FROM [game].[GameEconomySettings] WHERE [Id] = 1)
        INSERT INTO [game].[GameEconomySettings]
            ([Id], [MinimumPointReward], [MaximumPointReward], [BasePointReward], [MaximumVoteBonus], [MaximumWinBonus], [CompletedNormalKey], [ExcellentExtraNormalKey], [ExcellentThreshold], [DailyMiniGameRewardLimit], [KeyProgressToNormalKey])
        VALUES (1, 8, 20, 8, 8, 4, 1, 1, 80, 5, 100);

    UPDATE [catalog].[KeyDefinitions]
       SET [IsActive] = 1
     WHERE [Code] IN (N'NORMAL', N'KEY-NORMAL') AND [ScopeType] = N'NORMAL';
    EXEC sys.sp_executesql N'
        UPDATE [catalog].[KeyDefinitions]
           SET [RecyclePointValue] = CASE [ScopeType]
                WHEN N''NORMAL'' THEN 2
                WHEN N''CATEGORY'' THEN 3
                WHEN N''ERA'' THEN 5
                WHEN N''UNIVERSAL'' THEN 6
                ELSE [RecyclePointValue]
               END
         WHERE [RecyclePointValue] = 0;';

    DECLARE @normalKeyId uniqueidentifier =
        (SELECT TOP (1) [Id] FROM [catalog].[KeyDefinitions] WHERE [IsActive] = 1 AND [ScopeType] = N'NORMAL' ORDER BY CASE WHEN [Code] = N'NORMAL' THEN 0 ELSE 1 END, [Code]);
    IF @normalKeyId IS NOT NULL
    BEGIN
        INSERT INTO [catalog].[KeyExchangeRules]
            ([Id], [SourceKeyDefinitionId], [SourceAmount], [TargetKeyDefinitionId], [TargetAmount], [SortOrder], [IsActive], [Description])
        SELECT NEWID(), @normalKeyId,
               CASE target.[ScopeType] WHEN N'CATEGORY' THEN 2 WHEN N'ERA' THEN 3 ELSE 4 END,
               target.[Id], 1,
               CASE target.[ScopeType] WHEN N'CATEGORY' THEN 10 WHEN N'ERA' THEN 20 ELSE 30 END,
               1,
               CASE target.[ScopeType] WHEN N'CATEGORY' THEN N'兩把 NORMAL 兌換一把分類鑰匙'
                    WHEN N'ERA' THEN N'三把 NORMAL 兌換一把年代鑰匙'
                    ELSE N'四把 NORMAL 兌換一把萬能鑰匙' END
          FROM [catalog].[KeyDefinitions] target
         WHERE target.[IsActive] = 1
           AND target.[ScopeType] IN (N'CATEGORY', N'ERA', N'UNIVERSAL')
           AND NOT EXISTS (
               SELECT 1 FROM [catalog].[KeyExchangeRules] existingRule
                WHERE existingRule.[SourceKeyDefinitionId] = @normalKeyId
                  AND existingRule.[TargetKeyDefinitionId] = target.[Id]);
    END;

    EXEC sys.sp_executesql N'
        IF NOT EXISTS (SELECT 1 FROM [store].[CouponDefinitions] WHERE [Code] = N''POINT_EXCHANGE_100_50'')
            INSERT INTO [store].[CouponDefinitions] ([Id], [Code], [Name], [DiscountType], [AcquisitionType], [PointCost], [ValidityDays], [DiscountValue], [MinimumAmount], [StartAt], [EndAt], [IsActive])
            VALUES (NEWID(), N''POINT_EXCHANGE_100_50'', N''鑑定點數兌換 50 元券'', N''FIXED'', N''POINT_EXCHANGE'', 100, 365, 50, 500, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), 1, 1), DATEFROMPARTS(2099, 12, 31), 1);
        IF NOT EXISTS (SELECT 1 FROM [store].[CouponDefinitions] WHERE [Code] = N''POINT_EXCHANGE_250_150'')
            INSERT INTO [store].[CouponDefinitions] ([Id], [Code], [Name], [DiscountType], [AcquisitionType], [PointCost], [ValidityDays], [DiscountValue], [MinimumAmount], [StartAt], [EndAt], [IsActive])
            VALUES (NEWID(), N''POINT_EXCHANGE_250_150'', N''鑑定點數兌換 150 元券'', N''FIXED'', N''POINT_EXCHANGE'', 250, 365, 150, 1000, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), 1, 1), DATEFROMPARTS(2099, 12, 31), 1);
        IF NOT EXISTS (SELECT 1 FROM [store].[CouponDefinitions] WHERE [Code] = N''POINT_EXCHANGE_500_350'')
            INSERT INTO [store].[CouponDefinitions] ([Id], [Code], [Name], [DiscountType], [AcquisitionType], [PointCost], [ValidityDays], [DiscountValue], [MinimumAmount], [StartAt], [EndAt], [IsActive])
            VALUES (NEWID(), N''POINT_EXCHANGE_500_350'', N''鑑定點數兌換 350 元券'', N''FIXED'', N''POINT_EXCHANGE'', 500, 365, 350, 2000, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), 1, 1), DATEFROMPARTS(2099, 12, 31), 1);
        IF NOT EXISTS (SELECT 1 FROM [store].[CouponDefinitions] WHERE [Code] = N''POINT_EXCHANGE_50_20'')
            INSERT INTO [store].[CouponDefinitions] ([Id], [Code], [Name], [DiscountType], [AcquisitionType], [PointCost], [ValidityDays], [DiscountValue], [MinimumAmount], [StartAt], [EndAt], [IsActive])
            VALUES (NEWID(), N''POINT_EXCHANGE_50_20'', N''鑑定點數兌換 20 元券'', N''FIXED'', N''POINT_EXCHANGE'', 50, 365, 20, 200, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), 1, 1), DATEFROMPARTS(2099, 12, 31), 1);
        IF NOT EXISTS (SELECT 1 FROM [store].[CouponDefinitions] WHERE [Code] = N''POINT_EXCHANGE_750_600'')
            INSERT INTO [store].[CouponDefinitions] ([Id], [Code], [Name], [DiscountType], [AcquisitionType], [PointCost], [ValidityDays], [DiscountValue], [MinimumAmount], [StartAt], [EndAt], [IsActive])
            VALUES (NEWID(), N''POINT_EXCHANGE_750_600'', N''鑑定點數兌換 600 元券'', N''FIXED'', N''POINT_EXCHANGE'', 750, 365, 600, 3000, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), 1, 1), DATEFROMPARTS(2099, 12, 31), 1);';

    DECLARE @modeDetailLocator uniqueidentifier = 'd15e1d36-9b43-4de8-9d7b-2d4f2b5f6f01';
    DECLARE @modeArtifactPuzzle uniqueidentifier = 'd15e1d36-9b43-4de8-9d7b-2d4f2b5f6f02';
    DECLARE @modeMemoryMatch uniqueidentifier = 'd15e1d36-9b43-4de8-9d7b-2d4f2b5f6f03';
    DECLARE @modeStripRestore uniqueidentifier = 'd15e1d36-9b43-4de8-9d7b-2d4f2b5f6f04';
    INSERT INTO [game].[GameModeDefinitions]
        ([Id], [Code], [Name], [Description], [ConfigJson], [GradeBThreshold], [GradeAThreshold], [GradeSThreshold], [FailPointReward], [FailKeyProgressReward], [BPointReward], [BKeyProgressReward], [APointReward], [AKeyProgressReward], [SPointReward], [SKeyProgressReward], [IsActive])
    SELECT [Id], [Code], [Name], [Description], [ConfigJson], 60, 80, 95, 0, 0, 1, 3, 2, 6, 3, 10, 1
      FROM (VALUES
        (@modeDetailLocator, N'DETAIL_LOCATOR', N'細節追跡', N'從文物影像局部線索回到完整圖像中找出對應位置。', N'{"selection":"region","source":"artifact-image"}'),
        (@modeArtifactPuzzle, N'ARTIFACT_PUZZLE', N'館藏拼圖', N'將文物影像切片後重新排列，完成完整影像。', N'{"pieces":"configurable-grid","source":"artifact-image"}'),
        (@modeMemoryMatch, N'MEMORY_MATCH', N'館藏翻牌', N'從多件文物影像中翻牌並配對相同館藏。', N'{"pairs":"configurable","source":"artifact-image"}'),
        (@modeStripRestore, N'STRIP_RESTORE', N'長卷復位', N'將長幅文物影像切成條帶後重新排序。', N'{"orientation":"configurable","source":"artifact-image"}')
      ) AS seed([Id], [Code], [Name], [Description], [ConfigJson])
     WHERE NOT EXISTS (SELECT 1 FROM [game].[GameModeDefinitions] existing WHERE existing.[Code] = seed.[Code]);

    /* 成就定義跟著目前的圖鑑、多人遊戲與 Mini Game 流程；舊展示代碼停用但不刪除歷史。 */
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
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_START', N'圖鑑起步', N'初見藏品', N'解鎖第一件啟用中的圖鑑文物。', N'ARTIFACT_UNLOCK_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_EXPLORER', N'館藏尋跡', N'循線而讀', N'累積解鎖十件不同的啟用文物。', N'ARTIFACT_UNLOCK_COUNT', 10, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_DEEP_READER', N'細讀成章', N'明辨細節', N'累積解鎖二十五件不同的啟用文物。', N'ARTIFACT_UNLOCK_COUNT', 25, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_CATEGORY_COMPLETE', N'一門專精', N'分類觀察者', N'完成一個目前仍有啟用文物的分類。', N'CATEGORY_COMPLETE_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_ERA_COMPLETE', N'縱覽古今', N'年代尋蹤者', N'完成一個目前仍有啟用文物的年代範圍。', N'ERA_COMPLETE_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_CATALOG_COMPLETE', N'全藏鑑定人', N'藏中有數', N'圖鑑完成率達到百分之百；完成率依目前啟用文物即時計算。', N'CATALOG_COMPLETION_PERCENT', 100, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_GAME_PARTICIPANT', N'多人遊戲入門', N'同場觀察者', N'完成三場多人主遊戲。', N'GAME_COMPLETE_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_GAME_PERFORMER', N'回合觀察者', N'讀票知勢', N'在多人主遊戲中累積十個勝出回合。', N'GAME_ROUND_WIN_COUNT', 10, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_GAME_REGULAR', N'持續參與', N'穩定入場', N'完成十場多人主遊戲。', N'GAME_COMPLETE_COUNT', 10, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_DAILY_LOGIN_START', N'每日到訪', N'持續到訪者', N'累積一天成功登入紀錄。', N'DAILY_LOGIN_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_DAILY_LOGIN_STREAK', N'連續七日', N'日積月累', N'連續七天成功登入；連續天數由共用每日活動紀錄計算。', N'DAILY_LOGIN_STREAK', 7, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_MINIGAME_DETAIL', N'細節追蹤', N'細節尋跡者', N'完成三次 DETAIL_LOCATOR 細節追蹤。', N'MINIGAME_DETAIL_LOCATOR_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_MINIGAME_PUZZLE', N'拼圖復原', N'復原巧手', N'完成三次 ARTIFACT_PUZZLE 館藏拼圖。', N'MINIGAME_ARTIFACT_PUZZLE_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_MINIGAME_MEMORY', N'館藏翻牌', N'過目不忘', N'完成三次 MEMORY_MATCH 館藏翻牌。', N'MINIGAME_MEMORY_MATCH_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_MINIGAME_STRIP', N'長卷復位', N'理線成形', N'完成三次 STRIP_RESTORE 長卷復位。', N'MINIGAME_STRIP_RESTORE_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_MINIGAME_S_GRADE', N'高分辨識', N'目光如炬', N'在 Mini Game 中取得五次 S 等級。', N'MINIGAME_GRADE_S_COUNT', 5, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_SOCIAL_FIRST_POST', N'留下第一筆觀察', N'把發現寫下來', N'發布第一篇與文物觀察有關的貼文。', N'POST_COUNT', 1, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_SOCIAL_ACTIVE_READER', N'認真讀者', N'每則留言都有線索', N'在社群中留下五則有內容的留言。', N'COMMENT_COUNT', 5, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_EVENT_VISITOR', N'活動常客', N'在交流現場見面', N'完成三次活動報名並參與交流。', N'EVENT_JOIN_COUNT', 3, N'ACTIVE'),
        (N'SHOWCASE_ACHIEVEMENT_EVENT_HOST', N'交流發起人', N'讓討論有一個開始', N'建立一場玩家活動並完成審核。', N'EVENT_HOST_COUNT', 1, N'ACTIVE');

    UPDATE achievement
       SET [Status] = N'INACTIVE', [UpdatedAt] = SYSUTCDATETIME()
      FROM [user].[Achievements] AS achievement
     WHERE achievement.[Code] LIKE N'SHOWCASE_ACHIEVEMENT_%'
       AND NOT EXISTS (SELECT 1 FROM @AchievementSeeds seed WHERE seed.[Code] = achievement.[Code]);

    UPDATE achievement
       SET [Name] = seed.[Name],
           [Title] = seed.[Title],
           [Description] = seed.[Description],
           [ConditionType] = seed.[ConditionType],
           [ThresholdValue] = seed.[ThresholdValue],
           [Status] = seed.[Status],
           [UpdatedAt] = SYSUTCDATETIME()
      FROM [user].[Achievements] AS achievement
      INNER JOIN @AchievementSeeds AS seed ON seed.[Code] = achievement.[Code];

    INSERT INTO [user].[Achievements]
        ([Id], [Code], [Name], [Title], [Description], [IconPath], [ConditionType], [ThresholdValue], [Status], [CreatedAt], [UpdatedAt])
    SELECT NEWID(), seed.[Code], seed.[Name], seed.[Title], seed.[Description], NULL, seed.[ConditionType], seed.[ThresholdValue], seed.[Status], SYSUTCDATETIME(), SYSUTCDATETIME()
      FROM @AchievementSeeds AS seed
     WHERE NOT EXISTS (SELECT 1 FROM [user].[Achievements] existing WHERE existing.[Code] = seed.[Code]);

    /* 展示資料只保留可查詢的公開場館地址；未確認的線上房間名稱統一為線上活動。 */
    DECLARE @NorthVenue nvarchar(200) = N'國立故宮博物院｜臺北市士林區至善路二段221號';
    DECLARE @SouthVenue nvarchar(200) = N'國立故宮博物院南部院區｜嘉義縣太保市故宮大道888號';
    DECLARE @OnlineVenue nvarchar(200) = N'線上活動';

    UPDATE eventData
       SET [Location] = CASE
               WHEN [Location] IN (N'國立故宮博物院正館｜文獻導讀室', N'國立故宮博物院正館') THEN @NorthVenue
               WHEN [Location] IN (N'國立故宮博物院南部院區（故宮南院）｜多功能展廳', N'國立故宮博物院南部院區（故宮南院）｜教育展廳', N'國立故宮博物院南部院區（故宮南院）', N'清明鑑定屋｜二樓活動室') THEN @SouthVenue
               WHEN [Location] IN (N'社群線上交流室', N'線上交流室') THEN @OnlineVenue
               ELSE [Location]
           END,
           [Latitude] = CASE WHEN [Location] IN (N'社群線上交流室', N'線上交流室') THEN NULL ELSE [Latitude] END,
           [Longitude] = CASE WHEN [Location] IN (N'社群線上交流室', N'線上交流室') THEN NULL ELSE [Longitude] END
      FROM [social].[Events] AS eventData;

    UPDATE postData
       SET [Content] = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
               [Content],
               N'國立故宮博物院正館｜文獻導讀室', @NorthVenue),
               N'國立故宮博物院南部院區（故宮南院）｜多功能展廳', @SouthVenue),
               N'國立故宮博物院南部院區（故宮南院）｜教育展廳', @SouthVenue),
               N'清明鑑定屋｜二樓活動室', @SouthVenue),
               N'社群線上交流室', @OnlineVenue),
               N'線上交流室', @OnlineVenue),
               N'國立故宮博物院正館', @NorthVenue),
               N'國立故宮博物院南部院區（故宮南院）', @SouthVenue),
           [LocationName] = CASE
               WHEN [LocationName] IN (N'國立故宮博物院正館｜文獻導讀室', N'國立故宮博物院正館') THEN @NorthVenue
               WHEN [LocationName] IN (N'國立故宮博物院南部院區（故宮南院）｜多功能展廳', N'國立故宮博物院南部院區（故宮南院）｜教育展廳', N'國立故宮博物院南部院區（故宮南院）', N'清明鑑定屋｜二樓活動室') THEN @SouthVenue
               WHEN [LocationName] IN (N'社群線上交流室', N'線上交流室') THEN @OnlineVenue
               ELSE [LocationName]
           END,
           [Latitude] = CASE WHEN [LocationName] IN (N'社群線上交流室', N'線上交流室') THEN NULL ELSE [Latitude] END,
           [Longitude] = CASE WHEN [LocationName] IN (N'社群線上交流室', N'線上交流室') THEN NULL ELSE [Longitude] END
      FROM [social].[SocialPosts] AS postData;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
IF XACT_STATE() <> 0 COMMIT TRANSACTION;
GO
