import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';

// 共用的圖片裁切彈窗：呼叫端用 open(file) 開啟，裁切確認後透過 (cropped) 拿回裁切後的 File，
// 取消則透過 (cancelled) 通知（呼叫端可以選擇跳過裁切、直接用原圖上傳）。
@Component({
  selector: 'app-image-crop-modal',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './image-crop-modal.html'
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
    if (this.latestCroppedBlob) {
      const croppedFile = new File([this.latestCroppedBlob], this.fileName, {
        type: this.latestCroppedBlob.type || 'image/jpeg'
      });
      this.cropped.emit(croppedFile);
    } else if (this.imageFile) {
      // 裁切器還沒產生結果（例如使用者沒有拖動裁切框）就直接用原圖
      this.cropped.emit(this.imageFile);
    }
    this.dialogEl.nativeElement.close();
  }

  skip(): void {
    if (this.imageFile) this.cropped.emit(this.imageFile);
    this.dialogEl.nativeElement.close();
  }

  cancel(): void {
    this.cancelled.emit();
    this.dialogEl.nativeElement.close();
  }
}
