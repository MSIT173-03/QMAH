# 會員修改密碼

入口：會員中心 → 帳戶管理 → 帳號安全（`/member/security`）。

已設定密碼的會員輸入目前密碼、新密碼及確認新密碼。新密碼為 8–100 字元，包含大小寫英文、數字與特殊符號，且不得與目前密碼相同。後端使用 Identity 驗證目前密碼及密碼強度；密碼錯誤會依既有設定累計鎖定，API 亦受 auth 限流與 antiforgery 保護。

修改成功會更新密碼雜湊與 security stamp，清除目前登入 Cookie 與前端會員狀態。API 與管理後台皆在每次請求驗證 security stamp，所以其他既有 Cookie 在下次驗證時失效。會員需使用新密碼重新登入。

目前沒有本網站密碼的第三方會員會看到說明與忘記密碼入口，不會要求輸入 Google、Facebook 或 Microsoft 密碼。若想增加本網站密碼，可透過既有忘記密碼寄送 Brevo 重設連結。若信箱尚未驗證，完成重設後仍須依登入提示完成信箱驗證。

登入後修改密碼不需要寄信；忘記密碼與註冊信箱驗證沿用 Brevo。這次沒有變動寄件者、API key 或收件網域設定，也沒有寄出測試郵件。

## API

- `GET /api/v1/account/password-status`：需要登入，回傳 `{ "hasPassword": true }`。
- `POST /api/v1/account/change-password`：需要登入，本文包含 `currentPassword`、`newPassword`、`confirmPassword`，會員 ID 來自 Cookie。成功回傳 204 並登出；錯誤密碼或密碼規則不符回傳 400，未登入或非 ACTIVE 回傳 401，無本站密碼回傳 409，鎖定回傳 423，限流回傳 429。

## 驗證

`dotnet run --project tools/AccountVerificationChecks/AccountVerificationChecks.csproj` 使用真正的 Identity PasswordHasher 與 PasswordValidator 驗證密碼變更；使用記憶體測試會員，不連資料庫或寄真信。

在 `QMAH.Client` 執行 `node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/user/security/security.spec.ts` 檢查第三方專用會員顯示、密碼表單規則、POST 防偽流程、成功後清除狀態，以及錯誤恢復。

展示前仍需以測試帳號實際操作一次：目前密碼錯誤 → 修正 → 修改成功 → 新密碼登入；以及確認 Brevo 的 Gmail 重設信可正常收取。
