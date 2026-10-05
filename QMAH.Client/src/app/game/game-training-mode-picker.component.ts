import { GameScoringGuideComponent } from './game-scoring-guide.component';
import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild, model } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MiniGameMode } from './game.models';
import { GameTrainingModeCardComponent } from './game-training-mode-card.component';

@Component({
  selector: 'app-game-training-mode-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameScoringGuideComponent, RouterLink, GameTrainingModeCardComponent],
  templateUrl: './game-training-mode-picker.component.html',
  styleUrl: './game-training-mode-picker.component.scss'
})
export class GameTrainingModePickerComponent {
  readonly authRequired = input(false);
  readonly modes = input<MiniGameMode[]>([]);
  readonly selectedMode = input<MiniGameMode | null>(null);
  readonly starting = input(false);
  readonly quickStart = input(false);

  readonly modeSelected = output<string>();
  readonly startMode = output<MiniGameMode>();
  readonly retryModes = output<void>();
  readonly modeRail = viewChild<ElementRef<HTMLOListElement>>('modeRail');

  chooseMode(code: string): void {
    if (this.starting()) return;
    this.modeSelected.emit(code);
    const rail = this.modeRail()?.nativeElement;
    const index = this.modes().findIndex(mode => mode.code === code);
    const item = rail?.children[index] as HTMLElement | undefined;
    if (rail && item && rail.scrollWidth > rail.clientWidth) {
      rail.scrollTo({ left: item.offsetLeft - (rail.clientWidth - item.clientWidth) / 2,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }

  // 手機寬度下用滑鼠也能左右拖動（觸控本來就能滑）；拖動後不要誤觸卡片的點擊
  dragging = false;
  private dragFrom: { x: number; left: number } | null = null;
  private dragMoved = false;
  private clickGuard = false;

  dragStart(event: PointerEvent): void {
    const rail = this.modeRail()?.nativeElement;
    if (!rail || event.pointerType !== 'mouse' || event.button !== 0 || rail.scrollWidth <= rail.clientWidth) return;
    if (!this.clickGuard) {
      this.clickGuard = true;
      rail.addEventListener('click', e => { if (this.dragMoved) { e.stopPropagation(); e.preventDefault(); this.dragMoved = false; } }, true);
    }
    this.dragFrom = { x: event.clientX, left: rail.scrollLeft };
    this.dragMoved = false;
  }

  dragMove(event: PointerEvent): void {
    const rail = this.modeRail()?.nativeElement;
    if (!rail || !this.dragFrom) return;
    const dx = event.clientX - this.dragFrom.x;
    if (!this.dragging && Math.abs(dx) < 6) return;
    if (!this.dragging) { this.dragging = true; this.dragMoved = true; rail.setPointerCapture(event.pointerId); }
    rail.scrollLeft = this.dragFrom.left - dx;
  }

  dragEnd(): void {
    const rail = this.modeRail()?.nativeElement;
    this.dragFrom = null;
    if (!this.dragging || !rail) return;
    this.dragging = false;
    // 放開後吸附到最近的一張牌並選中它
    const center = rail.scrollLeft + rail.clientWidth / 2;
    const items = Array.from(rail.children) as HTMLElement[];
    const index = items.reduce((best, item, i) => Math.abs(item.offsetLeft + item.clientWidth / 2 - center) < Math.abs(items[best].offsetLeft + items[best].clientWidth / 2 - center) ? i : best, 0);
    if (this.modes()[index]) this.chooseMode(this.modes()[index].code);
  }

  settleMode(): void {
    const rail = this.modeRail()?.nativeElement;
    if (!rail || rail.scrollWidth <= rail.clientWidth || this.starting()) return;
    const center = rail.scrollLeft + rail.clientWidth / 2;
    const items = Array.from(rail.children) as HTMLElement[];
    const index = items.reduce((best, item, index) =>
      Math.abs(item.offsetLeft + item.clientWidth / 2 - center) < Math.abs(items[best].offsetLeft + items[best].clientWidth / 2 - center) ? index : best, 0);
    if (this.modes()[index]) this.modeSelected.emit(this.modes()[index].code);
  }

  get selectedModeIndex(): number {
    const index = this.modes().findIndex(mode => mode.code === this.selectedMode()?.code);
    return index < 0 ? 0 : index;
  }

  stepMode(direction: -1 | 1): void {
    const mode = this.modes()[this.selectedModeIndex + direction];
    if (mode) this.chooseMode(mode.code);
  }

  /** 卡片說明統一兩行：第一行做什麼，第二行簡單與困難差在哪。 */
  modeMechanic(code: string): readonly [string, string] {
    return ({
      DETAIL_LOCATOR: ['看準心，在原圖上點出同一位置。', '簡單有區域提示，困難全靠眼力。'],
      MEMORY_MATCH: ['翻開 16 張牌，配出 8 組相同文物。', '先看牌面 5 秒，簡單可求助，困難不行。'],
      ARTIFACT_PUZZLE: ['把 25 塊碎片拖進格子，拼回原圖。', '簡單可對照原圖，困難只先看 10 秒。'],
      STRIP_RESTORE: ['把 15 片碎片排回原位，拼回原畫。', '簡單相鄰兩片交換，困難滑進空格。']
    } as Record<string, readonly [string, string]>)[code] ?? ['完成盤面後送出結果。', '開始前選簡單或困難。'];
  }
  modeDescription(mode: MiniGameMode): readonly [string, string] {
    const descriptions: Record<string, readonly [string, string]> = {
      DETAIL_LOCATOR: ['看細節，在原圖選出位置。', '四件各確認一次，再結算。'],
      MEMORY_MATCH: ['翻開 16 張牌，找齊配對。', '記住圖樣位置，配對再送出。'],
      ARTIFACT_PUZZLE: ['拖曳 25 塊，拼回原圖。', '可看原圖或提示，再送出。'],
      STRIP_RESTORE: ['滑動碎片進空格。', '拼回原圖，再送出。']
    };
    return descriptions[mode.code] ?? ['開始一局挑戰。', '完成盤面後送出結果。'];
  }
  navigateModes(event: KeyboardEvent): void {
    const modes = this.modes();
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || this.starting() || !modes.length) return;
    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = (index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length;
    this.chooseMode(modes[next].code);
    buttons[next].focus();
  }
}
