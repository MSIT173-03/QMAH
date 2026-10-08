import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ProductDetail } from '../../api/api.models';
import { ProductViewData } from '../../shared/product-view';
import { ProductPreviewList } from './product-preview-list';

function product(id: string, overrides: Partial<ProductViewData> = {}): ProductViewData {
  return {
    id,
    cat: '茶器',
    brand: '故宮',
    name: `商品 ${id}`,
    price: 1000,
    was: null,
    rating: 4.5,
    reviews: 12,
    sold: 30,
    coverImage: `/media/${id}/thumbnail.jpg`,
    ...overrides,
  };
}

describe('ProductPreviewList', () => {
  let fixture: ComponentFixture<ProductPreviewList>;
  let element: HTMLElement;

  const rows = () => Array.from(element.querySelectorAll<HTMLElement>('.preview-row'));
  const paneTitle = () => element.querySelector('.preview-pane-title')?.textContent?.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductPreviewList], providers: [provideRouter([])] }).compileComponents();

    fixture = TestBed.createComponent(ProductPreviewList);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('items', [product('a'), product('b'), product('c')]);
    fixture.detectChanges();
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });

  it('previews the first product until another one is picked', () => {
    expect(paneTitle()).toBe('商品 a');
    expect(rows().map((row) => row.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(rows().map((row) => row.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('reports the previewed product, starting with the first one', () => {
    const picked = vi.fn();
    fixture.componentInstance.selectionChange.subscribe(picked);

    rows()[1].click();
    fixture.detectChanges();

    expect(picked).toHaveBeenCalledWith('b');
  });

  it('shows a loading placeholder until the detail of the previewed product arrives', () => {
    expect(element.querySelectorAll('.preview-pane-desc .preview-skeleton-bar')).toHaveLength(3);

    fixture.componentRef.setInput('details', { a: { id: 'a', artifactDescription: '說明 a', dimensions: '尺寸 a' } as ProductDetail });
    fixture.detectChanges();
    expect(element.querySelector('.preview-skeleton-bar')).toBeNull();
    expect(element.querySelector('.preview-pane-desc')?.textContent).toBe('說明 a');
    expect(element.querySelector('.preview-spec dd')?.textContent).toBe('尺寸 a');

    rows()[1].click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.preview-pane-desc .preview-skeleton-bar')).toHaveLength(3);

    // 回到已查過的商品：直接顯示，不再出現讀取中的佔位條
    rows()[0].click();
    fixture.detectChanges();
    expect(element.querySelector('.preview-skeleton-bar')).toBeNull();
    expect(element.querySelector('.preview-pane-desc')?.textContent).toBe('說明 a');
  });

  it('keeps the description space empty, without a placeholder, when the detail failed to load', () => {
    fixture.componentRef.setInput('details', { a: null });
    fixture.detectChanges();

    expect(element.querySelector('.preview-pane-desc')).not.toBeNull();
    expect(element.querySelector('.preview-skeleton-bar')).toBeNull();
  });

  it('loads the display image of the previewed product', () => {
    expect(element.querySelector('.preview-pane-cover img')?.getAttribute('src')).toBe('/media/a/display.jpg');
  });

  it('falls back to the thumbnail, then to the placeholder, when the preview image fails', () => {
    element.querySelector('.preview-pane-cover img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('.preview-pane-cover img')?.getAttribute('src')).toBe('/media/a/thumbnail.jpg');

    element.querySelector('.preview-pane-cover img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('.preview-pane-cover img')).toBeNull();
    expect(element.querySelector('.preview-pane-slot')).not.toBeNull();
  });

  it('previews the product under the pointer', () => {
    rows()[1].dispatchEvent(new Event('mousemove'));
    fixture.detectChanges();

    expect(paneTitle()).toBe('商品 b');
    expect(rows()[1].classList).toContain('preview-row--selected');
  });

  it('pins the preview on a clicked row until another row or the pinned row is clicked', () => {
    const hover = (index: number) => {
      rows()[index].dispatchEvent(new Event('mousemove'));
      fixture.detectChanges();
    };
    const click = (index: number) => {
      rows()[index].click();
      fixture.detectChanges();
    };

    click(1);
    hover(2);
    expect(paneTitle()).toBe('商品 b');
    expect(rows()[1].classList).toContain('preview-row--pinned');

    // 點擊其他列：改固定那一件
    click(2);
    hover(0);
    expect(paneTitle()).toBe('商品 c');
    expect(rows()[1].classList).not.toContain('preview-row--pinned');

    // 再點一次固定中的列：取消固定，預覽恢復跟著滑鼠切換
    click(2);
    expect(element.querySelector('.preview-row--pinned')).toBeNull();
    hover(0);
    expect(paneTitle()).toBe('商品 a');
  });

  it('releases the pin when the list is replaced', () => {
    rows()[1].click();
    fixture.componentRef.setInput('items', [product('x'), product('y')]);
    fixture.detectChanges();

    rows()[1].dispatchEvent(new Event('mousemove'));
    fixture.detectChanges();

    expect(paneTitle()).toBe('商品 y');
  });

  it('moves the selection and the focus with the arrow, Home and End keys', () => {
    const press = (index: number, key: string) => {
      rows()[index].dispatchEvent(new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();
    };

    press(0, 'ArrowDown');
    expect(paneTitle()).toBe('商品 b');
    expect(document.activeElement).toBe(rows()[1]);

    press(1, 'End');
    expect(paneTitle()).toBe('商品 c');
    press(2, 'ArrowDown');
    expect(paneTitle()).toBe('商品 c');
    press(2, 'Home');
    expect(paneTitle()).toBe('商品 a');
  });

  it('opens the product page on Enter', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    rows()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(navigate).toHaveBeenCalledWith('/store/product/c');
  });

  it('emits the previewed product id when adding to the cart', () => {
    HTMLElement.prototype.animate = vi.fn() as unknown as HTMLElement['animate'];
    const added = vi.fn();
    fixture.componentInstance.addToCart.subscribe(added);
    rows()[2].click();
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.preview-pane-buy')!.click();

    expect(added).toHaveBeenCalledWith('c');
  });

  it('goes back to the first product when the list is replaced', () => {
    rows()[2].click();
    fixture.detectChanges();

    fixture.componentRef.setInput('items', [product('x'), product('y')]);
    fixture.detectChanges();

    expect(paneTitle()).toBe('商品 x');
  });

  it('shows no preview pane for an empty list', () => {
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();

    expect(element.querySelector('.preview-pane')).toBeNull();
  });
});
