import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';

// 共用的圖片裁切彈窗：呼叫端用 open(file) 開啟，裁切確認後透過 (cropped) 拿回裁切後的 File，
// 取消則透過 (cancelled) 通知（呼叫端可以選擇跳過裁切、直接用原圖上傳）。
@Component({
  selector: 'app-image-crop-modal',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './image-crop-modal.html',
  styleUrl: './image-crop-modal.scss'
})
export class ImageCropModalComponent {
  @Output() cropped = new EventEmitter<File>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('dialogEl') private dialogEl!: ElementRef<HTMLDialogElement>;

  imageFile: File | null = null;
  private fileName = 'image.jpg';
  private latestCroppedBlob: Blob | null = null;

  open(file: File): void {
    this.imageFile = file;
    this.fileName = file.name;
    this.latestCroppedBlob = null;
    this.dialogEl.nativeElement.showModal();
  }

  onImageCropped(event: ImageCroppedEvent): void {
    this.latestCroppedBlob = event.blob ?? null;
  }

  confirm(): void {
    const file = this.latestCroppedBlob
      ? new File([this.latestCroppedBlob], this.fileName, {
          type: this.latestCroppedBlob.type || 'image/jpeg'
        })
      : this.imageFile;
    // 先關閉目前圖片，再通知呼叫端。呼叫端可能立刻開啟佇列的下一張。
    this.dialogEl.nativeElement.close();
    if (file) this.cropped.emit(file);
  }

  skip(): void {
    const file = this.imageFile;
    this.dialogEl.nativeElement.close();
    if (file) this.cropped.emit(file);
  }

  cancel(): void {
    this.dialogEl.nativeElement.close();
    this.cancelled.emit();
  }
}
