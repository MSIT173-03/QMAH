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
  readonly demoAnswers = [
    { author: '小青', text: '青色釉彩最吸引我。\n擺在書房一定很好看。', votes: 2 },
    { author: '阿墨', text: '三隻腳撐得很穩。\n我猜它是用來焚香的。', votes: 4 },
    { author: '阿銅', text: '金屬線勾出這麼細的花紋，\n手藝真厲害。', votes: 1 }
  ] as const;
  readonly selectedDemoAnswer = signal<number | null>(null);
  readonly demoRevealed = signal(false);
  readonly demoResponse = signal('');
  readonly demoSubmitted = signal(false);
  readonly trainingChoices = ['青花折枝花卉盤', '掐絲琺瑯雲龍紋三足香爐', '剔紅山水人物盒'] as const;
  readonly selectedTrainingChoice = signal<number | null>(null);
  readonly trainingRevealed = signal(false);

  restartTrainingDemo(): void {
    this.selectedTrainingChoice.set(null);
    this.trainingRevealed.set(false);
  }

  submitDemoResponse(): void {
    if (this.demoResponse().trim()) this.demoSubmitted.set(true);
  }

  selectGuide(variant: GameHowToVariant): void {
    this.activeGuide.set(variant);
  }

  restartDemo(): void {
    this.demoResponse.set('');
    this.demoSubmitted.set(false);
    this.selectedDemoAnswer.set(null);
    this.demoRevealed.set(false);
  }
}
