import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ArtifactList } from './artifact-list';

describe('ArtifactList', () => {
  let component: ArtifactList;
  let fixture: ComponentFixture<ArtifactList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtifactList],
      // integration: 元件使用 RouterLink／ActivatedRoute；測試補最小 router provider，不改正式路由行為。
      providers: [provideRouter([])]
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
