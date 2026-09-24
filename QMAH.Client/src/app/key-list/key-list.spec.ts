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
    const catalogServiceStub = { getCategories: () => of([]), getEras: () => of([]) };

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

  it('只把持有中、且是兌換來源的鑰匙列進材料欄', () => {
    expect(component.craftSourceKeys().map((key) => key.code)).toEqual(['NORMAL_A', 'ERA_A']);
    expect(component.craftMaxSlots()).toBe(3);
  });

  it('可選的兌換目標會隨放入數量改變', () => {
    const normal = component.craftSourceKeys()[0];
    component.addToCraft(normal);
    expect(component.craftOptions().length).toBe(0);

    component.addToCraft(normal);
    component.addToCraft(normal);
    expect(component.craftOptions().map((rule) => rule.id)).toEqual(['r-era', 'r-uni']);
    expect(component.craftReadyRule()?.id).toBe('r-era');
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

  it('中央切換目標後，同樣的材料會兌換成不同鑰匙', () => {
    component.fillCraftWithRule(rules[0]);
    component.cycleCraftRule();
    expect(component.craftReadyRule()?.id).toBe('r-uni');

    component.craftOutput();
    expect(exchangedRuleIds).toEqual(['r-uni']);
    expect(component.craftSlots().length).toBe(0);
  });

  it('不能放入超過持有數量的鑰匙', () => {
    const era = component.craftSourceKeys()[1];
    component.addToCraft(era);
    component.addToCraft(era);
    component.addToCraft(era);
    expect(component.craftSlots().length).toBe(2);
    expect(component.craftRemaining(era)).toBe(0);
  });

  it('混放不同來源時不會出現成品', () => {
    const [normal, era] = component.craftSourceKeys();
    component.addToCraft(normal);
    component.addToCraft(era);
    component.addToCraft(normal);
    expect(component.craftMixed()).toBe(true);
    expect(component.craftReadyRule()).toBeNull();

    component.craftOutput();
    expect(exchangedRuleIds.length).toBe(0);
  });
});
