import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { GameAnswer } from './game.models';
import { QmahIconComponent, QmahIconName } from '../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-game-answer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QmahIconComponent],
  templateUrl: './game-answer-card.component.html',
  styleUrl: './game-answer-card.component.scss'
})
export class GameAnswerCardComponent {
  readonly answer = input.required<GameAnswer>();
  readonly groupLabel = input.required<string>();
  readonly icon = input.required<QmahIconName>();
  readonly anonymous = input(false);
  readonly mobile = input(false);
  readonly order = input(0);
  readonly position = input(1);
  readonly count = input(1);
  readonly ownerColor = input('#376d62');
  readonly tilt = input('0deg');
  readonly selected = output<GameAnswer>();
}
