import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterSidebar } from './filter-sidebar';

describe('FilterSidebar sticky position', () => {
  let fixture: ComponentFixture<FilterSidebar>;
  let aside: HTMLElement;
  let height = 0;

  beforeEach(async () => {
    // jsdom 不做排版，offsetHeight 恆為 0；改成可由測試指定的側欄高度。
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(700);

    await TestBed.configureTestingModule({ imports: [FilterSidebar] }).compileComponents();
    fixture = TestBed.createComponent(FilterSidebar);
  });

  afterEach(() => vi.restoreAllMocks());

  /** 以目前的側欄高度建立元件、套用一次計算，回傳側欄內聯的 top */
  const stickyTop = async (sidebarHeight: number): Promise<string> => {
    height = sidebarHeight;
    fixture.detectChanges();
    await fixture.whenStable();
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    aside = fixture.nativeElement.querySelector('.filter-sidebar');
    return aside.style.top;
  };

  it('pins a short sidebar just below the page header', async () => {
    expect(await stickyTop(300)).toBe('92px');
  });

  it('lets a sidebar taller than the viewport scroll until its bottom is visible, then pins it', async () => {
    // 視窗 700、側欄 1080：top = 700 - 1080 - 16，捲到側欄底端離視窗底端 16px 時才固定。
    expect(await stickyTop(1080)).toBe('-396px');
  });

  it('keeps the header offset when the sidebar just fits below the header', async () => {
    // 700 - 16 - 92 = 592：剛好放得下時仍固定在頁首下方，不會多捲。
    expect(await stickyTop(592)).toBe('92px');
  });
});
