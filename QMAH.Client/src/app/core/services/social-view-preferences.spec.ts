import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SocialViewPreferences } from './social-view-preferences';

describe('SocialViewPreferences', () => {
  beforeEach(() => localStorage.removeItem('qmah.social.width'));

  it('defaults to the wide layout', () => {
    expect(TestBed.inject(SocialViewPreferences).wide()).toBe(true);
  });

  it('keeps the standard layout once the user chose it', () => {
    localStorage.setItem('qmah.social.width', 'standard');
    expect(TestBed.inject(SocialViewPreferences).wide()).toBe(false);
  });
});
