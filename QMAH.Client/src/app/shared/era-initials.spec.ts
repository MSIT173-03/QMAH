import { eraInitials } from './era-initials';

describe('eraInitials', () => {
  // 與 QMAH.Infrastructure/Infrastructure/CatalogImport/era-buckets.json 相同的 30 個年代
  const ERA_NAMES = [
    '商', '周', '春秋', '戰國', '秦', '漢', '三國', '南北朝', '隋', '唐', '五代十國', '遼', '宋', '西夏', '金', '元',
    '明', '清', '中華民國', '中華人民共和國', '日本明治時代', '日本大正時代', '日本昭和時代', '日本平成時代',
    '日本令和時代', '日本江戶時代', '新石器時代', '仰韶文化', '紅山文化', '良渚文化',
  ];

  it('字首不重複只取一個字', () => {
    const result = eraInitials(ERA_NAMES);
    expect(result.get('唐')).toBe('唐');
    expect(result.get('五代十國')).toBe('五');
    expect(result.get('新石器時代')).toBe('新');
  });

  it('字首重複時從第一個不重複的字開始取兩個字', () => {
    const result = eraInitials(ERA_NAMES);
    expect(result.get('日本大正時代')).toBe('大正');
    expect(result.get('日本江戶時代')).toBe('江戶');
    expect(result.get('日本明治時代')).toBe('明治');
    expect(result.get('日本昭和時代')).toBe('昭和');
    expect(result.get('日本平成時代')).toBe('平成');
    expect(result.get('日本令和時代')).toBe('令和');
    expect(result.get('中華民國')).toBe('民國');
    expect(result.get('中華人民共和國')).toBe('人民');
  });

  it('30 個年代的背景字全部不重複', () => {
    const values = [...eraInitials(ERA_NAMES).values()];
    expect(values.length).toBe(30);
    expect(new Set(values).size).toBe(30);
  });
});
