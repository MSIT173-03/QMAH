import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialPostRequest, SocialApiService, SocialPostListItem } from '../../../core/services/social-api';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './posts.html',
  styleUrl: './posts.scss'
})
export class PostsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  posts: SocialPostListItem[] = [];
  totalCount = 0;
  loadError: string | null = null;
  createError: string | null = null;
  newPost: CreateSocialPostRequest = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '' };

  ngOnInit(): void {
    this.loadPosts();
  }

  // GET /api/v1/social/posts（AllowAnonymous，回傳 ApiPage<SocialPostListItemDto>）
  loadPosts(): void {
    this.loadError = null;
    this.socialApi.getPosts({ pageSize: 20 }).subscribe({
      next: (page) => {
        this.posts = page.items;
        this.totalCount = page.totalCount;
      },
      error: (err: HttpErrorResponse) => {
        this.loadError = '取得貼文失敗，請稍後再試。';
        console.error('取得貼文失敗:', err);
      }
    });
  }

  // POST /api/v1/social/posts（需要登入 + XSRF token）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitPost(): void {
    this.createError = null;
    this.socialApi.createPost(this.newPost).subscribe({
      next: () => {
        this.newPost = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '' };
        this.loadPosts();
        (document.getElementById('create_post_modal') as HTMLDialogElement | null)?.close();
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '發布失敗：請先登入。' : '發布貼文失敗，請確認欄位是否正確。';
        console.error('發布貼文失敗:', err);
      }
    });
  }

  report(id: string): void {
    this.createError = null;
    this.socialApi.createReport({ targetType: 'POST', targetId: id, reason: '使用者檢舉' }).subscribe({
      next: () => alert(`已成功檢舉貼文 #${id}`),
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '檢舉失敗：請先登入。' : '檢舉失敗，請稍後再試。';
        console.error('檢舉失敗:', err);
      }
    });
  }
}
