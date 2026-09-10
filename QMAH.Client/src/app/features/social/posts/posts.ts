import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface Post {
  id: string;
  title: string;
  content: string;
  boardCode: string;
  commentCount?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './posts.html',
  styleUrl: './posts.scss'
})
export class PostsComponent implements OnInit {
  private http = inject(HttpClient);

  // 清空 Mock 資料，由 DB 填入
  posts: Post[] = [];
  newPost = { title: '', boardCode: 'GENERAL', content: '' };

  ngOnInit(): void {
    this.loadPosts();
  }

  // 1. 發送 GET 請求向 DB 取資料
  loadPosts(): void {
    this.http.get<Post[]>('/api/v1/social/posts').subscribe({
      next: (data) => {
        this.posts = data;
        console.log('成功從 DB 取得貼文:', data);
      },
      error: (err) => console.error('取得貼文失敗:', err)
    });
  }

  // 2. 發送 POST 新增貼文
  submitPost(): void {
    this.http.post('/api/v1/social/posts', this.newPost).subscribe({
      next: () => {
        alert('貼文發布成功！');
        this.newPost = { title: '', boardCode: 'GENERAL', content: '' };
        this.loadPosts(); // 重新整理列表
      },
      error: (err) => console.error('發布貼文失敗:', err)
    });
  }

  // 3. 發送 POST 檢舉
  report(id: string): void {
    this.http.post('/api/v1/social/reports', { targetType: 'POST', targetId: id }).subscribe({
      next: () => alert(`已成功檢舉 Post #${id}`),
      error: (err) => console.error('檢舉失敗:', err)
    });
  }
}
