import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DailyActivity } from './daily-activity';

describe('DailyActivity check-in', () => {
  let component: DailyActivity;
  let http: HttpTestingController;
  const summary = { lastLoginDate: '2026-10-01', hasLoggedInToday: true, totalLoginDays: 16,
    currentLoginStreak: 16, longestLoginStreak: 16, lifetimeLoginRate: 1,
    hasCheckedInToday: false, dailyPointReward: 6, awardedPoints: 0, currentCheckInStreak: 6,
    remainingMonthlyBonuses: 4, makeUpDays: [{date: '2026-09-29', pointCost: 0}] };
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [DailyActivity],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]}).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DailyActivity);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/v1/me/daily-activity').flush(summary);
  });
  afterEach(() => http.verify());
  function requestClaim() {
    component.loginToday();
    http.expectOne('/api/v1/account/antiforgery-token').flush({});
    const request = http.expectOne('/api/v1/me/daily-activity/check-in');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    return request;
  }
  it('allows claiming despite existing login and displays the actual streak bonus', () => {
    requestClaim().flush({...summary, hasCheckedInToday: true, awardedPoints: 6, currentCheckInStreak: 7});
    expect(component.successMessage).toContain('6 點');
    expect(component.dailyActivity?.hasCheckedInToday).toBe(true);
    component.loginToday();
    http.expectNone('/api/v1/account/antiforgery-token');
  });
  it('blocks double clicks while a claim is pending', () => {
    const claim = requestClaim();
    component.loginToday();
    http.expectNone('/api/v1/account/antiforgery-token');
    claim.flush({...summary, hasCheckedInToday: true, awardedPoints: 6});
  });
  it('does not announce new points when another tab already claimed', () => {
    requestClaim().flush({...summary, hasCheckedInToday: true, awardedPoints: 0});
    expect(component.successMessage).toContain('已領取');
    expect(component.successMessage).not.toContain('6 點');
  });
  it('retains eligibility and enables retry after a failure', () => {
    requestClaim().flush({detail: '請稍後重試'}, {status: 503, statusText: 'Unavailable'});
    expect(component.loggingIn).toBe(false);
    expect(component.dailyActivity?.hasCheckedInToday).toBe(false);
    expect(component.errorMessage).toBe('請稍後重試');
    requestClaim().flush({...summary, hasCheckedInToday: true, awardedPoints: 6});
  });
  it('starts the next seven-day display after day seven', () => {
    component.dailyActivity = {...summary, hasCheckedInToday: true, currentCheckInStreak: 8};
    expect(component.streakDays.filter(day => day.completed).length).toBe(1);
    component.dailyActivity = {...summary, hasCheckedInToday: true, currentCheckInStreak: 14};
    expect(component.streakDays.filter(day => day.completed).length).toBe(7);
  });
  it('submits the selected date and displayed fee and shows actual net points', () => {
    component.selectedMakeUpDate = '2026-09-29';
    component.makeUp();
    http.expectOne('/api/v1/account/antiforgery-token').flush({});
    const request = http.expectOne('/api/v1/me/daily-activity/make-up');
    expect(request.request.body).toEqual({targetDate: '2026-09-29', expectedPointCost: 0});
    component.loginToday();
    component.makeUp();
    http.expectNone('/api/v1/account/antiforgery-token');
    request.flush({...summary, awardedPoints: 3, makeUpDays: []});
    expect(component.successMessage).toContain('本次免費，實得 3 點');
    expect(component.selectedMakeUpDate).toBe('');
  });
  it('keeps the date selected and allows retry if the fee changed', () => {
    component.selectedMakeUpDate = '2026-09-29';
    component.makeUp();
    http.expectOne('/api/v1/account/antiforgery-token').flush({});
    http.expectOne('/api/v1/me/daily-activity/make-up').flush({detail: '費用已變更'}, {status: 409, statusText: 'Conflict'});
    expect(component.errorMessage).toBe('費用已變更');
    expect(component.makingUp).toBe(false);
    expect(component.selectedMakeUpDate).toBe('2026-09-29');
  });
  it('keeps history visible when old services omit rewards and blocks claiming', () => {
    component.loadDailyActivity();
    http.expectOne('/api/v1/me/daily-activity').flush({lastLoginDate: '2026-10-01', hasLoggedInToday: true,
      totalLoginDays: 32, currentLoginStreak: 1, longestLoginStreak: 30, lifetimeLoginRate: 0.8});
    expect(component.rewardServiceReady).toBe(false);
    expect(component.dailyActivity?.makeUpDays).toEqual([]);
    expect(component.dailyActivity?.totalLoginDays).toBe(32);
    expect(component.streakDays.length).toBe(7);
    component.loginToday();
    http.expectNone('/api/v1/account/antiforgery-token');
  });
  it('marks the next available day and counts down to the bounded bonus', () => {
    expect(component.daysUntilBonus).toBe(1);
    expect(component.streakDays.find(day => day.upcoming)?.day).toBe(7);
    expect(component.completedWeekDays).toBe(6);
    component.dailyActivity = {...summary, hasCheckedInToday: true, currentCheckInStreak: 7};
    expect(component.daysUntilBonus).toBe(7);
    expect(component.completedWeekDays).toBe(7);
  });
});
