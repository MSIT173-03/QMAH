import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { UserApi } from '../user-api';

import {
  MemberAddress,
  UpsertUserAddressRequest
} from '../user.models';

@Component({
  selector: 'app-addresses',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './addresses.html',
  styleUrl: './addresses.scss',
})
export class Addresses implements OnInit {

  addresses: MemberAddress[] = [];

  loading = true;
  saving = false;

  deletingId: string | null = null;
  defaultingId: string | null = null;

  errorMessage = '';
  successMessage = '';

  editingId: string | null = null;

  formData: UpsertUserAddressRequest = {
    addressLabel: '',
    recipientName: '',
    recipientPhone: '',
    postalCode: null,
    city: null,
    district: null,
    addressLine: '',
    latitude: null,
    longitude: null,
    isDefault: false
  };

  constructor(
    private userApi: UserApi,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadAddresses();
  }

  private loadAddresses(): void {

    this.loading = true;
    this.errorMessage = '';

    this.userApi.getAddresses()
      .subscribe({
        next: (data: MemberAddress[]) => {

          console.log('addresses:', data);

          this.addresses = data;
          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {

          console.error('addresses error:', error);

          this.errorMessage = '讀取地址資料失敗';
          this.loading = false;

          this.cdr.detectChanges();
        }
      });
  }

  saveAddress(): void {

    if (
      !this.formData.addressLabel.trim() ||
      !this.formData.recipientName.trim() ||
      !this.formData.recipientPhone.trim() ||
      !this.formData.addressLine.trim()
    ) {
      this.errorMessage =
        '請填寫地址標籤、收件人、電話與詳細地址';

      return;
    }

    if (this.saving) {
      return;
    }

    this.saving = true;

    this.errorMessage = '';
    this.successMessage = '';

    if (this.editingId) {

      this.userApi
        .updateAddress(
          this.editingId,
          this.formData
        )
        .subscribe({

          next: (data: MemberAddress) => {

            console.log(
              'update address success:',
              data
            );

            this.saving = false;

            this.successMessage =
              '修改地址成功';

            this.cancelEdit();

            this.loadAddresses();

            this.cdr.detectChanges();
          },

          error: (error: HttpErrorResponse) => {

            console.error(
              'update address error:',
              error
            );

            this.saving = false;

            this.handleError(
              error,
              '修改地址失敗'
            );

            this.cdr.detectChanges();
          }

        });

    } else {

      this.userApi
        .createAddress(this.formData)
        .subscribe({

          next: (data: MemberAddress) => {

            console.log(
              'create address success:',
              data
            );

            this.saving = false;

            this.successMessage =
              '新增地址成功';

            this.resetForm();

            this.loadAddresses();

            this.cdr.detectChanges();
          },

          error: (error: HttpErrorResponse) => {

            console.error(
              'create address error:',
              error
            );

            this.saving = false;

            this.handleError(
              error,
              '新增地址失敗'
            );

            this.cdr.detectChanges();
          }

        });
    }
  }

  editAddress(address: MemberAddress): void {

    this.errorMessage = '';
    this.successMessage = '';

    this.editingId = address.id;

    this.formData = {
      addressLabel:
        address.addressLabel,

      recipientName:
        address.recipientName,

      recipientPhone:
        address.recipientPhone,

      postalCode:
        address.postalCode,

      city:
        address.city,

      district:
        address.district,

      addressLine:
        address.addressLine,

      latitude:
        address.latitude,

      longitude:
        address.longitude,

      isDefault:
        address.isDefault
    };

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  cancelEdit(): void {

    this.editingId = null;

    this.resetForm();
  }

  deleteAddress(address: MemberAddress): void {

    if (this.deletingId) {
      return;
    }

    const confirmed = confirm(
      `確定要刪除「${address.addressLabel}」嗎？`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.deletingId = address.id;

    this.userApi
      .deleteAddress(address.id)
      .subscribe({

        next: () => {

          console.log(
            'delete address success:',
            address.id
          );

          this.deletingId = null;

          this.successMessage =
            '刪除地址成功';

          if (this.editingId === address.id) {
            this.cancelEdit();
          }

          this.loadAddresses();

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'delete address error:',
            error
          );

          this.deletingId = null;

          this.handleError(
            error,
            '刪除地址失敗'
          );

          this.cdr.detectChanges();
        }

      });
  }

  setDefaultAddress(
    address: MemberAddress
  ): void {

    if (
      address.isDefault ||
      this.defaultingId
    ) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.defaultingId = address.id;

    this.userApi
      .setDefaultAddress(address.id)
      .subscribe({

        next: (data: MemberAddress) => {

          console.log(
            'set default address success:',
            data
          );

          this.defaultingId = null;

          this.successMessage =
            '已設為預設地址';

          this.loadAddresses();

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'set default address error:',
            error
          );

          this.defaultingId = null;

          this.handleError(
            error,
            '設定預設地址失敗'
          );

          this.cdr.detectChanges();
        }

      });
  }

  private resetForm(): void {

    this.formData = {
      addressLabel: '',
      recipientName: '',
      recipientPhone: '',
      postalCode: null,
      city: null,
      district: null,
      addressLine: '',
      latitude: null,
      longitude: null,
      isDefault: false
    };
  }

  private handleError(
    error: HttpErrorResponse,
    defaultMessage: string
  ): void {

    if (error.status === 400) {

      this.errorMessage =
        '地址資料格式不正確';

    } else if (error.status === 401) {

      this.errorMessage =
        '登入狀態已失效，請重新登入';

    } else if (error.status === 403) {

      this.errorMessage =
        '目前帳號沒有操作權限';

    } else if (error.status === 404) {

      this.errorMessage =
        '找不到這筆地址資料';

    } else if (error.status === 409) {

      this.errorMessage =
        '目前操作發生衝突，請重新整理後再試';

    } else {

      this.errorMessage =
        defaultMessage;
    }
  }
}
