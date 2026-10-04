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
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
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
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry')).toBeNull();
  });

  it('shows the display name once /me resolves', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush({
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
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(component.meApi.me()?.displayName).toBe('測試管理員');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry').getAttribute('href')).toBe('/api/v1/navigation/admin');
    expect(fixture.nativeElement.querySelector('a.app-mobile-admin-entry')).not.toBeNull();
  });

  it('hides both admin entries for ordinary members', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush({ roles: ['Member'], email: 'member@example.test' });
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush(
      { message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' }
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.app-admin-entry')).toBeNull();
    expect(fixture.nativeElement.querySelector('a.app-mobile-admin-entry')).toBeNull();
  });
});
