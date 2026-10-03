import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface GameGuideDemoAnswer {
  author: string;
  category: string;
  text: string;
  votes: number;
}

@Component({
  selector: 'app-game-guide-multiplayer-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-guide-multiplayer-demo.component.html',
  styleUrl: './game-guide-multiplayer-demo.component.scss'
})
export class GameGuideMultiplayerDemoComponent {
  readonly submitted = input.required<boolean>();
  readonly revealed = input.required<boolean>();
  readonly response = input.required<string>();
  readonly selectedAnswer = input.required<number | null>();
  readonly answers = input.required<readonly GameGuideDemoAnswer[]>();

  readonly responseChange = output<string>();
  readonly submitResponse = output<void>();
  readonly selectedAnswerChange = output<number>();
  readonly reveal = output<void>();
  readonly restart = output<void>();
}
