import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { GameAudio } from './game-audio.service';

// 聲音設定：音樂、音效各有開關與音量拉條。放在模式列時是往下展開的浮動面板，放在對話框裡時直接攤開。
@Component({
  selector: 'app-game-audio-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-no-sound': '', '[class.is-inline]': 'inline()' },
  template: `
    <details class="audio-menu" [open]="inline() || null">
      <summary><span>聲音</span><b [class.is-on]="audio.musicOn() || audio.sfxOn()">{{ audio.musicOn() || audio.sfxOn() ? '開' : '關' }}</b></summary>
      <div class="audio-panel">
        <div class="audio-row">
          <button type="button" [attr.aria-pressed]="audio.musicOn()" (click)="audio.toggleMusic()">音樂<b>{{ audio.musicOn() ? '開' : '關' }}</b></button>
          <input type="range" min="0" max="100" step="5" aria-label="音樂音量" [value]="audio.musicVolume() * 100" [disabled]="!audio.musicOn()" (input)="audio.setMusicVolume(+$any($event.target).value / 100)" />
        </div>
        <div class="audio-row">
          <button type="button" [attr.aria-pressed]="audio.sfxOn()" (click)="audio.toggleSfx()">音效<b>{{ audio.sfxOn() ? '開' : '關' }}</b></button>
          <input type="range" min="0" max="100" step="5" aria-label="音效音量" [value]="audio.sfxVolume() * 100" [disabled]="!audio.sfxOn()" (input)="audio.setSfxVolume(+$any($event.target).value / 100)" (change)="audio.previewSfx()" />
        </div>
      </div>
    </details>
  `,
  styleUrl: './game-audio-toggle.component.scss'
})
export class GameAudioToggleComponent {
  protected readonly audio = inject(GameAudio);
  readonly inline = input(false);
}
