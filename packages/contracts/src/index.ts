export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  organizationId?: string | null;
  orgRole?: string | null;
}

export interface MatterDto {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  matterNumber?: string | null;
  status: string;
  createdAt: string;
  documentCount: number;
}
