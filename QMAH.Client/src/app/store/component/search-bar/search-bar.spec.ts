import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchBar } from './search-bar';

describe('SearchBar', () => {
  let component: SearchBar;
  let fixture: ComponentFixture<SearchBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('按 Enter 與搜尋按鈕都會送出去除空白的關鍵字', () => {
    const keywords: string[] = [];
    component.search.subscribe(k => keywords.push(k));
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = '  青銅器 ';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    (root.querySelector('.search-submit') as HTMLButtonElement).click();
    expect(keywords).toEqual(['青銅器', '青銅器']);
  });
});
