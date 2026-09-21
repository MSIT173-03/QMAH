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
    description: '多人房間會把同一件文物交給大家觀察；每個人先作答，再讀取其他回答並投票，最後查看回合揭曉與整場結果。',
    steps: [
      { label: '01', title: '選房／建立', description: '選一間可加入的房間，或建立新房間並等待玩家加入。' },
      { label: '02', title: '觀察文物', description: '房間開始後，所有玩家查看本回合的館藏與題目。' },
      { label: '03', title: '作答', description: '在作答時間內寫下自己的判斷；每回合每人作答一次。' },
      { label: '04', title: '讀取回答', description: '作答時間結束後，查看其他玩家的回答內容。' },
      { label: '05', title: '投票', description: '不能投自己的回答，每次可投 1 至 3 票，選出最有說服力的說法。' },
      { label: '06', title: '揭曉／結算', description: '查看本回合得票與勝出者，完成所有回合後查看整場結果與獎勵。' }
    ]
  },
  training: {
    eyebrow: '單人小遊戲',
    title: '一個人完成一局挑戰',
    description: '從單人模式選一種玩法，依照畫面提示辨識文物或完成操作任務，送出後立即查看成績與既有獎勵。',
    steps: [
      { label: '01', title: '選模式', description: '從目前啟用的單人玩法中選擇一種挑戰。' },
      { label: '02', title: '觀察或操作任務', description: '看線索辨識文物、完成 5×5 拼圖、翻開 16 張牌配對，或整理 3×5 長卷段落。' },
      { label: '03', title: '送出答案', description: '完成畫面上的任務後，送出這一局的答案與操作結果。' },
      { label: '04', title: '顯示成績與既有獎勵', description: '系統立即顯示分數、等級、點數與鑰匙進度；獎勵額度用完時仍會保留成績。' }
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
