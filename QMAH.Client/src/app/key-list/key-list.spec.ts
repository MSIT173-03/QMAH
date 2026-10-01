import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { KeyList } from './key-list';
import { KeyService } from '../services/key-service';
import { CatalogService } from '../services/catalog-service';
import { KeyExchangeRule, KeyModel } from '../models/key-model';

const makeKey = (code: string, balance: number, scopeType: KeyModel['scopeType'] = 'NORMAL'): KeyModel => ({
  id: `id-${code}`,
  code,
  name: `${code} 鑰匙`,
  scopeType,
  categoryId: null,
  eraBucketId: null,
  balance,
  eligibleArtifactCount: 3,
  recyclePointValue: 1,
});

const makeRule = (id: string, source: string, sourceAmount: number, target: string): KeyExchangeRule => ({
  id,
  sourceKeyCode: source,
  sourceKeyName: `${source} 鑰匙`,
  sourceAmount,
  targetKeyCode: target,
  targetKeyName: `${target} 鑰匙`,
  targetAmount: 1,
  targetEligibleArtifactCount: 5,
  description: null,
});

describe('KeyList', () => {
  let component: KeyList;
  let fixture: ComponentFixture<KeyList>;
  let exchangedRuleIds: string[];

  const keys = [makeKey('NORMAL_A', 5), makeKey('ERA_A', 2, 'ERA'), makeKey('UNI', 0, 'UNIVERSAL')];
  const rules = [
    makeRule('r-era', 'NORMAL_A', 3, 'ERA_A'),
    makeRule('r-uni', 'NORMAL_A', 3, 'UNI'),
    makeRule('r-era-uni', 'ERA_A', 2, 'UNI'),
  ];

  beforeEach(async () => {
    exchangedRuleIds = [];

    const keyServiceStub = {
      getKeys: () => of(keys),
      getExchangeRules: () => of(rules),
      exchangeKeys: (ruleId: string) => {
        exchangedRuleIds.push(ruleId);
        const rule = rules.find((item) => item.id === ruleId)!;
        return of({
          ruleId,
          sourceKeyCode: rule.sourceKeyCode,
          sourceAmount: rule.sourceAmount,
          targetKeyCode: rule.targetKeyCode,
          targetAmount: rule.targetAmount,
          targetEligibleArtifactCount: rule.targetEligibleArtifactCount,
        });
      },
      unlockWithKey: () => of({ unlocked: false, artifactId: null, artifactName: null, remainingEligibleArtifactCount: 0, message: null }),
    };
    const catalogServiceStub = {
      getCategories: () => of([
        ['BRONZE', '銅器'], ['CARVING', '雕刻'], ['CERAMIC', '陶瓷'], ['COIN', '錢幣'],
        ['ENAMEL', '琺瑯器'], ['JADE', '玉器'], ['LACQUER', '漆器'], ['PAINTING', '繪畫'],
      ].map(([code, name]) => ({ id: `category-${code}`, code, name }))),
      getEras: () => of([]),
    };

    await TestBed.configureTestingModule({
      imports: [KeyList],
      providers: [
        provideRouter([]),
        { provide: KeyService, useValue: keyServiceStub },
        { provide: CatalogService, useValue: catalogServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('以分類 ID 查詢 API 代碼，背包與合成台共用八種材質圖示', () => {
    const codes = ['BRONZE', 'CARVING', 'CERAMIC', 'COIN', 'ENAMEL', 'JADE', 'LACQUER', 'PAINTING'];
    const categoryKeys = codes.map((code, index) => ({
      ...makeKey(`opaque-key-${index}`, 1, 'CATEGORY'),
      categoryId: `category-${code}`,
      name: '分類鑰匙',
    }));
    component.keys.set(categoryKeys);
    for (const [index, key] of categoryKeys.entries()) {
      const expected = `/assets/catalog/keys/category-${codes[index].toLowerCase()}.png`;
      expect(component.keySlotIcon(key)).toBe(expected);
      expect(component.keyIconByCode(key.code)).toBe(expected);
    }
    expect(component.keySlotIcon({ ...makeKey('unknown', 1, 'CATEGORY'), name: '繪畫鑰匙' }))
      .toBe('/assets/catalog/keys/category-painting.png');
    expect(component.keySlotIcon({ ...makeKey('unknown', 1, 'CATEGORY'), name: '銅器鑰匙' }))
      .toBe('/assets/catalog/keys/category-bronze.png');
  });

  it('只把持有中、且是兌換來源的鑰匙列進材料欄', () => {
    expect(component.craftSourceKeys().map((key) => key.code)).toEqual(['NORMAL_A', 'ERA_A']);
    expect(component.craftMaxSlots()).toBe(3);
  });

  it('兌換選項依放入的鑰匙決定，不會列出其他來源的規則', () => {
    const [normal, era] = component.craftSourceKeys();
    component.addToCraft(normal);
    expect(component.craftOptions().length).toBe(0);
    expect(component.craftHint()).toContain('再放入 2 把');

    component.addToCraft(normal);
    component.addToCraft(normal);
    expect(component.craftOptions().map((rule) => rule.id)).toEqual(['r-era', 'r-uni']);
    expect(component.craftReadyRule()?.id).toBe('r-era');

    component.clearCraft();
    component.addToCraft(era);
    component.addToCraft(era);
    expect(component.craftOptions().map((rule) => rule.id)).toEqual(['r-era-uni']);
  });

  it('多邊形格數等於放入數量，三格時頂點朝上', () => {
    const normal = component.craftSourceKeys()[0];
    component.addToCraft(normal);
    component.addToCraft(normal);
    component.addToCraft(normal);
    const points = component.craftSlotPositions();
    expect(points.length).toBe(3);
    expect(points[0].x).toBeCloseTo(50);
    expect(points[0].y).toBeLessThan(50);
  });

  it('點中央開啟選單，選擇後兌換成選到的鑰匙', () => {
    const normal = component.craftSourceKeys()[0];
    [0, 1, 2].forEach(() => component.addToCraft(normal));

    component.toggleCraftMenu();
    expect(component.craftMenuOpen()).toBe(true);

    component.selectCraftRule(rules[1]);
    expect(component.craftMenuOpen()).toBe(false);
    expect(component.craftReadyRule()?.id).toBe('r-uni');

    component.craftOutput();
    expect(exchangedRuleIds).toEqual(['r-uni']);
    expect(component.craftSlots().length).toBe(0);
  });

  it('只有一個選項時中央不開選單；放入的鑰匙改變後選單自動收起', () => {
    const [normal, era] = component.craftSourceKeys();
    component.addToCraft(era);
    component.addToCraft(era);
    component.toggleCraftMenu();
    expect(component.craftMenuOpen()).toBe(false);

    component.clearCraft();
    [0, 1, 2].forEach(() => component.addToCraft(normal));
    component.toggleCraftMenu();
    component.removeFromCraft(0);
    expect(component.craftMenuOpen()).toBe(false);
  });

  it('不能放入超過持有數量的鑰匙', () => {
    const era = component.craftSourceKeys()[1];
    component.addToCraft(era);
    component.addToCraft(era);
    component.addToCraft(era);
    expect(component.craftSlots().length).toBe(2);
    expect(component.craftRemaining(era)).toBe(0);
  });

  it('混放不同來源時沒有選項也不會出現成品', () => {
    const [normal, era] = component.craftSourceKeys();
    component.addToCraft(normal);
    component.addToCraft(era);
    component.addToCraft(normal);
    expect(component.craftMixed()).toBe(true);
    expect(component.craftOptions().length).toBe(0);
    expect(component.craftReadyRule()).toBeNull();

    component.craftOutput();
    expect(exchangedRuleIds.length).toBe(0);
  });

  it('尚未放入鑰匙時，引導文字顯示在左側放入區下方，右側不重複顯示', () => {
    expect(component.craftMenuHint()).toBe('從上方點選或拖曳鑰匙放入合成台');
    expect(component.craftHint()).toBe('');
  });

  it('提示拆成左右兩段：左側提示可選數量，右側說明幾把換幾把', () => {
    const [normal, era] = component.craftSourceKeys();
    [0, 1, 2].forEach(() => component.addToCraft(normal));
    expect(component.craftMenuHint()).toBe('點中央可從 2 種中選擇');
    expect(component.craftHint()).toBe('點擊成品兌換 1 組');
    expect(component.craftHintDetail()).toBe('3 把NORMAL_A 鑰匙兌換 1 把ERA_A 鑰匙');

    component.clearCraft();
    component.addToCraft(era);
    component.addToCraft(era);
    expect(component.craftMenuHint()).toBe('');

    component.removeFromCraft(0);
    expect(component.craftHintDetail()).toBe('');
  });

  it('放入格與中央格同尺寸，格子變多時縮小但整圈仍留在合成台內', () => {
    const normal = component.craftSourceKeys()[0];
    component.addToCraft(normal);
    const size = component.craftSlotSize();
    expect(size).toBeCloseTo(20);
    const [top] = component.craftSlotPositions();
    expect(50 - top.y).toBeGreaterThan(size * 1.5); // 中央與四周拉開間距
    component.addToCraft(normal);
    component.addToCraft(normal);
    component.craftSlotPositions().forEach((point) => {
      expect(point.x - size / 2).toBeGreaterThanOrEqual(0);
      expect(point.y - size / 2).toBeGreaterThanOrEqual(0);
    });
  });

  it('背包格的操作提示會區分萬能鑰匙', () => {
    expect(component.bagTipHint(keys[0])).toBe('點擊使用');
    expect(component.bagTipHint(keys[2])).toBe('請至圖鑑頁的文物卡片上使用');
  });
});
