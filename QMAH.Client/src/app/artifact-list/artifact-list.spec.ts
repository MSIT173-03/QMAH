import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import {
  ArtifactList,
  BOOK_LAYOUT,
  CatalogGroup,
  compareEraOrder,
  computeCatalogLayout,
  paginateCatalog,
} from './artifact-list';
import { CompendiumCardSummary } from '../models/artifact-unlock-model';

const makeItem = (id: string, eraName: string, categoryName: string, unlocked = false): CompendiumCardSummary => ({
  id,
  artifactRef: `REF-${id}`,
  name: `文物${id}`,
  categoryCode: categoryName,
  categoryName,
  eraCode: eraName,
  eraName,
  thumbnailPath: '',
  hasQuestionEntry: false,
  hasShopProduct: false,
  color: '#000',
  type: categoryName,
  rarity: '',
  habitat: '',
  desc: '',
  unlocked,
  unlockedAt: null,
});

const makeGroup = (key: string, count: number): CatalogGroup => ({
  key,
  label: key,
  items: Array.from({ length: count }, (_, i) => makeItem(`${key}-${i}`, key, '玉器')),
});

describe('ArtifactList', () => {
  let component: ArtifactList;
  let fixture: ComponentFixture<ArtifactList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtifactList],
      // integration: 元件使用 RouterLink／ActivatedRoute 與 HttpClient；測試補最小 provider，不改正式行為。
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArtifactList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('預設停在封面；點封面後進入翻開狀態', () => {
    expect(component.bookState()).toBe('closed');
    component.openBook();
    expect(['opening', 'open']).toContain(component.bookState());
  });

  it('切換頁籤時收合展開中的年代；闔上書本後切回圖鑑章節', () => {
    component.catalogModel.set([makeItem('1', '唐', '玉器'), makeItem('2', '清', '陶瓷')]);
    component.toggleGroupExpand(component.catalogGroups()[0]);
    component.setCatalogTab('ERA');
    expect(component.expandedGroupKey()).toBeNull();

    component.toggleGroupExpand(component.catalogGroups()[0]);
    component.setSection('keys');
    expect(component.expandedGroupKey()).toBeNull();

    // 略過闔書動畫，直接檢查闔上後的狀態
    (component as any).prefersReducedMotion = () => true;
    component.bookState.set('open');
    component.closeBook();
    expect(component.bookState()).toBe('closed');
    expect(component.bookSection()).toBe('catalog');
  });

  it('年代依起始年由遠到近排列，沒有年代資料的排最後', () => {
    component.catalogModel.set([
      makeItem('1', '清', '玉器'),
      makeItem('2', '唐', '陶瓷'),
      makeItem('3', '新石器時代', '玉器'),
      makeItem('4', '未知', '玉器'),
    ]);
    (component as any).eraOrder.set(new Map([
      ['清', { start: 1644, end: 1912 }],
      ['唐', { start: 618, end: 907 }],
      ['新石器時代', { start: -7000, end: -2000 }],
    ]));
    expect(component.catalogGroups().map((g) => g.label)).toEqual(['新石器時代', '唐', '清', '未知']);
    expect(component.eraOptions()).toEqual(['新石器時代', '唐', '清', '未知']);
  });

  it('分類／年代頁籤只叫出篩選單，兩邊的勾選同時生效；切回全部自動清除', () => {
    component.catalogModel.set([
      makeItem('1', '唐', '玉器'),
      makeItem('2', '清', '陶瓷'),
      makeItem('3', '清', '玉器'),
    ]);

    component.setCatalogTab('ERA');
    expect(component.filterPanelOpen()).toBe(true);
    component.toggleEraFilter('清');
    expect(component.filteredItems().map((i) => i.id)).toEqual(['2', '3']);

    component.setCatalogTab('CATEGORY');
    component.toggleCategoryFilter('玉器');
    expect(component.filteredItems().map((i) => i.id)).toEqual(['3']);
    expect(component.selectedFilterCount('ERA')).toBe(1);
    expect(component.selectedFilterCount('CATEGORY')).toBe(1);

    component.setCatalogTab('CATEGORY'); // 再點一次只收起篩選單
    expect(component.filterPanelOpen()).toBe(false);
    expect(component.filteredItems().length).toBe(1);

    component.setCatalogTab('ALL');
    expect(component.selectedEras().size).toBe(0);
    expect(component.selectedCategories().size).toBe(0);
    expect(component.filteredItems().length).toBe(3);
  });

  it('篩選單開著時文物從右頁開始，收起後回到左頁', () => {
    component.catalogModel.set([makeItem('1', '唐', '玉器'), makeItem('2', '清', '陶瓷')]);
    component.pageBox.set({ w: 500, h: 420 });

    component.setCatalogTab('ERA');
    expect(component.leftPage()).toBeNull();
    expect(component.rightPage()).not.toBeNull();
    expect(component.rightPageNumber()).toBe(1);

    component.closeFilterPanel();
    expect(component.leftPage()).not.toBeNull();
    expect(component.leftPageNumber()).toBe(1);
  });

  it('展開一個年代時隱藏其他年代並從第一頁開始；收合後恢復', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeItem(`${i}`, `年代${i % 6}`, '玉器'));
    component.catalogModel.set(items);
    component.pageBox.set({ w: 500, h: 420 });
    const groups = component.catalogGroups();
    expect(groups.length).toBe(6);

    component.spread.set(1);
    component.toggleGroupExpand(groups[4]);
    expect(component.catalogGroups().map((g) => g.key)).toEqual([groups[4].key]);
    expect(component.currentSpread()).toBe(0);

    component.toggleGroupExpand(groups[4]);
    expect(component.catalogGroups().length).toBe(6);
  });

  it('跨頁時只有左頁補年代標題，右頁只留分隔線', () => {
    const items = Array.from({ length: 80 }, (_, i) => makeItem(`${i}`, '清', '玉器'));
    component.catalogModel.set(items);
    component.pageBox.set({ w: 500, h: 420 });
    component.toggleGroupExpand(component.catalogGroups()[0]);

    const pages = component.pages();
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((page, index) => {
      expect(page.lines[0].kind).toBe(index % 2 === 0 ? 'header' : 'divider');
    });
  });

  it('展開／收合文字與預覽數量跟著一列的欄數', () => {
    component.pageBox.set({ w: 500, h: 420 });
    expect(component.previewCount()).toBe(computeCatalogLayout(500, 420)!.cols);
  });
});

describe('書頁分頁計算', () => {
  const layout = computeCatalogLayout(500, 520)!;

  it('依寬度算出欄數，至少兩欄', () => {
    expect(layout.cols).toBe(5);
    expect(computeCatalogLayout(120, 300)!.cols).toBe(2);
    expect(computeCatalogLayout(0, 300)).toBeNull();
  });

  it('收合時每個分區只放一列', () => {
    const pages = paginateCatalog([makeGroup('清', 40), makeGroup('明', 9)], layout, () => false);
    const rows = pages.flatMap((p) => p.lines).filter((l) => l.kind === 'row');
    expect(rows.length).toBe(2);
  });

  it('每頁都不超過內容高度、標題不會落單在頁尾、跨頁補「續」標題', () => {
    const groups = [makeGroup('清', 40), makeGroup('明', 9), makeGroup('宋', 3)];
    const pages = paginateCatalog(groups, layout, () => true);

    for (const page of pages) {
      const height = page.lines.reduce((sum, l) => sum + (l.kind === 'header' ? BOOK_LAYOUT.headerH : layout.rowH), 0);
      expect(height).toBeLessThanOrEqual(layout.bodyH);
      expect(page.lines[page.lines.length - 1].kind).toBe('row');
    }

    const continued = pages.flatMap((p) => p.lines).filter((l) => l.kind === 'header' && l.continued);
    expect(continued.length).toBeGreaterThan(0);

    const ids = pages.flatMap((p) => p.lines.flatMap((l) => (l.kind === 'row' ? l.items.map((i) => i.id) : [])));
    expect(ids.length).toBe(52);
    expect(new Set(ids).size).toBe(52);
  });

  it('showContinuedHeader 為 false 的頁面改放分隔線', () => {
    const pages = paginateCatalog([makeGroup('清', 40)], layout, () => true, (i) => i % 2 === 0);
    expect(pages[1].lines[0].kind).toBe('divider');
    expect(pages[2].lines[0].kind).toBe('header');
  });

  it('compareEraOrder：西元前排在前面', () => {
    const order = new Map([['周', { start: -1046, end: -256 }], ['漢', { start: -202, end: 220 }]]);
    expect(['漢', '周', '不明'].sort((a, b) => compareEraOrder(a, b, order))).toEqual(['周', '漢', '不明']);
  });

  it('頁面高度比一列還小時也不會無限迴圈', () => {
    const tiny = computeCatalogLayout(150, 40)!;
    expect(paginateCatalog([makeGroup('清', 6)], tiny, () => true).length).toBeGreaterThan(0);
  });
});
