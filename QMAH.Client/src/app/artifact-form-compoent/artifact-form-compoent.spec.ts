import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArtifactFormCompoent } from './artifact-form-compoent';

describe('ArtifactFormCompoent', () => {
  let component: ArtifactFormCompoent;
  let fixture: ComponentFixture<ArtifactFormCompoent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtifactFormCompoent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArtifactFormCompoent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
