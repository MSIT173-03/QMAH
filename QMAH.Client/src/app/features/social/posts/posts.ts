import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CreateSocialPostRequest, SocialApiService, SocialPostListItem } from '../../../core/services/social-api';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './posts.html',
  styleUrl: './posts.scss'
})
export class PostsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  posts: SocialPostListItem[] = [];
  totalCount = 0;
  newPost: CreateSocialPostRequest = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '' };

  ngOnInit(): void {
    this.loadPosts();
  }

  // GET /api/v1/social/posts（AllowAnonymous，回傳 ApiPage<SocialPostListItemDto>）
  loadPosts(): void {
    this.socialApi.getPosts({ pageSize: 20 }).subscribe({
      next: (page) => {
        this.posts = page.items;
        this.totalCount = page.totalCount;
      },
      error: (err) => console.error('取得貼文失敗:', err)
    });
  }

  // POST /api/v1/social/posts（需要登入 + XSRF token）
  submitPost(): void {
    this.socialApi.createPost(this.newPost).subscribe({
      next: () => {
        alert('貼文發布成功！');
        this.newPost = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '' };
        this.loadPosts();
      },
      error: (err) => console.error('發布貼文失敗（請確認已登入）:', err)
    });
  }

  report(id: string): void {
    this.socialApi.createReport({ targetType: 'POST', targetId: id, reason: '使用者檢舉' }).subscribe({
      next: () => alert(`已成功檢舉貼文 #${id}`),
      error: (err) => console.error('檢舉失敗（請確認已登入）:', err)
    });
  }
}
