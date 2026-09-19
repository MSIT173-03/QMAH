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
      '這是一段用來驗證明信片背面完整保留既有商品說明的測試文字，不應新增不存在的文物資料。',
    );
    // Standalone signal input 需先完成一次明確變更偵測，測試才會讀到 aria 狀態與版型屬性。
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should preserve the full description and offer punctuation-aware wrapping', () => {
    const description =
      '第一段文字用來超過舊版的七十二字限制，並確認逗號後可優先換行；第二段仍須完整顯示，不可以因為版面高度而被程式裁掉。最後一句必須完整保留。';
    fixture.componentRef.setInput('description', description);
    fixture.detectChanges();

    const descriptionElement = fixture.nativeElement.querySelector('.postcard-description') as HTMLElement;
    expect(descriptionElement.textContent?.replace(/\s+/g, '')).toBe(description.replace(/[。.]$/u, ''));
    expect(descriptionElement.querySelectorAll('.postcard-description-segment').length).toBeGreaterThan(1);
    expect(descriptionElement.querySelectorAll('wbr').length).toBeGreaterThan(1);
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

  it('should choose one postcard direction from the loaded image dimensions', () => {
    fixture.componentRef.setInput('image', '/images/test-portrait.jpg');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.card-art img') as HTMLImageElement;
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 600 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 900 });
    image.dispatchEvent(new Event('load'));
    fixture.detectChanges();

    // 正反面共用外層 data-layout，因此直式尺寸與背面上下排版會一起生效。
    expect(fixture.nativeElement.querySelector('.card-flip-button')?.getAttribute('data-layout')).toBe('portrait');
  });
});
