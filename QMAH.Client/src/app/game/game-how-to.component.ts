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
    title: '從選房到回合結算',
    description: '每回合所有玩家觀察同一件文物。先寫下自己的判斷，再閱讀其他玩家的匿名回答並投票。投票結束後揭曉作者與得票，所有回合結束後查看整場結果。',
    steps: [
      { label: '01', title: '選房／建立', description: '選一間可加入的房間，或建立新房間並等待玩家加入。' },
      { label: '02', title: '觀察文物', description: '房間開始後，所有玩家查看本回合的館藏與題目。' },
      { label: '03', title: '作答', description: '選擇史實推理、擬真異說或妙想奇談，再寫下回答。史實推理推測真實名稱、用途、年代或背景。擬真異說是看似合理的虛構說明。妙想奇談是幽默、誇張或有故事性的回答。每回合每人只能送出一次。' },
      { label: '04', title: '查看回答', description: '作答時間結束後，查看其他玩家的回答內容。' },
      { label: '05', title: '投票', description: '每則回答可投一次，每次可投 1 至 3 票。不能投自己的回答。' },
      { label: '06', title: '揭曉／結算', description: '查看本回合得票與勝出者，完成所有回合後查看整場結果與獎勵。' }
    ]
  },
  training: {
    eyebrow: '單人小遊戲',
    title: '一個人完成一局挑戰',
    description: '選一種玩法，依照提示辨識文物、配對或拼圖。完成後按「送出結果」，查看成績與本局獎勵。',
    steps: [
      { label: '01', title: '選模式', description: '從目前啟用的單人玩法中選擇一種挑戰。' },
      { label: '02', title: '完成挑戰', description: '依選擇的玩法辨識細節、翻牌配對，或將文物與書畫碎片放回原圖位置。' },
      { label: '03', title: '送出答案', description: '完成畫面上的任務後，送出這一局的答案與操作結果。' },
      { label: '04', title: '查看成績與獎勵', description: '查看分數、等級、鑑定點數與鑰匙進度。每日點數已滿後，成績與鑰匙進度仍會保留。' }
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
  sentences(text: string): string[] { return text.split('。').filter(sentence => sentence.trim()).map(sentence => sentence + '。'); }
  readonly variant = input<GameHowToVariant>('multiplayer');
  readonly content = computed(() => HOW_TO_CONTENT[this.variant()]);
}
