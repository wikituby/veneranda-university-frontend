export interface RouterDto {
  id: number;
  uuid: string;
  name: string;
  vendor: string;
  model?: string;
  ipAddress: string;
  apiPort: number;
  username: string;
  location?: string;
  firmware?: string;
  routerVersion?: string;
  serialNumber?: string;
  isEnabled: boolean;
  isOnline: boolean;
  lastSyncAt?: string;
  lastSeenAt?: string;
  notes?: string;
  tenantId?: number;
  tenantName?: string;
  branchId?: number;
  branchName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouterRequest {
  name: string;
  vendor: string;
  model?: string;
  ipAddress: string;
  apiPort: number;
  username: string;
  password: string;
  location?: string;
  firmware?: string;
  routerVersion?: string;
  serialNumber?: string;
  branchId?: number;
  isEnabled: boolean;
  notes?: string;
}

export interface UpdateRouterRequest {
  name?: string;
  vendor?: string;
  model?: string;
  ipAddress?: string;
  apiPort?: number;
  username?: string;
  password?: string;
  location?: string;
  firmware?: string;
  routerVersion?: string;
  serialNumber?: string;
  branchId?: number;
  isEnabled?: boolean;
  status?: string;
  notes?: string;
}

export interface RouterStats {
  totalRouters: number;
  onlineRouters: number;
  mikrotikCount: number;
  ubiquitiCount: number;
  ciscoCount: number;
  huaweiCount: number;
}

export const VENDOR_OPTIONS = [
  { value: 'MIKROTIK', label: 'MikroTik' },
  { value: 'UBIQUITI', label: 'Ubiquiti' },
  { value: 'TP_LINK', label: 'TP-Link' },
  { value: 'D_LINK', label: 'D-Link' },
  { value: 'CISCO', label: 'Cisco' },
  { value: 'HUAWEI', label: 'Huawei' },
  { value: 'GENERIC', label: 'Generic RouterOS' },
];

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', color: 'primary' },
  { value: 'OFFLINE', label: 'Offline', color: 'warn' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'accent' },
  { value: 'RETIRED', label: 'Retired', color: '' },
];