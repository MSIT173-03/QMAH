import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

import {
  MemberAddress,
  UpsertUserAddressRequest
} from './user.models';

@Injectable({
  providedIn: 'root'
})
export class UserApi {

  private readonly http = inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiBaseUrl}/me`;

  getAddresses() {
    return this.http.get<MemberAddress[]>(
      `${this.baseUrl}/addresses`
    );
  }

  createAddress(request: UpsertUserAddressRequest) {
    return this.http.post<MemberAddress>(
      `${this.baseUrl}/addresses`,
      request
    );
  }

  updateAddress(
    id: string,
    request: UpsertUserAddressRequest
  ) {
    return this.http.put<MemberAddress>(
      `${this.baseUrl}/addresses/${id}`,
      request
    );
  }

  deleteAddress(id: string) {
    return this.http.delete<void>(
      `${this.baseUrl}/addresses/${id}`
    );
  }

  setDefaultAddress(id: string) {
    return this.http.post<MemberAddress>(
      `${this.baseUrl}/addresses/${id}/default`,
      {}
    );
  }
}
