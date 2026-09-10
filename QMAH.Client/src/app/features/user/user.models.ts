export interface MemberAddress {
  id: string;
  addressLabel: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string | null;
  city: string | null;
  district: string | null;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUserAddressRequest {
  addressLabel: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string | null;
  city: string | null;
  district: string | null;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}
