import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QmahIconComponent } from '../components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-back-to-member',
  imports: [RouterLink, QmahIconComponent],
  templateUrl: './back-to-member.html',
  styleUrl: './back-to-member.scss'
})
export class BackToMember { }
