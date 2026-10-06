import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Review } from '../../../api/api.models';
import { ProductReviews } from './product-reviews';

describe('ProductReviews', () => {
  let component: ProductReviews;
  let fixture: ComponentFixture<ProductReviews>;

  const mine: Review = {
    id: 'r1',
    stars: 4,
    user: '我',
    date: '2026-10-01',
    text: '很喜歡這件明信片',
    editedAt: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductReviews] }).compileComponents();
    fixture = TestBed.createComponent(ProductReviews);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const set = (name: string, value: unknown): void => {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  };
  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);
  const submitButton = (): HTMLButtonElement => el('.review-actions button[type="submit"]') as HTMLButtonElement;
  const type = (value: string): void => {
    const input = el('.review-input') as HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('shows no editor to someone who has not bought the product', () => {
    set('canReview', false);
    set('myReview', null);

    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine')).toBeNull();
  });

  it('waits for the member\'s own review before showing anything', () => {
    set('canReview', true);
    set('myReview', undefined);

    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine')).toBeNull();
  });

  it('puts the editor between the title and the filter buttons', () => {
    set('canReview', true);
    set('myReview', null);

    const children = Array.from(fixture.nativeElement.querySelector('section').children as HTMLCollection).map((child) =>
      child.tagName.toLowerCase(),
    );
    expect(children.indexOf('app-section-head')).toBeLessThan(children.indexOf('form'));
    expect(children.indexOf('form')).toBeLessThan(children.indexOf('app-pill-group'));
  });

  it('needs both a rating and some text before it can be submitted', () => {
    set('canReview', true);
    set('myReview', null);
    expect(submitButton().disabled).toBe(true);

    (el('.review-star:nth-child(3)') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(submitButton().disabled).toBe(true);

    type('   ');
    expect(submitButton().disabled).toBe(true);

    type('做工很細緻');
    expect(submitButton().disabled).toBe(false);
    expect(el('.review-star:nth-child(3)')?.getAttribute('aria-checked')).toBe('true');
  });

  it('emits the rating and the trimmed content when submitted', () => {
    const saved = vi.fn();
    component.reviewSave.subscribe(saved);
    set('canReview', true);
    set('myReview', null);

    (el('.review-star:nth-child(5)') as HTMLButtonElement).click();
    type('  很棒  ');
    submitButton().click();

    expect(saved).toHaveBeenCalledWith({ rating: 5, content: '很棒' });
  });

  it('disables the button and shows the error while saving fails', () => {
    set('canReview', true);
    set('myReview', null);
    set('saving', true);
    expect(submitButton().textContent?.trim()).toBe('送出中…');
    expect(submitButton().disabled).toBe(true);

    set('saving', false);
    set('saveError', '評價送出失敗，請稍後再試。');
    expect(el('.review-error')?.textContent?.trim()).toBe('評價送出失敗，請稍後再試。');
  });

  it('shows a submitted review as read-only text with an edit button', () => {
    set('canReview', true);
    set('myReview', mine);

    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine .review-text')?.textContent?.trim()).toBe('很喜歡這件明信片');
    expect(el('.review-card--mine textarea')).toBeNull();
    expect(el('.review-card--mine .review-edited')).toBeNull();
    expect(el('.review-card--mine .review-edit')?.textContent?.trim()).toBe('編輯');
    // 編輯按鈕與星等、時間在同一行（.review-meta 內），不再有外框按鈕
    expect(el('.review-card--mine .review-meta .review-edit')).not.toBeNull();
    expect(el('.review-card--mine .review-actions')).toBeNull();
  });

  it('turns the button into an editor, prefilled, and goes back to text after the new review arrives', () => {
    const saved = vi.fn();
    component.reviewSave.subscribe(saved);
    set('canReview', true);
    set('myReview', mine);

    (el('.review-card--mine .review-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((el('.review-input') as HTMLTextAreaElement).value).toBe('很喜歡這件明信片');
    expect(el('.review-star:nth-child(4)')?.getAttribute('aria-checked')).toBe('true');
    expect(submitButton().textContent?.trim()).toBe('送出');

    type('用了一個月，更喜歡了');
    submitButton().click();
    expect(saved).toHaveBeenCalledWith({ rating: 4, content: '用了一個月，更喜歡了' });

    // 後端回傳編輯後的評價：回到不可修改的文字，並顯示編輯時間
    set('myReview', { ...mine, text: '用了一個月，更喜歡了', editedAt: '2026-10-06T06:30:00Z' });
    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine .review-text')?.textContent?.trim()).toBe('用了一個月，更喜歡了');
    expect(el('.review-card--mine .review-edited')?.textContent).toMatch(/^編輯於 \d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/);
  });

  it('lets the member cancel an edit without losing the submitted text', () => {
    set('canReview', true);
    set('myReview', mine);

    (el('.review-card--mine .review-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el('.review-actions button[type="button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine .review-text')?.textContent?.trim()).toBe('很喜歡這件明信片');
  });

  it('also marks edited reviews in the public list', () => {
    set('reviews', [mine, { ...mine, id: 'r2', user: '別人', editedAt: '2026-10-06T06:30:00Z' }]);

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.review-card')) as HTMLElement[];
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.review-edited')).toBeNull();
    expect(cards[1].querySelector('.review-edited')?.textContent).toContain('編輯於');
  });
});
