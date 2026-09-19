import { Component, computed, input } from '@angular/core';

export type GameHowToVariant = 'multiplayer' | 'training';

interface HowToStep {
  label: string;
  title: string;
  description: string;
}

interface HowToContent {
  eyebrow: string;
  title: string;
  description: string;
  steps: readonly HowToStep[];
}

const HOW_TO_CONTENT: Record<GameHowToVariant, HowToContent> = {
  multiplayer: {
    eyebrow: '多人鑑定',
    title: '先看懂流程，再加入房間',
    description: '和朋友一起觀察館藏，從作答、投票到揭曉，完成一場多人鑑定。',
    steps: [
      { label: '01', title: '選擇或建立房間', description: '選一間可加入的房間，或建立一間新的鑑定房間。' },
      { label: '02', title: '觀察並寫下判斷', description: '每回合查看館藏，選擇回答方式並寫下你的看法。' },
      { label: '03', title: '閱讀回答並投票', description: '作答結束後，投票選出最有說服力的回答。' },
      { label: '04', title: '查看結果與獎勵', description: '回合揭曉後繼續下一回合，完成整場後查看結果並領取獎勵。' }
    ]
  },
  training: {
    eyebrow: '單人小遊戲',
    title: '一個人也能完成一局練習',
    description: '從短局玩法開始，熟悉館藏細節、記憶與判斷，再送出本次成績。',
    steps: [
      { label: '01', title: '選擇一種玩法', description: '從下方的短局玩法中，挑一種你想先試試看的模式。' },
      { label: '02', title: '完成畫面上的任務', description: '依照提示找文物、翻牌配對，或把畫面排回正確順序。' },
      { label: '03', title: '送出結果', description: '完成任務後送出結果，系統會顯示本次成績與獎勵。' },
      { label: '04', title: '換個玩法再試一次', description: '回到玩法列表，繼續挑戰其他短局模式。' }
    ]
  }
};

@Component({
  selector: 'app-game-how-to',
  standalone: true,
  templateUrl: './game-how-to.component.html',
  styleUrl: './game-how-to.component.scss'
})
export class GameHowToComponent {
  readonly variant = input<GameHowToVariant>('multiplayer');
  readonly openByDefault = input(false);
  readonly content = computed(() => HOW_TO_CONTENT[this.variant()]);
}
