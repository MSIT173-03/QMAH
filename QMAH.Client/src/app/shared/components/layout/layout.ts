import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { DevLoginComponent } from '../../../dev-tools/dev-login/dev-login';
import { MeApiService } from '../../../core/services/me-api';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell';
import { ToastContainerComponent } from '../toast-container/toast-container';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, DevLoginComponent, NotificationsBellComponent, ToastContainerComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent implements OnInit {
  meApi = inject(MeApiService);

  ngOnInit(): void {
    this.meApi.refresh();
  }
}
