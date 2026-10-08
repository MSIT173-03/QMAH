import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScrollTop } from './scroll-top';

describe('ScrollTop', () => {
  let fixture: ComponentFixture<ScrollTop>;
  let scrollTo: ReturnType<typeof vi.fn>;

  const scrollY = (value: number): void => {
    Object.defineProperty(window, 'scrollY', { value, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  };
  const button = (): HTMLButtonElement | null => fixture.nativeElement.querySelector('.scroll-top');

  beforeEach(async () => {
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    await TestBed.configureTestingModule({ imports: [ScrollTop] }).compileComponents();
    fixture = TestBed.createComponent(ScrollTop);
    fixture.detectChanges();
  });

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    delete (window as Partial<Window>).matchMedia;
  });

  it('is hidden while the page is at the top (or cannot scroll at all)', () => {
    expect(button()).toBeNull();
  });

  it('appears after scrolling down', () => {
    scrollY(300);
    expect(button()).not.toBeNull();
    expect(button()?.getAttribute('aria-label')).toBe('回到頁面頂端');
    expect(button()?.querySelector('svg')).not.toBeNull();
    expect(button()?.classList.contains('scroll-top--leaving')).toBe(false);
  });

  describe('going back to the top', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fades out first and is only removed once the leave animation is over', () => {
      scrollY(300);

      scrollY(0);
      expect(button()).not.toBeNull();
      expect(button()?.classList.contains('scroll-top--leaving')).toBe(true);

      vi.advanceTimersByTime(199);
      fixture.detectChanges();
      expect(button()).not.toBeNull();

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(button()).toBeNull();
    });

    it('comes back at once if the page is scrolled again while it is fading out', () => {
      scrollY(300);
      scrollY(0);

      scrollY(120);
      expect(button()?.classList.contains('scroll-top--leaving')).toBe(false);

      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      expect(button()).not.toBeNull();
    });
  });

  it('smoothly scrolls back to the top when clicked', () => {
    scrollY(300);

    button()!.click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps instead of animating when the user prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    scrollY(300);

    button()!.click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('stops listening to scroll events once destroyed', () => {
    fixture.destroy();
    const removed = vi.spyOn(window, 'removeEventListener');

    TestBed.createComponent(ScrollTop).destroy();

    expect(removed).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
