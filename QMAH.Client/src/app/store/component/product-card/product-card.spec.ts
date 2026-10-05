import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCard } from './product-card';

describe('ProductCard', () => {
  let component: ProductCard;
  let fixture: ComponentFixture<ProductCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('add-to-cart animation', () => {
    let animate: ReturnType<typeof vi.fn>;
    let button: HTMLButtonElement;

    beforeEach(() => {
      // jsdom 沒有 Web Animations API；補上可觀察的 animate。
      animate = vi.fn();
      HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
      fixture.detectChanges();
      button = fixture.nativeElement.querySelector('.product-card-buy');
    });

    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
      delete (window as Partial<Window>).matchMedia;
    });

    it('scales the button up slightly and back when clicked, and still emits addToCart', () => {
      const added = vi.fn();
      component.addToCart.subscribe(added);

      button.click();

      expect(added).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.contexts[0]).toBe(button);
      const [keyframes] = animate.mock.calls[0];
      expect(keyframes.map((frame: Keyframe) => frame['transform'])).toEqual(['scale(1)', 'scale(1.05)', 'scale(1)']);
    });

    it('replays the animation on every click', () => {
      button.click();
      button.click();

      expect(animate).toHaveBeenCalledTimes(2);
    });

    it('does not animate when the user prefers reduced motion, but still emits addToCart', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
      const added = vi.fn();
      component.addToCart.subscribe(added);

      button.click();

      expect(added).toHaveBeenCalledTimes(1);
      expect(animate).not.toHaveBeenCalled();
    });
  });
});
