# 第三方登入預留方式

QMAH 已使用 ASP.NET Core Identity，不需要為 Google、Microsoft 或其他第三方登入預先新增資料表。

目前的帳號密碼登入、登出與角色限制見[期中 Identity 實作](09-midterm-identity.md)。本文件只說明日後加入第三方登入時的資料庫與設定界線。

標準 Identity 結構中的 `user.AspNetUserLogins` 會保存外部登入來源、第三方帳號識別碼與 QMAH `UserId` 的對應。`user.AspNetUsers` 仍是會員主資料，`user.UserProfiles` 仍保存網站內使用的暱稱、頭像與自我介紹。Entity 不需要加入 `GoogleId`、`MicrosoftId` 之類的專用欄位。

## 尚未確定採用前

- 保留目前 Schema，不新增空白欄位或自訂登入表。
- 不先安裝任何第三方登入套件。
- 不把 Client ID、Client Secret 或測試憑證寫進 Repository。
- 一般帳號、角色、會員資料與既有登入流程照常開發。

這樣不會阻礙日後加入第三方登入，也不會讓尚未確定的功能增加維護成本。

## 確定採用後需要完成的部分

以 Google 登入為例：

1. 加入與目前 .NET 版本相同的 `Microsoft.AspNetCore.Authentication.Google` 套件。
2. 在 `Program.cs` 的 Identity 設定後加入 `AddGoogle`。
3. 本機將 Client ID 與 Client Secret 放進 Visual Studio User Secrets；部署環境改用受控的 Secret 設定來源。
4. 建立外部登入按鈕、callback、失敗訊息與第一次登入時的會員資料確認頁。
5. 測試新會員登入、既有會員綁定、解除綁定、停權帳號與登出流程。

微軟的 [Google 外部登入設定](https://learn.microsoft.com/aspnet/core/security/authentication/social/google-logins?view=aspnetcore-10.0) 與 [其他外部驗證提供者](https://learn.microsoft.com/aspnet/core/security/authentication/social/?view=aspnetcore-10.0) 都建立在 ASP.NET Core Identity 的既有帳號結構上。

## 帳號綁定規則

第三方登入回傳的 Email 不應直接當成唯一可信的綁定依據。實作時應採用以下流程：

- 已有相同外部登入對應：直接登入該 QMAH 帳號。
- 已登入會員主動新增登入方式：完成第三方驗證後，綁定至目前帳號。
- 第三方 Email 與既有會員相同，但尚未綁定：要求先驗證既有帳號或完成明確的綁定確認，不自動合併。
- QMAH 帳號為 `DISABLED` 或 `BANNED`：即使第三方驗證成功，也不得繞過網站帳號狀態。

只有在需要保存第三方專屬個人資料、使用者授權同意版本、登入稽核或多組織身分時，才評估新增自訂資料表。這些需求目前尚未確定，因此不提前變更 Schema。
