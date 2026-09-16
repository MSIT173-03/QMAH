export interface KeyModel {
  id: string;
  code: string;
  name: string;
  scopeType: string;
  categoryId: string | null;
  eraBucketId: string | null;
  balance: number;
  eligibleArtifactCount: number;
  recyclePointValue: number;
}
