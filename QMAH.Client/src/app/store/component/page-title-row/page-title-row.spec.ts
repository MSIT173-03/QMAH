import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageTitleRow } from './page-title-row';

describe('PageTitleRow', () => {
  let component: PageTitleRow;
  let fixture: ComponentFixture<PageTitleRow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageTitleRow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageTitleRow);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
