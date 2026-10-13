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
    title: '週末看展的三個小發現',
    content:
      '[size=large][b]週末看展的三個小發現[/b][/size]\n' +
      '走了一趟特展，把當天的筆記整理成幾點，歡迎補充，也歡迎指正。\n\n' +
      '[h]我的三個重點[/h]\n' +
      '[list]\n' +
      '[*][b]先看整體，再看細節[/b]：退後一步看器形，再靠近看[color=red]紋飾與接合處[/color]\n' +
      '[*][i]對照資料[/i]：用[u]說明牌與圖鑑[/u]互相印證，結論比較可靠\n' +
      '[*][color=blue]當場記下來[/color]：回家再查，常會發現漏看的地方\n' +
      '[/list]\n' +
      '[quote]慢慢看，通常比快快看更有收穫。[/quote]\n' +
      '[hr]\n' +
      '[center][b]你最近看到什麼有趣的細節？[/b][/center]\n\n' +
      '留言聊聊吧，也歡迎指出我看錯的地方。\n\n' +
      '[size=small][color=gray]最後的小結論放在下面，點一下才會顯示。[/color][/size]\n' +
      '[spoiler]其實這次最大的收穫，是學會把「看到的」和「推測的」分開記。[/spoiler]',
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
    title: '週末交流聚會：一起聊聊、互相分享',
    content:
      '[size=large][b]歡迎來和大家聊聊[/b][/size]最近的收穫與想法，也可以只是來聽聽看。\n\n' +
      '[h]活動重點[/h]\n' +
      '[list]\n' +
      '[*][b]免費參加[/b]，不收任何費用\n' +
      '[*]名額有限，[color=red]額滿為止[/color]\n' +
      '[*]可自由[u]分享[/u]或只是[i]旁聽[/i]\n' +
      '[/list]\n' +
      '[quote]一個人的發現，加上大家的補充，才會更完整。[/quote]',
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
  '感謝分享，很有參考價值！',
  '說得很清楚，學到不少。',
  '期待後續更新，也歡迎大家一起交流。'
];
let demoCommentIndex = 0;

export function demoComment(): string {
  return DEMO_COMMENTS[demoCommentIndex++ % DEMO_COMMENTS.length];
}
