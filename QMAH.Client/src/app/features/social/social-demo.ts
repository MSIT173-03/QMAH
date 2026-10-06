import { Me } from '../../core/services/me-api';
import { CreateSocialEventRequest, CreateSocialPostRequest } from '../../core/services/social-api';

// 示範用預填內容：只有管理員帳號開啟「發布貼文／建立活動／留言」時才會自動帶入，
// 一般會員看到的仍是空白表單。這只是操作上的便利，真正的權限仍由 API 把關。
export function isDemoAdmin(me: Me | null): boolean {
  return !!me?.roles?.includes('Admin');
}

export function demoPost(): CreateSocialPostRequest {
  return {
    postType: 'POST',
    boardCode: 'GENERAL',
    title: '週末在博物館看到一件很特別的青銅爵',
    content:
      '這個週末去了一趟博物館，在商周展區看到一件青銅爵，器身的饕餮紋非常細緻。\n' +
      '想請教大家：有沒有人知道這類器物的鑑定重點？我目前只注意到銹色與鑄痕，歡迎補充！',
    mediaIds: []
  };
}

// datetime-local 需要 yyyy-MM-ddTHH:mm（本地時間）。
function localInput(daysFromNow: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 示範用名額：設成「測試帳號數量 + 1」，用測試帳號各報名一次後，最後一個名額留給報告時現場按「報名參加」，按下去就額滿。
// 目前設 6：先用 5 個測試帳號報名，名單才看得出來；想換人數只改這個數字。
const DEMO_EVENT_CAPACITY = 6;

export function demoEvent(): CreateSocialEventRequest {
  return {
    eventType: 'PLAYER',
    title: '週末館藏交流：一起看古物的細節',
    content:
      '帶著你最近入手或最想請教的古物來聊聊吧！現場分組交流鑑定心得，也歡迎只來看、不帶東西。\n' +
      '活動不收費，名額有限，額滿為止。',
    location: '臺北市信義區市府路45號',
    latitude: 25.033964,
    longitude: 121.564468,
    startAt: localInput(7, 14),
    endAt: localInput(7, 17),
    registrationEndAt: localInput(5, 18),
    capacity: DEMO_EVENT_CAPACITY,
    mediaIds: []
  };
}

const DEMO_COMMENTS = [
  '感謝分享！這件看起來保存得很好，紋飾的層次很清楚。',
  '我之前也看過類似的器物，建議可以留意底部的鑄造痕跡。',
  '很有參考價值，下次展覽我也想去看看。'
];
let demoCommentIndex = 0;

export function demoComment(): string {
  return DEMO_COMMENTS[demoCommentIndex++ % DEMO_COMMENTS.length];
}
