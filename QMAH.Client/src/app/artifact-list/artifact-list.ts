// artifact-list.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogService } from '../services/catalog-service';
import { CatalogModel } from '../models/catalog-model';
import { ArtifactFormComponent } from '../artifact-form-compoent/artifact-form-compoent';

@Component({
  selector: 'app-artifact-list',
  standalone: true,
  imports: [CommonModule, ArtifactFormComponent],
  templateUrl: './artifact-list.html',
  styleUrl: './artifact-list.scss'
})
export class ArtifactList implements OnInit {
  // 用 signal() 取代一般屬性
  catalogModel = signal<CatalogModel[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  currentPage = signal(1);
  pageSize = 20;
  totalPages = signal(1);
  totalCount = signal(0);

  showForm = signal(false);
  editingArtifact = signal<CatalogModel | null>(null);

  // computed：畫面上「沒有資料」的判斷可以用 computed 衍生，不用另外手動維護
  isEmpty = computed(() => !this.loading() && !this.errorMsg() && this.catalogModel().length === 0);

  private baseImageUrl = 'https://localhost:7249/api/v1/catalog/artifacts';

  constructor(private catalogService: CatalogService) {}

  ngOnInit(): void {
    this.loadArtifacts();
  }

  loadArtifacts(): void {
    this.loading.set(true);
    this.catalogService.getArtifacts(this.currentPage(), this.pageSize).subscribe({
      next: (res) => {
        this.catalogModel.set(res.items);
        this.totalPages.set(res.totalPages);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.message);
        this.loading.set(false);
      }
    });
  }

  getImageUrl(path: string): string {
    return path;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadArtifacts();
  }

  onAddClick(): void {
    this.editingArtifact.set(null);
    this.showForm.set(true);
  }

  onEditClick(catalogModel: CatalogModel): void {
    this.editingArtifact.set(catalogModel);
    this.showForm.set(true);
  }

  onFormSaved(): void {
    this.showForm.set(false);
    this.loadArtifacts();
  }

  onFormCancelled(): void {
    this.showForm.set(false);
  }

  onDeleteClick(catalogModel: CatalogModel): void {
    const confirmed = confirm(`確定要刪除「${catalogModel.name}」嗎？此動作無法復原。`);
    if (!confirmed) return;

    this.catalogService.deleteArtifact(catalogModel.id).subscribe({
      next: () => {
        this.loadArtifacts();
      },
      error: (err) => {
        alert('刪除失敗：' + err.message);
      }
    });
  }

  trackByArtifactId(index: number, item: CatalogModel): string {
    return item.id;
  }
}
