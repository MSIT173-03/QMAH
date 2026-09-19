import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectibleCard } from './collectible-card';

describe('CollectibleCard', () => {
  let fixture: ComponentFixture<CollectibleCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectibleCard],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectibleCard);
    fixture.componentRef.setInput('name', '測試文物');
    fixture.componentRef.setInput('type', '陶瓷');
    fixture.componentRef.setInput('dimensions', '高 12 公分');
    fixture.componentRef.setInput(
      'description',
      '這是一段用來驗證明信片背面節錄既有商品說明的測試文字，不應新增不存在的文物資料。',
    );
    // Standalone signal input 需先完成一次明確變更偵測，測試才會讀到 aria 狀態與版型屬性。
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should flip between the image side and the basic-information side', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toContain('翻回');
    // 翻面狀態只放在共用 track，避免外層再出現一塊不旋轉的紙色底板。
    expect(fixture.nativeElement.querySelector('.postcard-track')?.classList.contains('is-flipped')).toBe(true);
    expect(fixture.nativeElement.querySelector('.postcard-dimensions')?.textContent).toContain('高 12 公分');
    expect(fixture.nativeElement.querySelector('.postcard-description')?.textContent).toContain('既有商品說明');
  });
});
