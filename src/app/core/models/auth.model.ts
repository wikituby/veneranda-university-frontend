export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface UserInfo {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  hasPassword?: boolean;
  roles: string[];
  permissions: string[];
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
