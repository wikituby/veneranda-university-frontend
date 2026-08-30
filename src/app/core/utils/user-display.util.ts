import { UserInfo } from '../models/auth.model';

export function userInitials(user: UserInfo | null | undefined): string {
  if (!user) return '?';
  const name = (user.fullName || '').trim();
  if (name) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return (user.username || '?').slice(0, 2).toUpperCase();
}

export function userAvatarUrl(user: UserInfo | null | undefined): string | null {
  const url = user?.avatarUrl?.trim();
  return url || null;
}