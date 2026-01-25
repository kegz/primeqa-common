export interface UserClaims {
  userId: string;
  tenantId: string;
  role?: string;
  roleId?: string;
  permissions?: string[];
  email?: string;
}
