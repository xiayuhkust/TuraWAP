export interface StoredWalletData {
  address: string;
  encryptedPrivateKey: string;
  lastActivity: number;
}

export const STORAGE_KEYS = {
  WALLET_DATA: 'tura_wallet_data',
  SESSION: 'tura_wallet_session'
} as const;

export const WALLET_CONFIG = {
  INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  PASSWORD_MIN_LENGTH: 8
} as const;
