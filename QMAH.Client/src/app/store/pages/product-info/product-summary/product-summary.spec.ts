import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductSummary } from './product-summary';

describe('ProductSummary', () => {
  let component: ProductSummary;
  let fixture: ComponentFixture<ProductSummary>;
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductSummary] }).compileComponents();

    fixture = TestBed.createComponent(ProductSummary);
    component = fixture.componentInstance;
    // jsdom 沒有 Web Animations API；補上可觀察的 animate。
    animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    fixture.detectChanges();
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    delete (window as Partial<Window>).matchMedia;
  });

  const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('.product-actions button.btn-outline, .product-actions button.btn-solid'));

  it('scales the add-to-cart button up slightly and back when clicked, and emits the chosen quantity', () => {
    const added = vi.fn();
    component.addToCart.subscribe(added);
    const addButton = buttons().find((button) => button.textContent?.trim() === '加入購物車')!;

    addButton.click();

    expect(added).toHaveBeenCalledWith(1);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(addButton);
    const [keyframes] = animate.mock.calls[0];
    expect(keyframes.map((frame: Keyframe) => frame['transform'])).toEqual(['scale(1)', 'scale(1.1)', 'scale(1)']);
  });

  it('does not animate the "add and view cart" button', () => {
    const buyNow = vi.fn();
    component.buyNow.subscribe(buyNow);

    buttons().find((button) => button.textContent?.trim() === '加入並查看購物車')!.click();

    expect(buyNow).toHaveBeenCalledWith(1);
    expect(animate).not.toHaveBeenCalled();
  });
});
