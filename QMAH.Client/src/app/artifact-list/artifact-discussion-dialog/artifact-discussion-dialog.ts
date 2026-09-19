import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-artifact-discussion-dialog',
  imports: [FormsModule],
  templateUrl: './artifact-discussion-dialog.html',
  styleUrl: './artifact-discussion-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtifactDiscussionDialog {
  // 這個視窗只接收父層狀態，不自行查詢 API，讓圖鑑與社群規則仍集中在頁面／服務層。
  open = input(false);
  artifactName = input.required<string>();
  initialComment = input('');
  busy = input(false);
  errorMessage = input('');

  commentChanged = output<string>();
  cancelled = output<void>();
  submitted = output<void>();
  backdropClicked = output<MouseEvent>();
}
