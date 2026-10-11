# 會員信箱驗證

一般會員註冊保留 Cloudflare Turnstile。註冊成功後不自動登入，改由 Brevo 寄送驗證信，前台跳轉到 `/verify-email`。使用者開啟信中的連結後，按「確認驗證信箱」才會提交驗證，避免郵件掃描器開啟連結就驗證帳號。

## 設定

- 沿用 `Brevo:ApiKey` 與現有已驗證的寄件者。
- `Frontend:ClientUrl` 必須是部署前台的來源網址，例如 `https://qmah.example`；驗證信會指向此網址下的 `/verify-email`，未設定時使用 `http://localhost:4200`。
- 使用既有 Identity `EmailConfirmed` 欄位與預設信箱驗證 token provider，無須資料庫 migration。預設 token 時效沿用 Identity 設定；伺服器 Data Protection 金鑰必須按既有部署設定保留。

## 行為

- `POST /api/v1/account/register` 回傳 `requiresEmailConfirmation: true` 與 `confirmationEmailSent`。寄信失敗保留已建立帳號並顯示重寄入口，不能以重新註冊恢復。
- `POST /api/v1/account/confirm-email` 接收 `email` 與 Base64Url `token`。無效連結回傳 400；合法連結重複驗證回傳 204。密碼重設 token 不能用來驗證信箱。
- `POST /api/v1/account/resend-confirmation-link` 接收 `email` 與原驗證信 `token`；先核對會員身分、用途與有效期，不匹配或過期回傳 400，且不寄信。合法連結僅對 ACTIVE 且未驗證會員寄信。
- `POST /api/v1/account/resend-confirmation` 接收 `email` 與 `password`；只有會員密碼正確才能重寄，並沿用密碼失敗鎖定。不存在、密碼錯誤、已驗證、非 ACTIVE 或郵件服務失敗均回傳相同 202 訊息。
- 兩種重寄入口共用 `verificationEmail` 限流：同一 IP 五分鐘最多三次，包含無效請求；前台所有 POST 前取得 antiforgery token。此限制是單一 API 程序內的 IP 限流，並非跨伺服器的每信箱配額。
- 從驗證信開啟時，信箱以 disabled 文字框顯示，重寄會附上原 token。修改網址 Email 不會獲得寄信授權。移除 token 改走一般申請時，必須提供該會員密碼。連結過期可用「重新申請驗證信」開啟獨立頁面，輸入 Email 與註冊密碼。
- API 密碼登入先驗證密碼並維持錯誤密碼鎖定；密碼正確但信箱未驗證時回傳 403，`code` 為 `email_verification_required`，不建立登入 cookie。
- 既有尚未驗證的密碼會員也須先驗證；可以從註冊頁前往重寄。登入首頁不顯示信箱驗證或重寄入口，只有登入被信箱驗證條件擋下時才顯示提示。已登入的既有 session 不會因本次變更自動撤銷。管理後台的獨立登入流程維持既有行為。
- 所有環境採相同第三方登入規則：首次外部身分若 Email 已有會員，就新增綁定並沿用原會員。一般密碼會員須先完成信箱驗證，並保留停權、鎖定與登入資格檢查；不使用展示模式開關。
- 已綁定第三方身分依 `Provider + ProviderKey` 登入原會員，仍受登入資格、停權與鎖定檢查。Email 無對應會員時沿用原本第三方新會員建立流程。完整的使用者主動綁定功能與第三方信箱可信性處理尚未提供。

信箱驗證證明收件者能存取信箱，並不代表每次登入都啟用雙因素驗證。

## 驗證

`dotnet run --project tools/AccountVerificationChecks/AccountVerificationChecks.csproj` 使用真正的 Identity token provider 測試成功驗證、重複確認、偽造 token、錯誤用途、security stamp 失效與寄信故障；不存取資料庫或寄真信。

在 `QMAH.Client` 執行 `node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/auth/verify-email/verify-email.spec.ts` 測試前台確認、重寄與失敗恢復。

正式寄信仍須以測試信箱確認 Brevo sender、API key 與部署前台網址，並實測「註冊 → 收信 → 確認 → 密碼登入」。
