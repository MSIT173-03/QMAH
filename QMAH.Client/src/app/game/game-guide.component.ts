import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GameHowToComponent, GameHowToVariant } from './game-how-to.component';
import { GameNavigationComponent } from './game-navigation.component';

@Component({
  selector: 'app-game-guide',
  standalone: true,
  imports: [RouterLink, GameHowToComponent, GameNavigationComponent],
  templateUrl: './game-guide.component.html',
  styleUrl: './game-guide.component.scss'
})
export class GameGuideComponent {
  // ui-integration: 說明頁一次只呈現一種玩法，保留切換入口但不讓兩套流程同時佔滿畫面。
  readonly activeGuide = signal<GameHowToVariant>('multiplayer');

  selectGuide(variant: GameHowToVariant): void {
    this.activeGuide.set(variant);
  }
}
