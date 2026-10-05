import { GameRewardMeterComponent } from './game-reward-meter.component';
import { MeApiService } from '../core/services/me-api';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { GameHowToComponent, GameHowToVariant } from './game-how-to.component';
import { GameNavigationComponent } from './game-navigation.component';
import { GameGuideMultiplayerDemoComponent } from './game-guide-multiplayer-demo.component';
import { GameFocusMode } from '../core/services/game-focus-mode';

import { GameTrainingDemoComponent } from './game-training-demo.component';

type TrainingDemoCode = 'DETAIL_LOCATOR' | 'MEMORY_MATCH' | 'ARTIFACT_PUZZLE' | 'STRIP_RESTORE';

@Component({
  selector: 'app-game-guide',
  standalone: true,
  imports: [GameRewardMeterComponent, RouterLink, GameHowToComponent, GameNavigationComponent, GameTrainingDemoComponent, GameGuideMultiplayerDemoComponent],
  templateUrl: './game-guide.component.html',
  styleUrl: './game-guide.component.scss'
})
export class GameGuideComponent {
  readonly focusMode = inject(GameFocusMode);
  readonly meApi = inject(MeApiService);
  // 說明頁一次呈現一種玩法；每個示範只用本機樣本，不會建立正式挑戰或發放獎勵。
  private readonly route = inject(ActivatedRoute);
  readonly activeGuide = signal<GameHowToVariant>(this.route.snapshot.queryParamMap.get('mode') === 'training' ? 'training' : 'multiplayer');
  readonly demoAnswers = [
    { author: '小青', category: '史實推理', text: '三足香爐的器形，加上掐絲琺瑯和雲龍紋，我猜它可能是供焚香使用的陳設器。\n光看圖片還不能確定它的年代和使用場合。', votes: 2 },
    { author: '阿墨', category: '擬真異說', text: '我猜這座爐可能放在書齋待客桌上，客人到訪時才掀蓋添香，三足也能讓爐身離開桌面。\n藍地和蓮花、法輪紋或許是主人挑來配合書齋陳設的樣式。', votes: 4 },
    { author: '阿銅', category: '妙想奇談', text: '三隻腳站得穩，說不定半夜還會自己巡房。\n雲龍負責喊口令，香爐專心裝作沒聽見。', votes: 1 }
  ] as const;
  readonly selectedDemoAnswer = signal<number | null>(null);
  readonly demoRevealed = signal(false);
  readonly demoResponse = signal('');
  readonly demoSubmitted = signal(false);

  readonly trainingModes = [
    { code: 'DETAIL_LOCATOR', label: '細節追跡', hint: '看細節，在四件原圖上定位' },
    { code: 'MEMORY_MATCH', label: '館藏翻牌', hint: '記住圖樣位置，找齊配對' },
    { code: 'ARTIFACT_PUZZLE', label: '館藏拼圖', hint: '拖曳碎片，拼回文物原圖' },
    { code: 'STRIP_RESTORE', label: '書畫拼貼', hint: '相鄰碎片交換，拼回原樣' },
  ] as const;
  readonly activeTrainingDemo = signal<TrainingDemoCode>(this.initialDemo());
  private initialDemo(): TrainingDemoCode {
    const code = this.route.snapshot.queryParamMap.get('game');
    return this.trainingModes.find(mode => mode.code === code)?.code ?? 'DETAIL_LOCATOR';
  }
  selectGuide(variant: GameHowToVariant): void {
    this.activeGuide.set(variant);
  }

  selectTrainingDemo(code: TrainingDemoCode): void {
    this.activeTrainingDemo.set(code);
  }

  submitDemoResponse(): void {
    if (this.demoResponse().trim()) this.demoSubmitted.set(true);
  }

  restartDemo(): void {
    this.demoResponse.set('');
    this.demoSubmitted.set(false);
    this.selectedDemoAnswer.set(null);
    this.demoRevealed.set(false);
  }
}
