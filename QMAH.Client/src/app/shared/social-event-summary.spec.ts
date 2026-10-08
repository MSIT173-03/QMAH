import { parseSocialEventSummary } from './social-event-summary';

describe('parseSocialEventSummary', () => {
  const facts = '活動資訊\n時間：2026/10/13 14:00 至 2026/10/13 17:00\n地點：臺北市信義區市府路45號\n限額：6 人';

  it('separates generated facts from the original formatted description', () => {
    expect(parseSocialEventSummary('[b]一起看古物[/b]\n\n' + facts)).toEqual({
      description: '[b]一起看古物[/b]', start: '2026/10/13 14:00', end: '2026/10/13 17:00',
      location: '臺北市信義區市府路45號', capacity: '6 人',
    });
  });

  it('recognizes flattened previews and unlimited capacity', () => {
    expect(parseSocialEventSummary(('歡迎參加\n\n' + facts).replace(/\n/g, ' ').replace('6 人', '不限人數'))?.capacity).toBe('不限人數');
  });

  it('leaves truncated and custom activity text untouched', () => {
    expect(parseSocialEventSummary('歡迎參加 ' + facts.slice(0, -3) + '…')).toBeNull();
    expect(parseSocialEventSummary('活動資訊：下週見，詳細時間另行通知')).toBeNull();
    expect(parseSocialEventSummary(facts + '\n其他注意事項')).toBeNull();
  });
});
