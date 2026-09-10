import { TestBed } from '@angular/core/testing';

import { CatalogUnlockService } from './catalog-unlock-service';

describe('CatalogUnlockService', () => {
  let service: CatalogUnlockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CatalogUnlockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
