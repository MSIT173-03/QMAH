import { Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GameHowToComponent, GameHowToVariant } from './game-how-to.component';
import { GameNavigationComponent } from './game-navigation.component';

type TrainingDemoCode = 'DETAIL_LOCATOR' | 'MEMORY_MATCH' | 'ARTIFACT_PUZZLE' | 'STRIP_RESTORE';

interface MemoryDemoCard {
  id: string;
  pairId: string;
  label: string;
  image: string;
  revealed: boolean;
  matched: boolean;
}

const DEMO_ARTIFACT_IMAGE = '/images/login/real/cloisonne-tripod-incense-burner.jpg';
const MEMORY_DEMO_IMAGES = [
  { id: 'cloisonne', label: '掐絲琺瑯文物', image: DEMO_ARTIFACT_IMAGE },
  { id: 'tang-figure', label: '唐代文物', image: '/assets/game/tang-wang.jpg' },
  { id: 'ceramic-vase', label: '陶瓷方瓶', image: '/assets/game/ceramic-square-vase.jpg' },
  { id: 'scroll-a', label: '畫卷片段甲', image: '/images/login/real/qingming-iiif/segment-SDAAA-compact.jpg' },
  { id: 'scroll-b', label: '畫卷片段乙', image: '/images/login/real/qingming-iiif/segment-SDAAB-compact.jpg' },
  { id: 'scroll-c', label: '畫卷片段丙', image: '/images/login/museum/qingming-court/segment-01.webp' },
  { id: 'scroll-d', label: '畫卷片段丁', image: '/images/login/museum/qingming-court/segment-06.webp' },
  { id: 'scroll-e', label: '畫卷片段戊', image: '/images/login/museum/qingming-court/segment-10.webp' },
] as const;

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function createMemoryDemoCards(): MemoryDemoCard[] {
  return shuffled(MEMORY_DEMO_IMAGES.flatMap((image) => [0, 1].map((copy) => ({
    id: `${image.id}-${copy}`,
    pairId: image.id,
    label: image.label,
    image: image.image,
    revealed: false,
    matched: false,
  }))));
}

function createDemoOrder(length: number): number[] {
  return shuffled(Array.from({ length }, (_, index) => index));
}

@Component({
  selector: 'app-game-guide',
  standalone: true,
  imports: [RouterLink, GameHowToComponent, GameNavigationComponent],
  templateUrl: './game-guide.component.html',
  styleUrl: './game-guide.component.scss'
})
export class GameGuideComponent implements OnDestroy {
  // 說明頁一次呈現一種玩法；每個示範只用本機樣本，不會建立正式挑戰或發放獎勵。
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

  readonly trainingModes = [
    { code: 'DETAIL_LOCATOR', label: '局部辨識', hint: '看一小塊線索，挑出相似文物' },
    { code: 'MEMORY_MATCH', label: '翻牌配對', hint: '記住圖樣位置，找齊配對' },
    { code: 'ARTIFACT_PUZZLE', label: '館藏拼圖', hint: '交換碎片，拼回文物原圖' },
    { code: 'STRIP_RESTORE', label: '長卷復位', hint: '整理 15 格畫面順序' },
  ] as const;
  readonly activeTrainingDemo = signal<TrainingDemoCode>('DETAIL_LOCATOR');
  readonly trainingChoices = [
    { name: '掐絲琺瑯雲龍紋三足香爐', correct: true },
    { name: '同類型的掐絲琺瑯鼎式爐', correct: false },
    { name: '同為三足的銅胎畫琺瑯爐', correct: false },
    { name: '同有雲龍紋的掐絲琺瑯雙耳爐', correct: false },
  ] as const;
  readonly selectedTrainingChoice = signal<number | null>(null);
  readonly trainingRevealed = signal(false);

  readonly memoryDemoCards = signal(createMemoryDemoCards());
  readonly memoryDemoOpen = signal<number[]>([]);
  readonly memoryDemoMoves = signal(0);
  readonly memoryDemoPairCount = MEMORY_DEMO_IMAGES.length;
  readonly memoryDemoMatchedPairs = computed(() => this.memoryDemoCards().filter((card) => card.matched).length / 2);
  readonly memoryDemoComplete = computed(() => this.memoryDemoCards().length > 0 && this.memoryDemoCards().every((card) => card.matched));
  readonly puzzleDemoOrder = signal(createDemoOrder(25));
  readonly puzzleDemoSelection = signal<number | null>(null);
  readonly puzzleDemoMoves = signal(0);
  readonly puzzleDemoComplete = computed(() => this.puzzleDemoOrder().every((piece, slot) => piece === slot));
  readonly stripDemoOrder = signal(createDemoOrder(15));
  readonly stripDemoSelection = signal<number | null>(null);
  readonly stripDemoMoves = signal(0);
  readonly stripDemoComplete = computed(() => this.stripDemoOrder().every((piece, slot) => piece === slot));
  private memoryDemoTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.memoryDemoTimer !== null) clearTimeout(this.memoryDemoTimer);
  }

  selectGuide(variant: GameHowToVariant): void {
    this.activeGuide.set(variant);
  }

  selectTrainingDemo(code: TrainingDemoCode): void {
    this.activeTrainingDemo.set(code);
  }

  submitTrainingDemo(): void {
    if (this.selectedTrainingChoice() !== null) this.trainingRevealed.set(true);
  }

  submitDemoResponse(): void {
    if (this.demoResponse().trim()) this.demoSubmitted.set(true);
  }

  restartTrainingDemo(): void {
    this.selectedTrainingChoice.set(null);
    this.trainingRevealed.set(false);
  }

  flipMemoryDemo(index: number): void {
    if (this.memoryDemoTimer !== null) return;
    const cards = this.memoryDemoCards();
    const card = cards[index];
    if (!card || card.revealed || card.matched) return;

    this.memoryDemoCards.set(cards.map((item, cardIndex) => cardIndex === index ? { ...item, revealed: true } : item));
    const open = [...this.memoryDemoOpen(), index];
    this.memoryDemoOpen.set(open);
    if (open.length < 2) return;

    this.memoryDemoMoves.update((moves) => moves + 1);
    const [firstIndex, secondIndex] = open;
    const isMatch = cards[firstIndex].pairId === card.pairId;
    if (isMatch) {
      this.memoryDemoCards.update((current) => current.map((item, cardIndex) =>
        cardIndex === firstIndex || cardIndex === secondIndex ? { ...item, revealed: true, matched: true } : item));
      this.memoryDemoOpen.set([]);
      return;
    }

    this.memoryDemoTimer = setTimeout(() => {
      this.memoryDemoCards.update((current) => current.map((item, cardIndex) =>
        cardIndex === firstIndex || cardIndex === secondIndex ? { ...item, revealed: false } : item));
      this.memoryDemoOpen.set([]);
      this.memoryDemoTimer = null;
    }, 650);
  }

  restartMemoryDemo(): void {
    if (this.memoryDemoTimer !== null) clearTimeout(this.memoryDemoTimer);
    this.memoryDemoTimer = null;
    this.memoryDemoCards.set(createMemoryDemoCards());
    this.memoryDemoOpen.set([]);
    this.memoryDemoMoves.set(0);
  }

  selectDemoPiece(board: 'puzzle' | 'scroll', slot: number): void {
    const order = board === 'puzzle' ? this.puzzleDemoOrder : this.stripDemoOrder;
    const selection = board === 'puzzle' ? this.puzzleDemoSelection : this.stripDemoSelection;
    const selectedSlot = selection();
    if (selectedSlot === null) {
      selection.set(slot);
      return;
    }
    if (selectedSlot === slot) {
      selection.set(null);
      return;
    }

    order.update((current) => {
      const next = [...current];
      [next[selectedSlot], next[slot]] = [next[slot], next[selectedSlot]];
      return next;
    });
    selection.set(null);
    if (board === 'puzzle') this.puzzleDemoMoves.update((moves) => moves + 1);
    else this.stripDemoMoves.update((moves) => moves + 1);
  }

  restartPuzzleDemo(): void {
    this.puzzleDemoOrder.set(createDemoOrder(25));
    this.puzzleDemoSelection.set(null);
    this.puzzleDemoMoves.set(0);
  }

  restartStripDemo(): void {
    this.stripDemoOrder.set(createDemoOrder(15));
    this.stripDemoSelection.set(null);
    this.stripDemoMoves.set(0);
  }

  imagePiecePosition(piece: number, columns: number, rows: number): string {
    const column = piece % columns;
    const row = Math.floor(piece / columns);
    const x = columns === 1 ? 0 : (column / (columns - 1)) * 100;
    const y = rows === 1 ? 0 : (row / (rows - 1)) * 100;
    return `${x}% ${y}%`;
  }

  restartDemo(): void {
    this.demoResponse.set('');
    this.demoSubmitted.set(false);
    this.selectedDemoAnswer.set(null);
    this.demoRevealed.set(false);
  }
}
