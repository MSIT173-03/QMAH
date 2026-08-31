using System;
using System.Collections.Generic;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Infrastructure.Data;

/// <summary>
/// QMAH 對既有 SQL Server Schema 的 EF Core 對照入口。
/// </summary>
/// <remarks>
/// 本專案採 DB-first；資料表結構以已審核的 SQL Server 與 database/Schema.sql 為準。
/// 這個類別只負責資料表、欄位、關聯、索引與 Identity 的程式端 mapping，
/// 不負責建立或升級資料庫。Schema 變更後必須重新核對完整模型，不可在此處單獨猜測修改。
/// </remarks>
public partial class QmahDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public QmahDbContext(DbContextOptions<QmahDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AdminAuditLog> AuditLogs { get; set; }

    public virtual DbSet<Achievement> Achievements { get; set; }

    public virtual DbSet<Artifact> Artifacts { get; set; }

    public virtual DbSet<ArtifactCategory> ArtifactCategories { get; set; }

    public virtual DbSet<ArtifactQuestionEntry> ArtifactQuestionEntries { get; set; }

    public virtual DbSet<ArtifactUnlock> ArtifactUnlocks { get; set; }

    public virtual DbSet<CartItem> CartItems { get; set; }

    public virtual DbSet<ContentReport> ContentReports { get; set; }

    public virtual DbSet<CouponDefinition> CouponDefinitions { get; set; }

    public virtual DbSet<EraBucket> EraBuckets { get; set; }

    public virtual DbSet<Event> Events { get; set; }

    public virtual DbSet<EventRegistration> EventRegistrations { get; set; }

    public virtual DbSet<GamePlayer> GamePlayers { get; set; }

    public virtual DbSet<GameRoom> GameRooms { get; set; }

    public virtual DbSet<GameRound> GameRounds { get; set; }

    public virtual DbSet<KeyDefinition> KeyDefinitions { get; set; }

    public virtual DbSet<KeyTransaction> KeyTransactions { get; set; }

    public virtual DbSet<OfficialAnnouncement> OfficialAnnouncements { get; set; }

    public virtual DbSet<OrderDetail> OrderDetails { get; set; }

    public virtual DbSet<Payment> Payments { get; set; }

    public virtual DbSet<PointBalance> PointBalances { get; set; }

    public virtual DbSet<PointTransaction> PointTransactions { get; set; }

    public virtual DbSet<Product> Products { get; set; }

    public virtual DbSet<ProductReview> ProductReviews { get; set; }

    public virtual DbSet<RoundAnswer> RoundAnswers { get; set; }

    public virtual DbSet<SocialComment> SocialComments { get; set; }

    public virtual DbSet<SocialPost> SocialPosts { get; set; }

    public virtual DbSet<MediaAsset> MediaAssets { get; set; }

    public virtual DbSet<StoreOrder> StoreOrders { get; set; }

    public virtual DbSet<UserAchievement> UserAchievements { get; set; }

    public virtual DbSet<UserAddress> UserAddresses { get; set; }

    public virtual DbSet<UserCoupon> UserCoupons { get; set; }

    public virtual DbSet<UserKeyBalance> UserKeyBalances { get; set; }

    public virtual DbSet<UserNotification> UserNotifications { get; set; }

    public virtual DbSet<UserProfile> UserProfiles { get; set; }

    public virtual DbSet<Vote> Votes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // IdentityDbContext 的基礎 mapping 必須先保留，再套用 QMAH 的 schema 與欄位設定。
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AdminAuditLog>(entity =>
        {
            entity.ToTable("AuditLogs", "admin");

            entity.HasIndex(e => e.OccurredAt, "IX_AuditLogs_OccurredAt").IsDescending();
            entity.HasIndex(e => new { e.ActorUserId, e.OccurredAt }, "IX_AuditLogs_ActorUserId").IsDescending(false, true);

            entity.Property(e => e.Area).HasMaxLength(40);
            entity.Property(e => e.Controller).HasMaxLength(100);
            entity.Property(e => e.Action).HasMaxLength(100);
            entity.Property(e => e.HttpMethod).HasMaxLength(10);
            entity.Property(e => e.RequestPath).HasMaxLength(400);
            entity.Property(e => e.Detail).HasMaxLength(500);
            entity.Property(e => e.OccurredAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_AuditLogs_OccurredAt");

            entity.HasOne(e => e.ActorUser)
                .WithMany()
                .HasForeignKey(e => e.ActorUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_AuditLogs_ActorUser");
        });

        modelBuilder.Entity<Achievement>(entity =>
        {
            entity.ToTable("Achievements", "user");

            entity.HasIndex(e => new { e.Status, e.ConditionType, e.ThresholdValue }, "IX_Achievements_Condition_Threshold");

            entity.HasIndex(e => new { e.Status, e.Code }, "IX_Achievements_Status");

            entity.HasIndex(e => e.Code, "UX_Achievements_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(80);
            entity.Property(e => e.ConditionType).HasMaxLength(40);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Achievements_CreatedAt");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IconPath).HasMaxLength(1024);
            entity.Property(e => e.Name).HasMaxLength(120);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("ACTIVE", "DF_Achievements_Status");
            entity.Property(e => e.Title).HasMaxLength(120);
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Achievements_UpdatedAt");
        });

        modelBuilder.Entity<Artifact>(entity =>
        {
            entity.ToTable("Artifacts", "catalog");

            entity.HasIndex(e => new { e.CategoryId, e.EraBucketId }, "IX_Artifacts_Filter");

            entity.HasIndex(e => e.ArtifactRef, "UQ_Artifacts_Ref").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_Artifacts_Active");
            entity.Property(e => e.ArtifactRef).HasMaxLength(80);
            entity.Property(e => e.AttributionText).HasMaxLength(500);
            entity.Property(e => e.CreatorDisplay).HasMaxLength(300);
            entity.Property(e => e.EraTextOriginal).HasMaxLength(200);
            entity.Property(e => e.LicenseCode).HasMaxLength(80);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.PrimaryImagePath).HasMaxLength(500);
            entity.Property(e => e.SizeText).HasMaxLength(500);
            entity.Property(e => e.SourceUrl).HasMaxLength(1000);
            entity.Property(e => e.ThumbnailPath).HasMaxLength(500);

            entity.HasOne(d => d.Category).WithMany(p => p.Artifacts)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Artifacts_Category");

            entity.HasOne(d => d.EraBucket).WithMany(p => p.Artifacts)
                .HasForeignKey(d => d.EraBucketId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Artifacts_Era");
        });

        modelBuilder.Entity<ArtifactCategory>(entity =>
        {
            entity.ToTable("ArtifactCategories", "catalog");

            entity.HasIndex(e => e.Code, "UQ_ArtifactCategories_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(32);
            entity.Property(e => e.Name).HasMaxLength(80);
        });

        modelBuilder.Entity<ArtifactQuestionEntry>(entity =>
        {
            entity.ToTable("ArtifactQuestionEntries", "game");

            entity.HasIndex(e => e.ArtifactId, "UQ_ArtifactQuestionEntries_Artifact").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ArtifactQuestionEntries_Created");
            entity.Property(e => e.Difficulty).HasDefaultValue((byte)1, "DF_ArtifactQuestionEntries_Difficulty");
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_ArtifactQuestionEntries_Enabled");
            entity.Property(e => e.QuestionTemplateCode)
                .HasMaxLength(50)
                .HasDefaultValue("GENERAL", "DF_ArtifactQuestionEntries_Template");
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ArtifactQuestionEntries_Updated");

            entity.HasOne(d => d.Artifact).WithOne(p => p.ArtifactQuestionEntry)
                .HasForeignKey<ArtifactQuestionEntry>(d => d.ArtifactId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ArtifactQuestionEntries_Artifact");
        });

        modelBuilder.Entity<ArtifactUnlock>(entity =>
        {
            entity.ToTable("ArtifactUnlocks", "catalog");

            entity.HasIndex(e => new { e.UserId, e.ArtifactId }, "UQ_ArtifactUnlocks_UserArtifact").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.UnlockMethod).HasMaxLength(20);
            entity.Property(e => e.UnlockedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ArtifactUnlocks_At");

            entity.HasOne(d => d.Artifact).WithMany(p => p.ArtifactUnlocks)
                .HasForeignKey(d => d.ArtifactId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ArtifactUnlocks_Artifact");

            entity.HasOne(d => d.KeyTransaction).WithMany(p => p.ArtifactUnlocks)
                .HasForeignKey(d => d.KeyTransactionId)
                .HasConstraintName("FK_ArtifactUnlocks_KeyTx");

            entity.HasOne(d => d.User).WithMany(p => p.ArtifactUnlocks)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ArtifactUnlocks_User");

            entity.HasOne(d => d.GameRound).WithMany(p => p.ArtifactUnlocks)
                .HasForeignKey(d => d.GameRoundId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ArtifactUnlocks_GameRound");
        });

        modelBuilder.Entity<CartItem>(entity =>
        {
            entity.ToTable("CartItems", "store");

            entity.HasIndex(e => new { e.UserId, e.ProductId }, "UQ_CartItems_MemberProduct").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AddedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_CartItems_Added");

            entity.HasOne(d => d.Product).WithMany(p => p.CartItems)
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CartItems_Product");

            entity.HasOne(d => d.User).WithMany(p => p.CartItems)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_CartItems_User");
        });

        modelBuilder.Entity<ContentReport>(entity =>
        {
            entity.ToTable("ContentReports", "social");

            entity.HasIndex(e => new { e.Status, e.CreatedAt }, "IX_ContentReports_Status");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ContentReports_Created");
            entity.Property(e => e.Detail).HasMaxLength(1000);
            entity.Property(e => e.Reason).HasMaxLength(100);
            entity.Property(e => e.Resolution).HasMaxLength(1000);
            entity.Property(e => e.ReviewedAt).HasPrecision(3);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("PENDING", "DF_ContentReports_Status");
            entity.Property(e => e.TargetType).HasMaxLength(20);

            entity.HasOne(d => d.ReporterUser).WithMany(p => p.SubmittedContentReports)
                .HasForeignKey(d => d.ReporterUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ContentReports_ReporterUser");

            entity.HasOne(d => d.ReviewedByUser).WithMany(p => p.ReviewedContentReports)
                .HasForeignKey(d => d.ReviewedByUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ContentReports_ReviewedByUser");
        });

        modelBuilder.Entity<CouponDefinition>(entity =>
        {
            entity.ToTable("CouponDefinitions", "store");

            entity.HasIndex(e => e.Code, "UQ_CouponDefinitions_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.DiscountType).HasMaxLength(20);
            entity.Property(e => e.DiscountValue).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.EndAt).HasPrecision(3);
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_Coupons_Active");
            entity.Property(e => e.MinimumAmount).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.StartAt).HasPrecision(3);
        });

        modelBuilder.Entity<EraBucket>(entity =>
        {
            entity.ToTable("EraBuckets", "catalog");

            entity.HasIndex(e => e.Code, "UQ_EraBuckets_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(40);
            entity.Property(e => e.Name).HasMaxLength(80);
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.ToTable("Events", "social");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Events_Created");
            entity.Property(e => e.EndAt).HasPrecision(3);
            entity.Property(e => e.EventType).HasMaxLength(20);
            entity.Property(e => e.Location).HasMaxLength(200);
            entity.Property(e => e.Latitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.PublishStatus)
                .HasMaxLength(20)
                .HasDefaultValue("DRAFT", "DF_Events_Publish");
            entity.Property(e => e.RegistrationEndAt).HasPrecision(3);
            entity.Property(e => e.ReviewNote).HasMaxLength(500);
            entity.Property(e => e.ReviewStatus)
                .HasMaxLength(20)
                .HasDefaultValue("PENDING", "DF_Events_Review");
            entity.Property(e => e.ReviewedAt).HasPrecision(3);
            entity.Property(e => e.StartAt).HasPrecision(3);
            entity.Property(e => e.Title).HasMaxLength(150);

            entity.HasOne(d => d.OrganizerUser).WithMany(p => p.OrganizedEvents)
                .HasForeignKey(d => d.OrganizerUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Events_OrganizerUser");

            entity.HasOne(d => d.ReviewedByUser).WithMany(p => p.ReviewedEvents)
                .HasForeignKey(d => d.ReviewedByUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Events_ReviewedByUser");

            entity.HasOne(d => d.SocialPost)
                .WithOne(p => p.Event)
                .HasForeignKey<SocialPost>(p => p.EventId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SocialPosts_Event");
        });

        modelBuilder.Entity<EventRegistration>(entity =>
        {
            entity.ToTable("EventRegistrations", "social");

            entity.HasIndex(e => new { e.EventId, e.UserId }, "UQ_EventRegistrations_EventMember").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.RegisteredAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_EventRegistrations_At");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("REGISTERED", "DF_EventRegistrations_Status");

            entity.HasOne(d => d.Event).WithMany(p => p.EventRegistrations)
                .HasForeignKey(d => d.EventId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_EventRegistrations_Event");

            entity.HasOne(d => d.User).WithMany(p => p.EventRegistrations)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_EventRegistrations_User");
        });

        modelBuilder.Entity<GamePlayer>(entity =>
        {
            entity.ToTable("GamePlayers", "game");

            entity.HasIndex(e => new { e.RoomId, e.ConnectionStatus, e.LeftAt }, "IX_GamePlayers_Room_ConnectionStatus");

            entity.HasIndex(e => new { e.UserId, e.RoomId }, "IX_GamePlayers_UserId_RoomId").HasFilter("([UserId] IS NOT NULL)");

            entity.HasIndex(e => e.RoomId, "UX_GamePlayers_OneHostPerRoom")
                .IsUnique()
                .HasFilter("([Role]=N'HOST')");

            entity.HasIndex(e => new { e.RoomId, e.PlayerKey }, "UX_GamePlayers_Room_PlayerKey").IsUnique();

            entity.HasIndex(e => new { e.RoomId, e.SeatNo }, "UX_GamePlayers_Room_SeatNo")
                .IsUnique()
                .HasFilter("([SeatNo] IS NOT NULL)");

            entity.HasIndex(e => new { e.RoomId, e.UserId }, "UX_GamePlayers_Room_UserId")
                .IsUnique()
                .HasFilter("([UserId] IS NOT NULL)");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.ConnectionStatus)
                .HasMaxLength(12)
                .HasDefaultValue("ONLINE", "DF_GamePlayers_ConnectionStatus");
            entity.Property(e => e.DisconnectedAt).HasPrecision(3);
            entity.Property(e => e.DisplayName).HasMaxLength(80);
            entity.Property(e => e.JoinedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_GamePlayers_JoinedAt");
            entity.Property(e => e.LastSeenAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_GamePlayers_LastSeenAt");
            entity.Property(e => e.LeftAt).HasPrecision(3);
            entity.Property(e => e.PlayerKey).HasMaxLength(80);
            entity.Property(e => e.ReconnectDeadlineAt).HasPrecision(3);
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .HasDefaultValue("PLAYER", "DF_GamePlayers_Role");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.Room).WithMany(p => p.GamePlayers)
                .HasForeignKey(d => d.RoomId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.User).WithMany(p => p.GamePlayers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_GamePlayers_User");
        });

        modelBuilder.Entity<GameRoom>(entity =>
        {
            entity.ToTable("GameRooms", "game");

            entity.HasIndex(e => new { e.Status, e.Visibility, e.CreatedAt }, "IX_GameRooms_PublicLobby").IsDescending(false, false, true);

            entity.HasIndex(e => new { e.Status, e.CreatedAt }, "IX_GameRooms_Status_CreatedAt").IsDescending(false, true);

            entity.HasIndex(e => e.RoomCode, "UX_GameRooms_RoomCode").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AnswerSeconds).HasDefaultValue((short)120, "DF_GameRooms_AnswerSeconds");
            entity.Property(e => e.CategoryFilterCode).HasMaxLength(50);
            entity.Property(e => e.CompletedAt).HasPrecision(3);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_GameRooms_CreatedAt");
            entity.Property(e => e.EndedAt).HasPrecision(3);
            entity.Property(e => e.EraBucketFilterCode).HasMaxLength(50);
            entity.Property(e => e.MaxPlayers).HasDefaultValue((byte)10, "DF_GameRooms_MaxPlayers");
            entity.Property(e => e.PasswordHash).HasMaxLength(255);
            entity.Property(e => e.RoomCode).HasMaxLength(12);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.StartedAt).HasPrecision(3);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("WAITING", "DF_GameRooms_Status");
            entity.Property(e => e.TotalRounds).HasDefaultValue((byte)1, "DF_GameRooms_TotalRounds");
            entity.Property(e => e.Visibility)
                .HasMaxLength(10)
                .HasDefaultValue("PUBLIC", "DF_GameRooms_Visibility");
            entity.Property(e => e.VotingSeconds).HasDefaultValue((short)60, "DF_GameRooms_VotingSeconds");
        });

        modelBuilder.Entity<GameRound>(entity =>
        {
            entity.ToTable("GameRounds", "game");

            entity.HasIndex(e => e.ArtifactId, "IX_GameRounds_ArtifactId");

            entity.HasIndex(e => new { e.RoomId, e.RoundNumber }, "UX_GameRounds_Room_RoundNumber").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AnswerDeadlineAt).HasPrecision(3);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.SettledAt).HasPrecision(3);
            entity.Property(e => e.StartedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_GameRounds_StartedAt");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("ANSWERING", "DF_GameRounds_Status");
            entity.Property(e => e.VotingDeadlineAt).HasPrecision(3);

            entity.HasOne(d => d.Room).WithMany(p => p.GameRounds)
                .HasForeignKey(d => d.RoomId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Artifact).WithMany(p => p.GameRounds)
                .HasForeignKey(d => d.ArtifactId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_GameRounds_Artifact");
        });

        modelBuilder.Entity<KeyDefinition>(entity =>
        {
            entity.ToTable("KeyDefinitions", "catalog");

            entity.HasIndex(e => e.Code, "UQ_KeyDefinitions_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_KeyDefinitions_Active");
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.ScopeType).HasMaxLength(20);

            entity.HasOne(d => d.Category).WithMany(p => p.KeyDefinitions)
                .HasForeignKey(d => d.CategoryId)
                .HasConstraintName("FK_KeyDefinitions_Category");

            entity.HasOne(d => d.EraBucket).WithMany(p => p.KeyDefinitions)
                .HasForeignKey(d => d.EraBucketId)
                .HasConstraintName("FK_KeyDefinitions_Era");
        });

        modelBuilder.Entity<KeyTransaction>(entity =>
        {
            entity.ToTable("KeyTransactions", "catalog");

            entity.HasIndex(e => new { e.UserId, e.CreatedAt }, "IX_KeyTransactions_User").IsDescending(false, true);

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_KeyTransactions_Created");
            entity.Property(e => e.Reason).HasMaxLength(40);
            entity.Property(e => e.ReferenceType).HasMaxLength(40);

            entity.HasOne(d => d.KeyDefinition).WithMany(p => p.KeyTransactions)
                .HasForeignKey(d => d.KeyDefinitionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_KeyTransactions_Key");

            entity.HasOne(d => d.User).WithMany(p => p.KeyTransactions)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_KeyTransactions_User");
        });

        modelBuilder.Entity<OfficialAnnouncement>(entity =>
        {
            entity.ToTable("OfficialAnnouncements", "social");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Category)
                .HasMaxLength(30)
                .HasDefaultValue("UPDATE", "DF_Announcements_Category");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Announcements_Created");
            entity.Property(e => e.EndAt).HasPrecision(3);
            entity.Property(e => e.PublishAt).HasPrecision(3);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("DRAFT", "DF_Announcements_Status");
            entity.Property(e => e.Summary).HasMaxLength(300);
            entity.Property(e => e.Title).HasMaxLength(150);
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Announcements_Updated");

            entity.HasOne(d => d.CreatedByUser).WithMany(p => p.OfficialAnnouncements)
                .HasForeignKey(d => d.CreatedByUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_OfficialAnnouncements_CreatedByUser");

        });

        modelBuilder.Entity<OrderDetail>(entity =>
        {
            entity.ToTable("OrderDetails", "store");

            entity.HasIndex(e => new { e.OrderId, e.ProductId }, "UQ_OrderDetails_OrderProduct").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.LineTotal).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.ProductNameSnapshot).HasMaxLength(200);
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(12, 2)");

            entity.HasOne(d => d.Order).WithMany(p => p.OrderDetails)
                .HasForeignKey(d => d.OrderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrderDetails_Order");

            entity.HasOne(d => d.Product).WithMany(p => p.OrderDetails)
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrderDetails_Product");
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("Payments", "store");

            entity.HasIndex(e => e.MerchantTradeNo, "UQ_Payments_MerchantTradeNo").IsUnique();

            entity.HasIndex(e => e.OrderId, "UQ_Payments_Order").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Amount).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.CallbackReceivedAt).HasPrecision(3);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Payments_Created");
            entity.Property(e => e.EcpayTradeNo).HasMaxLength(30);
            entity.Property(e => e.MerchantTradeNo).HasMaxLength(30);
            entity.Property(e => e.PaymentType).HasMaxLength(50);
            entity.Property(e => e.RtnMsg).HasMaxLength(200);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("PENDING", "DF_Payments_Status");

            entity.HasOne(d => d.Order).WithOne(p => p.Payment)
                .HasForeignKey<Payment>(d => d.OrderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Payments_Order");
        });

        modelBuilder.Entity<PointBalance>(entity =>
        {
            entity.HasKey(e => e.UserId);

            entity.ToTable("PointBalances", "store");

            entity.Property(e => e.UserId).ValueGeneratedNever();
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_PointBalances_Updated");

            entity.HasOne(d => d.User).WithOne(p => p.PointBalance)
                .HasForeignKey<PointBalance>(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_PointBalances_User");
        });

        modelBuilder.Entity<PointTransaction>(entity =>
        {
            entity.ToTable("PointTransactions", "store");

            entity.HasIndex(e => new { e.UserId, e.CreatedAt }, "IX_PointTransactions_Member").IsDescending(false, true);

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_PointTransactions_Created");
            entity.Property(e => e.Reason).HasMaxLength(40);
            entity.Property(e => e.ReferenceType).HasMaxLength(40);

            entity.HasOne(d => d.User).WithMany(p => p.PointTransactions)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_PointTransactions_User");
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("Products", "store");

            entity.HasIndex(e => e.ExternalRef, "UX_Products_ExternalRef")
                .IsUnique()
                .HasFilter("([ExternalRef] IS NOT NULL)");

            entity.HasIndex(e => e.ArtifactId, "UX_Products_ArtifactId")
                .IsUnique()
                .HasFilter("([ArtifactId] IS NOT NULL)");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CategoryCode).HasMaxLength(40);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Products_Created");
            entity.Property(e => e.ExternalRef).HasMaxLength(100);
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_Products_Active");
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Price).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.PrimaryImagePath).HasMaxLength(500);
            entity.Property(e => e.SizeText).HasMaxLength(500);
            entity.Property(e => e.SourceUrl).HasMaxLength(1000);
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Products_Updated");
            entity.HasOne(d => d.Artifact).WithOne(p => p.Product)
                .HasForeignKey<Product>(d => d.ArtifactId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Products_Artifact");
        });

        modelBuilder.Entity<ProductReview>(entity =>
        {
            entity.ToTable("ProductReviews", "store");

            entity.HasIndex(e => new { e.ProductId, e.Status, e.CreatedAt }, "IX_ProductReviews_Product_Status_Created")
                .IsDescending(false, false, true);
            entity.HasIndex(e => new { e.ProductId, e.UserId }, "UX_ProductReviews_Product_User")
                .IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Content).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ProductReviews_CreatedAt");
            entity.Property(e => e.Rating).HasColumnType("tinyint");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("PUBLISHED", "DF_ProductReviews_Status");
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ProductReviews_UpdatedAt");

            entity.HasOne(d => d.Product).WithMany(p => p.ProductReviews)
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ProductReviews_Product");

            entity.HasOne(d => d.User).WithMany(p => p.ProductReviews)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_ProductReviews_User");
        });

        modelBuilder.Entity<RoundAnswer>(entity =>
        {
            entity.ToTable("RoundAnswers", "game");

            entity.HasIndex(e => new { e.RoundId, e.GamePlayerId }, "UX_RoundAnswers_Round_GamePlayer").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AnswerType).HasMaxLength(30);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.SubmittedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_RoundAnswers_SubmittedAt");
            entity.Property(e => e.Text).HasMaxLength(500);

            entity.HasOne(d => d.GamePlayer).WithMany(p => p.RoundAnswers)
                .HasForeignKey(d => d.GamePlayerId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Round).WithMany(p => p.RoundAnswers)
                .HasForeignKey(d => d.RoundId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<SocialComment>(entity =>
        {
            entity.ToTable("SocialComments", "social");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Content).HasMaxLength(2000);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_SocialComments_Created");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("PUBLISHED", "DF_SocialComments_Status");
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_SocialComments_Updated");

            entity.HasOne(d => d.ParentComment).WithMany(p => p.InverseParentComment)
                .HasForeignKey(d => d.ParentCommentId)
                .HasConstraintName("FK_SocialComments_Parent");

            entity.HasOne(d => d.Post).WithMany(p => p.SocialComments)
                .HasForeignKey(d => d.PostId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SocialComments_Post");

            entity.HasOne(d => d.User).WithMany(p => p.SocialComments)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SocialComments_User");
        });

        modelBuilder.Entity<SocialPost>(entity =>
        {
            entity.ToTable("SocialPosts", "social");

            entity.HasIndex(e => new { e.BoardCode, e.Status, e.CreatedAt }, "IX_SocialPosts_BoardCreated").IsDescending(false, false, true);
            entity.HasIndex(e => e.EventId, "UQ_SocialPosts_EventId")
                .IsUnique()
                .HasFilter("[EventId] IS NOT NULL");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.BoardCode).HasMaxLength(30);
            entity.Property(e => e.EventId);
            entity.Property(e => e.PostType)
                .HasMaxLength(20)
                .HasDefaultValue("POST", "DF_SocialPosts_PostType");
            entity.Property(e => e.PublisherType)
                .HasMaxLength(20)
                .HasDefaultValue("COMMUNITY", "DF_SocialPosts_PublisherType");
            entity.Property(e => e.ContentMode)
                .HasMaxLength(20)
                .HasDefaultValue("CUSTOM", "DF_SocialPosts_ContentMode");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_SocialPosts_Created");
            entity.Property(e => e.LocationName).HasMaxLength(200);
            entity.Property(e => e.Latitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("PUBLISHED", "DF_SocialPosts_Status");
            entity.Property(e => e.Title).HasMaxLength(150);
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_SocialPosts_Updated");

            entity.HasOne(d => d.User).WithMany(p => p.SocialPosts)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SocialPosts_User");

            entity.HasOne(d => d.Artifact).WithMany(p => p.SocialPosts)
                .HasForeignKey(d => d.ArtifactId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SocialPosts_Artifact");
        });

        modelBuilder.Entity<MediaAsset>(entity =>
        {
            entity.ToTable("MediaAssets", "social");

            entity.HasIndex(e => new { e.PostId, e.Status, e.CreatedAt }, "IX_MediaAssets_Post_Status");
            entity.HasIndex(e => new { e.OwnerUserId, e.Status, e.CreatedAt }, "IX_MediaAssets_Owner_Status").IsDescending(false, false, true);
            entity.HasIndex(e => e.SequenceNo, "UQ_MediaAssets_SequenceNo").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.SequenceNo)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("(NEXT VALUE FOR [social].[MediaAssetSequence])");
            entity.Property(e => e.OriginalFileName).HasMaxLength(260);
            entity.Property(e => e.StoredPath).HasMaxLength(500);
            entity.Property(e => e.ContentType).HasMaxLength(100);
            entity.Property(e => e.AltText).HasMaxLength(200);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("ACTIVE", "DF_MediaAssets_Status");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_MediaAssets_CreatedAt");
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_MediaAssets_UpdatedAt");

            entity.HasOne(e => e.OwnerUser)
                .WithMany()
                .HasForeignKey(e => e.OwnerUserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_MediaAssets_OwnerUser");

            entity.HasOne(e => e.Post)
                .WithMany(post => post.MediaAssets)
                .HasForeignKey(e => e.PostId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_MediaAssets_Post");
        });

        modelBuilder.Entity<StoreOrder>(entity =>
        {
            entity.ToTable("StoreOrders", "store");

            entity.HasIndex(e => e.OrderNo, "UQ_StoreOrders_OrderNo").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CancelledAt).HasPrecision(3);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_StoreOrders_Created");
            entity.Property(e => e.DiscountAmount).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.OrderNo).HasMaxLength(30);
            entity.Property(e => e.PaidAt).HasPrecision(3);
            entity.Property(e => e.RecipientName).HasMaxLength(80);
            entity.Property(e => e.RecipientPhone).HasMaxLength(30);
            entity.Property(e => e.ShippingAddressLine).HasMaxLength(200);
            entity.Property(e => e.ShippingCity).HasMaxLength(30);
            entity.Property(e => e.ShippingDistrict).HasMaxLength(30);
            entity.Property(e => e.ShippingPostalCode).HasMaxLength(10);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValue("PENDING_PAYMENT", "DF_StoreOrders_Status");
            entity.Property(e => e.Subtotal).HasColumnType("decimal(12, 2)");
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(12, 2)");
            entity.HasOne(d => d.UserCoupon).WithMany(p => p.StoreOrders)
                .HasForeignKey(d => d.UserCouponId)
                .HasConstraintName("FK_StoreOrders_Coupon");

            entity.HasOne(d => d.User).WithMany(p => p.StoreOrders)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_StoreOrders_User");
        });

        modelBuilder.Entity<UserAchievement>(entity =>
        {
            entity.ToTable("UserAchievements", "user");

            entity.HasIndex(e => new { e.AchievementId, e.UserId }, "IX_UserAchievements_Achievement_Member");

            entity.HasIndex(e => new { e.UserId, e.AchievedAt }, "IX_UserAchievements_Member_AchievedAt").IsDescending(false, true);

            entity.HasIndex(e => new { e.UserId, e.AchievementId }, "UX_UserAchievements_Member_Achievement").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AchievedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserAchievements_AchievedAt");
            entity.Property(e => e.DisplayedAt).HasPrecision(3);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.Achievement).WithMany(p => p.UserAchievements)
                .HasForeignKey(d => d.AchievementId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<UserAddress>(entity =>
        {
            entity.ToTable("UserAddresses", "user");

            entity.HasIndex(e => e.UserId, "UX_UserAddresses_Member_Default")
                .IsUnique()
                .HasFilter("([IsDefault]=(1))");

            entity.HasIndex(e => new { e.UserId, e.AddressLabel }, "UX_UserAddresses_Member_Label").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AddressLabel).HasMaxLength(50);
            entity.Property(e => e.AddressLine).HasMaxLength(300);
            entity.Property(e => e.City).HasMaxLength(80);
            entity.Property(e => e.Latitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserAddresses_CreatedAt");
            entity.Property(e => e.District).HasMaxLength(80);
            entity.Property(e => e.PostalCode).HasMaxLength(20);
            entity.Property(e => e.RecipientName).HasMaxLength(80);
            entity.Property(e => e.RecipientPhone).HasMaxLength(30);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserAddresses_UpdatedAt");
        });

        modelBuilder.Entity<UserCoupon>(entity =>
        {
            entity.ToTable("UserCoupons", "store");

            entity.HasIndex(e => new { e.UserId, e.CouponDefinitionId }, "UQ_UserCoupons_UserCoupon").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.IssuedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserCoupons_Issued");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("AVAILABLE", "DF_UserCoupons_Status");
            entity.Property(e => e.UsedAt).HasPrecision(3);

            entity.HasOne(d => d.CouponDefinition).WithMany(p => p.UserCoupons)
                .HasForeignKey(d => d.CouponDefinitionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_UserCoupons_Definition");

            entity.HasOne(d => d.User).WithMany(p => p.Coupons)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_UserCoupons_User");
        });

        modelBuilder.Entity<UserKeyBalance>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.KeyDefinitionId });

            entity.ToTable("UserKeyBalances", "catalog");

            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserKeyBalances_Updated");

            entity.HasOne(d => d.KeyDefinition).WithMany(p => p.UserKeyBalances)
                .HasForeignKey(d => d.KeyDefinitionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_UserKeyBalances_Key");

            entity.HasOne(d => d.User).WithMany(p => p.KeyBalances)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_UserKeyBalances_User");
        });

        modelBuilder.Entity<UserNotification>(entity =>
        {
            entity.ToTable("UserNotifications", "social");

            entity.HasIndex(e => new { e.UserId, e.IsRead, e.CreatedAt }, "IX_UserNotifications_Member").IsDescending(false, false, true);

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Content).HasMaxLength(500);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserNotifications_Created");
            entity.Property(e => e.ReadAt).HasPrecision(3);
            entity.Property(e => e.TargetUrl).HasMaxLength(500);

            entity.HasOne(d => d.User).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_UserNotifications_User");
            entity.Property(e => e.Title).HasMaxLength(150);
        });

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.UserId);

            entity.ToTable("UserProfiles", "user");

            entity.Property(e => e.UserId).ValueGeneratedNever();
            entity.Property(e => e.AvatarPath).HasMaxLength(1024);
            entity.Property(e => e.Bio).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserProfiles_CreatedAt");
            entity.Property(e => e.Nickname).HasMaxLength(80);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_UserProfiles_UpdatedAt");
            entity.Property(e => e.Visibility)
                .HasMaxLength(20)
                .HasDefaultValue("PUBLIC", "DF_UserProfiles_Visibility");
        });

        modelBuilder.Entity<Vote>(entity =>
        {
            entity.ToTable("Votes", "game");

            entity.HasIndex(e => e.AnswerId, "IX_Votes_AnswerId");

            entity.HasIndex(e => new { e.RoundId, e.VoterGamePlayerId }, "IX_Votes_Round_Voter");

            entity.HasIndex(e => new { e.RoundId, e.VoterGamePlayerId, e.AnswerId }, "UX_Votes_Round_Voter_Answer").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.SubmittedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Votes_SubmittedAt");

            entity.HasOne(d => d.Answer).WithMany(p => p.Votes)
                .HasForeignKey(d => d.AnswerId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Round).WithMany(p => p.Votes)
                .HasForeignKey(d => d.RoundId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.VoterGamePlayer).WithMany(p => p.Votes)
                .HasForeignKey(d => d.VoterGamePlayerId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        ConfigureIdentity(modelBuilder);

    }

    private static void ConfigureIdentity(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("AspNetUsers", "user");

            entity.Property(user => user.Status)
                .HasMaxLength(20)
                .HasDefaultValue("ACTIVE", "DF_AspNetUsers_Status");
            entity.Property(user => user.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_AspNetUsers_CreatedAt");
            entity.Property(user => user.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_AspNetUsers_UpdatedAt");

            entity.HasOne(user => user.Profile)
                .WithOne(profile => profile.User)
                .HasForeignKey<UserProfile>(profile => profile.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_UserProfiles_AspNetUsers_UserId");

            entity.HasMany(user => user.Addresses)
                .WithOne(address => address.User)
                .HasForeignKey(address => address.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_UserAddresses_AspNetUsers_UserId");

            entity.HasMany(user => user.Achievements)
                .WithOne(achievement => achievement.User)
                .HasForeignKey(achievement => achievement.UserId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_UserAchievements_AspNetUsers_UserId");
        });

        modelBuilder.Entity<IdentityRole<Guid>>().ToTable("AspNetRoles", "user");
        modelBuilder.Entity<IdentityUserRole<Guid>>().ToTable("AspNetUserRoles", "user");
        modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("AspNetUserClaims", "user");
        modelBuilder.Entity<IdentityUserLogin<Guid>>(entity =>
        {
            entity.ToTable("AspNetUserLogins", "user");
            entity.Property(login => login.LoginProvider).HasMaxLength(128);
            entity.Property(login => login.ProviderKey).HasMaxLength(128);
        });
        modelBuilder.Entity<IdentityUserToken<Guid>>(entity =>
        {
            entity.ToTable("AspNetUserTokens", "user");
            entity.Property(token => token.LoginProvider).HasMaxLength(128);
            entity.Property(token => token.Name).HasMaxLength(128);
        });
        modelBuilder.Entity<IdentityRoleClaim<Guid>>().ToTable("AspNetRoleClaims", "user");
    }

}
