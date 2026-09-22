import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyList } from './key-list';

describe('KeyList', () => {
  let component: KeyList;
  let fixture: ComponentFixture<KeyList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeyList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
