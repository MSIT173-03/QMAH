import { describe, expect, it } from 'vitest';
import { keyAssetPath } from './key-assets';

describe('keyAssetPath', () => {
  it('uses the original illustrated normal key in all shared key views', () => {
    expect(keyAssetPath('NORMAL')).toBe('/assets/catalog/keys/normal.png');
  });

  it('keeps category-specific artwork and the other illustrated key types', () => {
    expect(keyAssetPath('CATEGORY', 'CERAMIC')).toBe('/assets/catalog/keys/category-ceramic.png');
    expect(keyAssetPath('ERA')).toBe('/assets/catalog/keys/era.png');
    expect(keyAssetPath('UNIVERSAL')).toBe('/assets/catalog/keys/universal.png');
  });
});
