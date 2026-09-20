import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type LegalDocument = 'privacy' | 'terms';

interface LegalSection {
  title: string;
  paragraphs: readonly string[];
}

interface LegalDocumentContent {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}

const DOCUMENTS: Record<LegalDocument, LegalDocumentContent> = {
  privacy: {
    eyebrow: '清明鑑定屋・使用說明',
    title: '隱私權政策',
    intro: '本頁說明清明鑑定屋展示網站如何處理登入、圖鑑、遊戲與商城流程中產生的資料。這是專題展示版本，實際上線前仍應由維護團隊依部署環境完成法務審閱。',
    sections: [
      {
        title: '一、我們會處理哪些資料',
        paragraphs: [
          '當你登入或註冊時，系統會處理帳號所需的電子郵件、顯示名稱與登入狀態。使用圖鑑、遊戲、社群或商城時，系統也可能保存該功能需要的進度、貼文、留言、購物車與訂單資料。',
          '網站會使用必要的瀏覽器儲存空間記住介面偏好，例如行動版選單狀態、公告收合狀態與遊戲展示模式設定。這些設定用來維持操作體驗，不會被用來推測你的身分。',
        ],
      },
      {
        title: '二、資料如何使用',
        paragraphs: [
          '資料只用於提供會員登入、圖鑑解鎖、遊戲配對、社群互動、購物車與訂單流程，以及處理必要的安全與錯誤紀錄。除非法律要求或你主動使用外部連結，網站不會把資料拿去做與上述功能無關的行銷用途。',
        ],
      },
      {
        title: '三、外部服務與公開內容',
        paragraphs: [
          '部分文物來源會連到國立故宮博物院等原始資料頁；聯絡入口則連到 MSIT173-03 的 GitHub 頁面。離開清明鑑定屋後，資料如何處理會依該外部服務自己的政策為準。',
          '你在社群公開發表的內容，會依產品功能顯示給其他使用者。請不要在貼文、留言或個人名稱中放入不必要的私人資料。',
        ],
      },
      {
        title: '四、資料保存與你的選擇',
        paragraphs: [
          '資料保存時間會依功能需要與目前的展示環境設定而定。若你要更正、移除或了解自己的資料，請透過頁尾「聯絡我們」前往專案 GitHub 組織頁提出需求；本展示版本不承諾即時或自動化處理。',
        ],
      },
    ],
  },
  terms: {
    eyebrow: '清明鑑定屋・使用說明',
    title: '服務條款',
    intro: '歡迎使用清明鑑定屋。使用本展示網站前，請先了解以下使用範圍；本頁是專題展示版本的通用條款，不取代正式商業服務上線時應完成的合約與法務文件。',
    sections: [
      {
        title: '一、服務範圍',
        paragraphs: [
          '清明鑑定屋提供文物資料瀏覽、圖鑑解鎖、互動遊戲、社群交流與商城介面示範。頁面上的商品、價格、庫存、優惠與訂單流程，只有在後端正式啟用並由維護團隊公告時，才代表可成立的實際交易。',
        ],
      },
      {
        title: '二、帳號與使用行為',
        paragraphs: [
          '你應以真實且不冒用他人的資訊使用帳號，並自行保管登入憑證。不得以自動化方式干擾服務、繞過權限、偽造遊戲或商城資料，或發布侵害他人權利、違法或明顯與社群主題無關的內容。',
        ],
      },
      {
        title: '三、文物資料與外部來源',
        paragraphs: [
          '文物名稱、影像、年代與來源說明以頁面標示及其原始來源為準；清明鑑定屋不把展示介面視為文物真偽鑑定或專業鑑價意見。使用外部資料時，請遵守原始來源標示的授權與使用條件。',
        ],
      },
      {
        title: '四、商城展示與異動',
        paragraphs: [
          '商城的商品資訊、特價、庫存與配送條件可能因資料更新而變動。若未完成正式付款、出貨或訂單確認，畫面上的展示內容不代表已接受訂單或保證供貨。',
          '我們會盡力維持資料正確與服務穩定，但展示網站可能因維護、測試或服務異常暫停部分功能。',
        ],
      },
      {
        title: '五、條款更新',
        paragraphs: [
          '當功能或部署環境有重大變更時，我們會更新本頁的內容與日期。繼續使用網站，即表示你接受更新後、適用於展示環境的使用規則。',
        ],
      },
    ],
  },
};

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.scss',
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly content = computed(() => {
    const kind = this.route.snapshot.data['document'] as LegalDocument;
    return DOCUMENTS[kind] ?? DOCUMENTS.privacy;
  });
  protected readonly updatedAt = '2026 年 9 月 20 日';
}
