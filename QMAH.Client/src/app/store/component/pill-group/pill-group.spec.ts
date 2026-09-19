import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PillGroup } from './pill-group';

describe('PillGroup', () => {
  let component: PillGroup;
  let fixture: ComponentFixture<PillGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PillGroup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PillGroup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
