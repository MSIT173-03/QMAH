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
    title: '分享今天的一點心得',
    content:
      '[size=large][b]大家好[/b][/size]，想跟大家分享最近的一點心得與觀察。\n\n' +
      '[h]今天的三個重點[/h]\n' +
      '[list]\n' +
      '[*][b]觀察細節[/b]：多看一眼，常會發現[color=red]意想不到[/color]的線索\n' +
      '[*][i]對照資料[/i]：用[u]不同來源[/u]互相印證，結論更可靠\n' +
      '[*][color=blue]記錄下來[/color]：寫成筆記，日後回頭看更有收穫\n' +
      '[/list]\n' +
      '[quote]好的觀察，從放慢腳步開始。[/quote]\n' +
      '[hr]\n' +
      '[center][color=gold][b]也想聽聽你們的看法[/b][/color][/center]\n' +
      '歡迎留言交流、互相補充！[s]不用客氣[/s]\n\n' +
      '[size=small][color=gray]小提醒：下面是劇透內容，點一下才會顯示[/color][/size]\n' +
      '[spoiler]其實我最大的收穫是：慢慢看，比快快看更有趣。[/spoiler]',
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
