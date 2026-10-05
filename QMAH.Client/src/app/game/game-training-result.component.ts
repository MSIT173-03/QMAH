import { GameAudio } from './game-audio.service';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { CatalogService } from '../services/catalog-service';
import { RouterLink } from '@angular/router';

import { MiniGameArtifact, MiniGameComplete, MiniGameMode, MiniGameStart } from './game.models';
import { GameScrollPanelComponent } from './game-scroll-panel.component';
import { GameResultTallyComponent } from './game-result-tally.component';
import { GameResultRulesComponent } from './game-result-rules.component';

@Component({
  selector: 'app-game-training-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GameScrollPanelComponent, GameResultTallyComponent, GameResultRulesComponent],
  templateUrl: './game-training-result.component.html',
  styleUrl: './game-training-result.component.scss'
})
export class GameTrainingResultComponent {
  private readonly victory = inject(GameAudio).play('win');
  /** 玩家已解鎖的文物：沒解鎖的文物名稱不能點進圖鑑。 */
  readonly unlocked = signal<ReadonlySet<string>>(new Set());
  private readonly unlockLoader = inject(CatalogService).getMyArtifactUnlocks().pipe(catchError(() => of([])), takeUntilDestroyed(inject(DestroyRef)))
    .subscribe(records => this.unlocked.set(new Set(records.map(record => record.artifactId.toLowerCase()))));
  readonly attempt = input.required<MiniGameStart>();
  readonly mode = input<MiniGameMode | null>(null);
  readonly complete = input.required<MiniGameComplete>();
  readonly title = input.required<string>();
  /** S、A 級有慶祝：彩紙從獎牌噴出來，獎牌後面的光暈會呼吸。 */
  readonly celebrate = computed(() => ['S', 'A'].includes(this.complete().grade));
  readonly stars = computed(() => ({ S: 3, A: 2, B: 1 } as Record<string, number>)[this.complete().grade] ?? 0);
  readonly headline = computed(() => ({ S: '完美表現！', A: '表現亮眼！', B: '順利達標', C: '完成挑戰', FAIL: '再接再厲' } as Record<string, string>)[this.complete().grade] ?? '完成挑戰');
  readonly confetti = Array.from({ length: 30 }, (_, index) => {
    const angle = (index / 30) * Math.PI * 2 + (index % 3) * .3;
    const reach = 90 + (index * 37) % 90;
    return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach * .8 - 30), rot: (index * 97) % 540 - 270, delay: (index * 23) % 260, color: ['#f0c24a', '#4370b6', '#d8605a', '#8bd6a4', '#fff8e9'][index % 5] };
  });
  readonly difficultyLabel = computed(() => /-(h|m)$/.test(this.attempt().seed) ? '困難' : /-(e|r)$/.test(this.attempt().seed) ? '簡單' : '');
  readonly artifacts = input<MiniGameArtifact[]>([]);
  readonly elapsedLabel = input('00:00');
  readonly moves = input(0);
  readonly hintsUsed = input(0);
  readonly autoPlaced = input(0);
  readonly starting = input(false);
  readonly failedImageKeys = input<string[]>([]);

  readonly playAgain = output<void>();
  readonly showModeList = output<void>();
  readonly imageFailed = output<string>();

  imageUnavailable(key: string): boolean { return this.failedImageKeys().includes(key); }
}
