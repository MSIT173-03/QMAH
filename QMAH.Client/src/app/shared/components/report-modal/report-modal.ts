import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { SocialApiService } from '../../../core/services/social-api';

// 共用的檢舉彈窗：呼叫端用 open(targetType, targetId) 開啟，選擇理由並可填寫詳細說明，
// 送出直接呼叫 POST /api/v1/social/reports，成功透過 (reported) 通知呼叫端（例如關閉其他狀態）。
@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-modal.html'
})
export class ReportModalComponent {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  @Output() reported = new EventEmitter<void>();

  @ViewChild('dialogEl') private dialogEl!: ElementRef<HTMLDialogElement>;

  // 對應後台 AdminDisplayLabels.ReportReason 使用的既有理由代碼，讓檢舉紀錄在後台能顯示正確中文標籤。
  readonly reasons: { value: string; label: string }[] = [
    { value: 'SPAM', label: '垃圾內容' },
    { value: 'HARASSMENT', label: '騷擾或攻擊' },
    { value: 'ILLEGAL_CONTENT', label: '不當或違法內容' },
    { value: 'MISINFORMATION', label: '錯誤資訊' },
    { value: 'COPYRIGHT', label: '著作權問題' },
    { value: 'OTHER', label: '其他' }
  ];

  targetType: 'POST' | 'COMMENT' = 'POST';
  private targetId = '';
  reason = 'SPAM';
  detail = '';
  submitting = false;
  error: string | null = null;

  open(targetType: 'POST' | 'COMMENT', targetId: string): void {
    this.targetType = targetType;
    this.targetId = targetId;
    this.reason = 'SPAM';
    this.detail = '';
    this.error = null;
    this.submitting = false;
    this.dialogEl.nativeElement.showModal();
  }

  submit(): void {
    this.submitting = true;
    this.error = null;
    this.socialApi
      .createReport({ targetType: this.targetType, targetId: this.targetId, reason: this.reason, detail: this.detail || undefined })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.dialogEl.nativeElement.close();
          this.reported.emit();
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          this.error =
            err.status === 401
              ? '檢舉失敗：請先登入。'
              : err.status === 409
                ? '檢舉失敗：這則內容已經有一筆待處理的檢舉了。'
                : '檢舉失敗，請稍後再試。';
          this.cdr.detectChanges();
        }
      });
  }

  close(): void {
    this.dialogEl.nativeElement.close();
  }
}
