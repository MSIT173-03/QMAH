import { TestBed } from '@angular/core/testing';

import { ArtifactUnlockService } from './artifact-unlock-service';

describe('ArtifactUnlockService', () => {
  let service: ArtifactUnlockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ArtifactUnlockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
