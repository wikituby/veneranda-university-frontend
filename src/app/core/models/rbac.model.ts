export interface UserDto {
  id: number;
  uuid: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  jobTitle?: string;
  employeeNumber?: string;
  tenantId?: number;
  tenantName?: string;
  branchId?: number;
  branchName?: string;
  isActive: boolean;
  isLocked: boolean;
  isSystem: boolean;
  failedLoginCount: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
  passwordChangedAt?: string;
  twoFactorEnabled: boolean;
  roles: string[];
  roleCodes: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDto {
  id: number;
  uuid: string;
  name: string;
  code: string;
  description?: string;
  tenantId?: number;
  isSystem: boolean;
  isActive: boolean;
  permissions: PermissionDto[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDto {
  id: number;
  uuid: string;
  name: string;
  code: string;
  module: string;
  description?: string;
  isSystem: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  employeeNumber?: string;
  branchId?: number;
  roleIds?: number[];
  isActive: boolean;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  jobTitle?: string;
  employeeNumber?: string;
  branchId?: number;
  roleIds?: number[];
  isActive?: boolean;
  isLocked?: boolean;
  status?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  first: boolean;
  last: boolean;
}