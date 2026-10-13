import { EMPTY } from 'rxjs';
import { NotificationLive } from '../../../core/services/notification-live';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LayoutComponent } from './layout';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: NotificationLive, useValue: { changes: EMPTY } }]
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush(null);
    httpMock.expectNone((r) => r.url.endsWith('/me/notifications'));

    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry')).toBeNull();
  });

  it('moves focus outside the drawer before making it inert', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush(null);
    component.menuOpen.set(true);
    fixture.detectChanges();
    const drawer = fixture.nativeElement.querySelector('#mobile-navigation') as HTMLElement;
    const link = drawer.querySelector('a') as HTMLAnchorElement;
    link.focus();
    expect(document.activeElement).toBe(link);

    component.closeMenu();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.app-menu-toggle'));
    fixture.detectChanges();
    expect(drawer.hasAttribute('inert')).toBe(true);
    expect(drawer.contains(document.activeElement)).toBe(false);
  });

  it('lets the navigation click finish before closing the drawer', async () => {
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush(null);
    component.menuOpen.set(true);
    fixture.detectChanges();
    component.closeMenuAfterSelection();
    expect(component.menuOpen()).toBe(true);
    await Promise.resolve();
    expect(component.menuOpen()).toBe(false);
  });

  it('shows the display name once /me resolves', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'admin@qmah.local',
      displayName: '測試管理員',
      status: 'ACTIVE',
      pointBalance: 0,
      roles: ['Admin'],
      createdAt: '2026-01-01T00:00:00Z',
      bio: null,
      visibility: 'PRIVATE',
      avatarPath: null
    });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0, unreadCount: 0, readCount: 0, totalNotificationCount: 0 }
    );

    expect(component.meApi.me()?.displayName).toBe('測試管理員');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry').getAttribute('href')).toBe('/api/v1/navigation/admin');
    expect(fixture.nativeElement.querySelector('a.app-mobile-admin-entry')).not.toBeNull();
  });

  it('hides both admin entries for ordinary members', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush({ id: 'member-1', roles: ['Member'], email: 'member@example.test' });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' }
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry')).toBeNull();
    expect(fixture.nativeElement.querySelector('a.app-mobile-admin-entry')).toBeNull();
  });

  function loadAdmin(): void {
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush({ id: 'admin-1', roles: ['Admin'], email: 'admin@example.test' });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0, unreadCount: 0, readCount: 0, totalNotificationCount: 0 }
    );
    fixture.detectChanges();
  }

  it('closes the mobile drawer before opening the confirmation', () => {
    loadAdmin();
    component.menuOpen.set(true);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    let openedWithDrawer = true;
    dialog.showModal = () => { openedWithDrawer = component.menuOpen(); };
    const event = new MouseEvent('click', { cancelable: true });
    component.confirmAdminNavigation(event);
    expect(openedWithDrawer).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the link usable if the confirmation cannot open', () => {
    loadAdmin();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => { throw new Error('dialog unavailable'); };
    const event = new MouseEvent('click', { cancelable: true });
    component.confirmAdminNavigation(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not cancel the confirmation link when its click bubbles through the dialog', () => {
    loadAdmin();
    const link = fixture.nativeElement.querySelector('dialog a') as HTMLAnchorElement;
    link.removeAttribute('href');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps modified clicks available for opening another tab', () => {
    loadAdmin();
    const event = new MouseEvent('click', { ctrlKey: true, cancelable: true });
    component.confirmAdminNavigation(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not reopen an already open confirmation', () => {
    loadAdmin();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.open = true;
    let opens = 0;
    dialog.showModal = () => { opens++; };
    component.confirmAdminNavigation(new MouseEvent('click', { cancelable: true }));
    expect(opens).toBe(0);
  });

  it('preserves the admin entry on a transient refresh failure, then clears it on 401', () => {
    loadAdmin();
    component.meApi.refresh();
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry')).not.toBeNull();
    component.meApi.refresh();
    httpMock.expectOne((r) => r.url.endsWith('/me/session')).flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry')).toBeNull();
  });

  it('clears the member when notifications report an expired session', () => {
    loadAdmin();
    component.meApi.me.set({ id: 'member-1', roles: ['Member'], email: 'member@example.test' } as never);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' }
    );
    expect(component.meApi.me()).toBeNull();
  });
});
