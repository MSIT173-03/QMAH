import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MiniGameMode } from './game.models';
import { GameRewardMeterComponent } from './game-reward-meter.component';
import { GameTrainingModeCardComponent } from './game-training-mode-card.component';

@Component({
  selector: 'app-game-training-mode-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GameRewardMeterComponent, GameTrainingModeCardComponent],
  templateUrl: './game-training-mode-picker.component.html',
  styleUrl: './game-training-mode-picker.component.scss'
})
export class GameTrainingModePickerComponent {
  readonly authRequired = input(false);
  readonly modes = input<MiniGameMode[]>([]);
  readonly selectedMode = input<MiniGameMode | null>(null);
  readonly starting = input(false);

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

  modeMechanic(code: string): string {
    return ({
      DETAIL_LOCATOR: '看四件文物的局部特徵，逐件在原圖點出位置。',
      MEMORY_MATCH: '翻開 4×4 牌面，記住位置並配對八組文物。',
      ARTIFACT_PUZZLE: '拖曳 25 塊碎片至目標格，拼回文物原圖。',
      STRIP_RESTORE: '依原作拖曳 15 段書畫，接回連續筆墨與景物。'
    } as Record<string, string>)[code] ?? '開始一場館藏挑戰。';
  }
  modeDescription(mode: MiniGameMode): string {
    return mode.code === 'DETAIL_LOCATOR'
      ? '一輪四件文物，看細節後點原圖定位，每件作答一次。依定位正確率計分，記錄本輪用時，區域提示每件扣 10 分。'
      : mode.description || this.modeMechanic(mode.code);
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
