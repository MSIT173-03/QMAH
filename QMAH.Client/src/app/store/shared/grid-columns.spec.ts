import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { gridColumns } from './grid-columns';

@Component({
  template: `@if (show) {
    <div #grid style="display: grid; grid-template-columns: 100px 100px 100px 100px"></div>
  }`,
})
class Host {
  show = false;
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  readonly columns = gridColumns(this.grid);
}

describe('gridColumns', () => {
  it('is unlimited until the grid is rendered, then reports the number of columns', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.componentInstance.columns()).toBe(Infinity);

    fixture.componentInstance.show = true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.columns()).toBe(4);
  });
});
