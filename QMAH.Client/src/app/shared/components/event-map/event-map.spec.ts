import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventMapComponent } from './event-map';

describe('EventMapComponent', () => {
  let fixture: ComponentFixture<EventMapComponent>;
  let component: EventMapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EventMapComponent] }).compileComponents();
    fixture = TestBed.createComponent(EventMapComponent);
    component = fixture.componentInstance;
  });

  it('uses coordinates when both latitude and longitude are provided', () => {
    fixture.componentRef.setInput('latitude', 25.033);
    fixture.componentRef.setInput('longitude', 121.5654);
    fixture.componentRef.setInput('location', '台北 101');
    fixture.detectChanges();

    expect(component.query()).toBe('25.033,121.5654');
    expect(component.openUrl()).toContain(encodeURIComponent('25.033,121.5654'));
    expect(fixture.nativeElement.querySelector('iframe')).not.toBeNull();
  });

  it('falls back to the location text when there are no coordinates', () => {
    fixture.componentRef.setInput('location', '臺北市立美術館');
    fixture.detectChanges();

    expect(component.query()).toBe('臺北市立美術館');
  });

  it('renders nothing for online events or missing locations', () => {
    fixture.componentRef.setInput('location', '線上');
    fixture.detectChanges();
    expect(component.query()).toBeNull();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();

    fixture.componentRef.setInput('location', '   ');
    fixture.detectChanges();
    expect(component.query()).toBeNull();
  });

  it('ignores out-of-range coordinates', () => {
    fixture.componentRef.setInput('latitude', 120);
    fixture.componentRef.setInput('longitude', 10);
    fixture.componentRef.setInput('location', null);
    fixture.detectChanges();

    expect(component.query()).toBeNull();
  });
});
