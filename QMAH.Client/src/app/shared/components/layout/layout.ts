import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { DevLoginComponent } from '../../../dev-tools/dev-login/dev-login';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, DevLoginComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent {}
