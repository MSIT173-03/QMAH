import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CatalogService } from '../services/catalog-service';
import { CatalogModel } from '../models/catalog-model';

@Component({
  selector: 'app-artifact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './artifact-form-compoent.html'
})
export class ArtifactFormComponent implements OnInit, OnChanges {
  @Input() catalogModel: CatalogModel | null = null; // 父元件傳入：null = 新增，有值 = 編輯
  @Output() saved = new EventEmitter<void>();       // 存檔成功時發出
  @Output() cancelled = new EventEmitter<void>();   // 取消時發出

  form: FormGroup;
  submitting = false;
  errorMsg = '';
  artifactService: any;

  constructor(
    private fb: FormBuilder,
    private catalogService: CatalogService
  ) {
    // 建立表單結構與驗證規則
    this.form = this.fb.group({
      artifactRef: ['', Validators.required],
      name: ['', Validators.required],
      categoryCode: ['', Validators.required],
      categoryName: ['', Validators.required],
      eraCode: ['', Validators.required],
      eraName: ['', Validators.required],
      thumbnailPath: [''],
      hasQuestionEntry: [false],
      hasShopProduct: [false]
    });
  }

  ngOnInit(): void {
    this.patchFormIfEditing();
  }

  // 當父元件傳入的 CatalogModel 改變時（例如切換編輯不同筆資料），重新帶入表單
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['CatalogModel']) {
      this.patchFormIfEditing();
    }
  }

  private patchFormIfEditing(): void {
    if (this.catalogModel) {
      this.form.patchValue(this.catalogModel); // 編輯模式：帶入既有資料
    } else {
      this.form.reset({ hasQuestionEntry: false, hasShopProduct: false }); // 新增模式：清空表單
    }
  }

  get isEditMode(): boolean {
    return this.catalogModel !== null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // 強制顯示所有欄位的驗證錯誤訊息
      return;
    }

    this.submitting = true;
    this.errorMsg = '';
    const formValue = this.form.value;

    const request$ = this.isEditMode
      ? this.catalogService.patchArtifact(this.catalogModel!.id, formValue)
      : this.artifactService.createArtifact(formValue);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.saved.emit(); // 通知父元件：存檔完成
      },
      error: (err: { message: string; }) => {
        this.submitting = false;
        this.errorMsg = err.message;
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
