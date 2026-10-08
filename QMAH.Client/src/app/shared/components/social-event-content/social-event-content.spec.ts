import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialEventContentComponent } from './social-event-content';

describe('SocialEventContentComponent', () => {
  it('shows complete API facts even when the preview was truncated', async () => {
    await TestBed.configureTestingModule({ imports: [SocialEventContentComponent], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(SocialEventContentComponent);
    fixture.componentRef.setInput('content', '歡迎參加 活動資訊 時間：2026/10/13 14:00 至…');
    fixture.componentRef.setInput('preview', true);
    fixture.componentRef.setInput('eventSummary', { startAt: '2026-10-13T14:00:00', endAt: '2026-10-13T17:00:00', location: '臺北市信義區市府路45號', capacity: 6 });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.excerpt')?.textContent).toBe('歡迎參加');
    expect(root.querySelectorAll('dd').length).toBe(3);
    expect(root.textContent).toContain('臺北市信義區市府路45號');
    expect(root.textContent).toContain('6 人');
  });
});
