import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationPick, LocationPickerComponent, isValidPoint, roundCoordinate } from './location-picker';

describe('location picker helpers', () => {
  it('rounds coordinates to 6 decimals', () => {
    expect(roundCoordinate(25.03300049)).toBe(25.033);
    expect(roundCoordinate(121.56543219)).toBe(121.565432);
  });

  it('validates coordinate ranges', () => {
    expect(isValidPoint(25.033, 121.5654)).toBe(true);
    expect(isValidPoint(91, 0)).toBe(false);
    expect(isValidPoint(0, 181)).toBe(false);
    expect(isValidPoint(null, null)).toBe(false);
    expect(isValidPoint(Number.NaN, 1)).toBe(false);
  });
});

describe('LocationPickerComponent', () => {
  let fixture: ComponentFixture<LocationPickerComponent>;
  let component: LocationPickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LocationPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(LocationPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not show the clear button until a point exists', () => {
    expect(fixture.nativeElement.textContent).not.toContain('清除位置');
    fixture.componentRef.setInput('latitude', 25.033);
    fixture.componentRef.setInput('longitude', 121.5654);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('清除位置');
  });

  it('emits cleared when the user clears the location', () => {
    let cleared = 0;
    component.cleared.subscribe(() => cleared++);
    component.clear();
    expect(cleared).toBe(1);
  });

  it('turns search results into choices and emits the chosen place', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ lat: '25.0339', lon: '121.5645', display_name: '台北 101, 信義區, 台北市' }]
      })
    );
    const picks: LocationPick[] = [];
    component.picked.subscribe((pick) => picks.push(pick));

    component.searchText = '台北 101';
    await component.search();
    expect(component.results().length).toBe(1);

    component.choose(component.results()[0]);
    expect(picks).toEqual([{ latitude: 25.0339, longitude: 121.5645, location: '台北 101, 信義區, 台北市' }]);
    expect(component.results().length).toBe(0);
    vi.unstubAllGlobals();
  });

  it('keeps the coordinates and shows a message when reverse geocoding fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const picks: LocationPick[] = [];
    component.picked.subscribe((pick) => picks.push(pick));

    await component.selectPoint(25.0330004, 121.5654004);

    expect(picks[0]).toEqual({ latitude: 25.033, longitude: 121.5654, location: null });
    expect(picks.length).toBe(1);
    expect(component.message()).toContain('已記下座標');
    vi.unstubAllGlobals();
  });
});
