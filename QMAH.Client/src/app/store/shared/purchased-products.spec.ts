import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CheckoutApi } from '../api';
import { PurchasedProducts } from './purchased-products';
import { StoreAuth, StoreAuthStatus } from './store-auth';

describe('PurchasedProducts', () => {
  let status: WritableSignal<StoreAuthStatus>;
  let getPurchasedProductIds: ReturnType<typeof vi.fn>;

  const create = (): PurchasedProducts => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StoreAuth, useValue: { status } },
        { provide: CheckoutApi, useValue: { getPurchasedProductIds } },
      ],
    });
    const purchased = TestBed.inject(PurchasedProducts);
    TestBed.tick();
    return purchased;
  };
  const setStatus = (value: StoreAuthStatus): void => {
    status.set(value);
    TestBed.tick();
  };

  beforeEach(() => {
    status = signal<StoreAuthStatus>('unknown');
    getPurchasedProductIds = vi.fn(() => of(['AAA-1', 'bbb-2']));
  });

  it('does not query until the user is known to be signed in', () => {
    const purchased = create();
    setStatus('anonymous');

    expect(getPurchasedProductIds).not.toHaveBeenCalled();
    expect(purchased.has('aaa-1')).toBe(false);
  });

  it('queries once after sign-in and answers case-insensitively', () => {
    const purchased = create();
    setStatus('authenticated');

    expect(getPurchasedProductIds).toHaveBeenCalledTimes(1);
    expect(purchased.has('aaa-1')).toBe(true);
    expect(purchased.has('BBB-2')).toBe(true);
    expect(purchased.has('ccc-3')).toBe(false);
  });

  it('does not query again while the sign-in lasts', () => {
    create();
    setStatus('authenticated');
    setStatus('unknown');
    setStatus('authenticated');

    expect(getPurchasedProductIds).toHaveBeenCalledTimes(1);
  });

  describe('ensureLoaded (called when a store page is entered)', () => {
    it('queries when signed in but nothing is stored yet, and does not query twice', () => {
      status.set('authenticated');
      const purchased = create();
      purchased.ensureLoaded();
      purchased.ensureLoaded();

      expect(getPurchasedProductIds).toHaveBeenCalledTimes(1);
      expect(purchased.has('aaa-1')).toBe(true);
    });

    it('searches again when the earlier query failed and left nothing stored', () => {
      getPurchasedProductIds = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('offline')))
        .mockReturnValue(of(['aaa-1']));
      status.set('authenticated');
      const purchased = create();
      expect(purchased.has('aaa-1')).toBe(false);

      purchased.ensureLoaded();

      expect(getPurchasedProductIds).toHaveBeenCalledTimes(2);
      expect(purchased.has('aaa-1')).toBe(true);
    });

    it('does nothing for a guest or while the sign-in state is still unknown', () => {
      const purchased = create();
      purchased.ensureLoaded();
      setStatus('anonymous');
      purchased.ensureLoaded();

      expect(getPurchasedProductIds).not.toHaveBeenCalled();
    });
  });

  it('forgets everything on sign-out and queries again at the next sign-in', () => {
    const purchased = create();
    setStatus('authenticated');
    setStatus('anonymous');
    expect(purchased.has('aaa-1')).toBe(false);

    setStatus('authenticated');
    expect(getPurchasedProductIds).toHaveBeenCalledTimes(2);
    expect(purchased.has('aaa-1')).toBe(true);
  });

  it('ignores a response that arrives after sign-out', () => {
    const pending = new Subject<string[]>();
    getPurchasedProductIds = vi.fn(() => pending);
    const purchased = create();
    setStatus('authenticated');
    setStatus('anonymous');

    pending.next(['aaa-1']);

    expect(purchased.has('aaa-1')).toBe(false);
  });
});
