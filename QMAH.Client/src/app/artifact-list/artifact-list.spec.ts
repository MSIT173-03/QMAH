import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArtifactList } from './artifact-list';

describe('ArtifactList', () => {
  let component: ArtifactList;
  let fixture: ComponentFixture<ArtifactList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtifactList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArtifactList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
