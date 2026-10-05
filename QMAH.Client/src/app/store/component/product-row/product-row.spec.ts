import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductRow } from './product-row';

describe('ProductRow', () => {
  let component: ProductRow;
  let fixture: ComponentFixture<ProductRow>;
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductRow] }).compileComponents();

    fixture = TestBed.createComponent(ProductRow);
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

  it('shows only the non-empty parts of the brand and category line', () => {
    fixture.componentRef.setInput('cat', '青銅器');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.meta-brand').textContent.trim()).toBe('青銅器');

    fixture.componentRef.setInput('brand', '故宮');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.meta-brand').textContent.trim()).toBe('故宮 · 青銅器');
  });

  it('scales the add-to-cart button up slightly and back when clicked, and still emits addToCart', () => {
    const added = vi.fn();
    component.addToCart.subscribe(added);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.product-row-buy');

    button.click();

    expect(added).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(button);
    const [keyframes] = animate.mock.calls[0];
    expect(keyframes.map((frame: Keyframe) => frame['transform'])).toEqual(['scale(1)', 'scale(1.05)', 'scale(1)']);
  });

  it('does not animate when the user prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    fixture.nativeElement.querySelector('.product-row-buy').click();

    expect(animate).not.toHaveBeenCalled();
  });
});
