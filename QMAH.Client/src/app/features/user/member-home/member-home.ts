import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-member-home',

  imports: [
    RouterLink,
    QmahIconComponent
  ],

  templateUrl: './member-home.html',
  styleUrl: './member-home.scss'
})
export class MemberHome {
}
