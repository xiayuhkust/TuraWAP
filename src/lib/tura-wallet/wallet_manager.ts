import { WalletService } from './wallet';
import * as bip39 from 'bip39';
import { Buffer } from 'buffer';

// Ensure Buffer is available globally
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

declare global {
  interface Window {
    ethereum: any;
  }
}

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic?: string;
  createdAt: string;
}

export interface SessionData {
  password: string;
  expires: number;
}

export interface WalletResponse {
  address: string;
  createdAt: string;
  mnemonic?: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  status: boolean;
  // Add other fields that might come from Web3
  from?: string;
  to?: string;
  contractAddress?: string;
  gasUsed?: number;
}

export interface EncryptedData {
  data: WalletData | SessionData;
  key: string;
  timestamp: number;
}

export class WalletManagerImpl {
  public walletService: WalletService;
  private readonly keyPrefix = 'wallet_';
  private readonly sessionKey = 'wallet_session';

  constructor() {
    this.walletService = new WalletService();
  }

  private async _deriveKey(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async _encrypt(data: WalletData | SessionData, password: string): Promise<string> {
    try {
      const key = await this._deriveKey(password);
      const encryptedData: EncryptedData = {
        data: data,
        key: key,
        timestamp: Date.now()
      };
      const encrypted = btoa(JSON.stringify(encryptedData));
      
      console.log('Encryption successful:', {
        hasData: !!data,
        hasKey: !!key,
        timestamp: new Date(encryptedData.timestamp).toLocaleString(),
        resultLength: encrypted.length
      });
      
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async _decrypt(encryptedData: string, password: string): Promise<WalletData | SessionData> {
    try {
      if (!encryptedData) {
        throw new Error('No encrypted data provided');
      }
      
      const key = await this._deriveKey(password);
      let decoded: EncryptedData;
      
      try {
        decoded = JSON.parse(atob(encryptedData));
      } catch (e) {
        throw new Error('Invalid encrypted data format');
      }
      
      if (!decoded || typeof decoded !== 'object' || !decoded.data || !decoded.key || !decoded.timestamp) {
        throw new Error('Invalid data structure');
      }
      
      if (decoded.key !== key) {
        throw new Error('Invalid password');
      }
      
      return decoded.data;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed: Invalid password or data');
    }
  }

  async createWallet(password: string): Promise<WalletResponse> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    try {
      const account = await this.walletService.createAccount();
      
      // Generate mnemonic using bip39 with proper entropy
      const entropy = new Uint8Array(16);
      crypto.getRandomValues(entropy);
      const mnemonic = bip39.entropyToMnemonic(
        Buffer.from(entropy).toString('hex')
      );
      
      console.log('Mnemonic generation successful:', {
        hasEntropy: !!entropy,
        entropyLength: entropy.length,
        hasMnemonic: !!mnemonic,
        mnemonicWordCount: mnemonic.split(' ').length
      });
      
      const walletData: WalletData = {
        address: account.address,
        privateKey: account.privateKey,
        mnemonic: mnemonic,
        createdAt: new Date().toISOString()
      };

      const encrypted = await this._encrypt(walletData, password);
      localStorage.setItem(
        `${this.keyPrefix}${account.address.toLowerCase()}`,
        encrypted
      );

      const sessionData: SessionData = {
        password: password,
        expires: Date.now() + (5 * 60 * 1000)
      };
      const encryptedSession = await this._encrypt(sessionData, 'session');
      sessionStorage.setItem(this.sessionKey, encryptedSession);

      return {
        address: account.address,
        mnemonic: mnemonic,
        createdAt: walletData.createdAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create wallet: ${error.message}`);
      }
      throw new Error('Failed to create wallet');
    }
  }

  async importWallet(mnemonic: string, password: string): Promise<WalletResponse> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Generate private key from mnemonic
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const privateKey = '0x' + Buffer.from(seed).slice(0, 32).toString('hex');
      const account = await this.walletService.createAccount(privateKey);

      const walletData: WalletData = {
        address: account.address,
        privateKey: account.privateKey,
        mnemonic: mnemonic,
        createdAt: new Date().toISOString()
      };

      const encrypted = await this._encrypt(walletData, password);
      localStorage.setItem(
        `${this.keyPrefix}${account.address.toLowerCase()}`,
        encrypted
      );

      return {
        address: account.address,
        createdAt: walletData.createdAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to import wallet: ${error.message}`);
      }
      throw new Error('Failed to import wallet');
    }
  }

  async login(address: string, password: string): Promise<WalletResponse> {
    const key = `${this.keyPrefix}${address.toLowerCase()}`;
    const encrypted = localStorage.getItem(key);
    
    if (!encrypted) {
      throw new Error('Wallet not found');
    }

    try {
      const walletData = await this._decrypt(encrypted, password) as WalletData;
      
      if (!walletData || typeof walletData !== 'object') {
        throw new Error('Invalid wallet data');
      }

      const sessionData: SessionData = {
        password: password,
        expires: Date.now() + (5 * 60 * 1000)
      };
      
      const encryptedSession = await this._encrypt(sessionData, 'session');
      sessionStorage.setItem(this.sessionKey, encryptedSession);
      
      return {
        address: walletData.address,
        createdAt: walletData.createdAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Login failed: ${error.message}`);
      }
      throw new Error('Login failed');
    }
  }

  async getWalletData(address: string, password: string): Promise<WalletData> {
    const key = `${this.keyPrefix}${address.toLowerCase()}`;
    const encrypted = localStorage.getItem(key);
    
    if (!encrypted) {
      throw new Error('Wallet not found');
    }

    const decrypted = await this._decrypt(encrypted, password);
    
    if (!decrypted || typeof decrypted !== 'object') {
      throw new Error('Invalid wallet data');
    }

    return decrypted as WalletData;
  }

  async sendTransaction(fromAddress: string, toAddress: string, amount: string, password: string): Promise<TransactionReceipt> {
    try {
      const walletData = await this.getWalletData(fromAddress, password);
      if (!walletData || !walletData.privateKey) {
        throw new Error('Invalid wallet data or password');
      }

      return await this.walletService.sendTransaction(
        fromAddress,
        toAddress,
        amount,
        walletData.privateKey
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Transaction failed: ${error.message}`);
      }
      throw new Error('Transaction failed');
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      return await this.walletService.getBalance(address);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get balance: ${error.message}`);
      }
      throw new Error('Failed to get balance');
    }
  }

  async getCurrentAddress(): Promise<string | null> {
    try {
      // Check session first
      const session = await this.getSession();
      if (!session?.password) {
        return null;
      }

      // Get all wallet addresses from localStorage
      const addresses = Object.keys(localStorage)
        .filter(key => key.startsWith(this.keyPrefix))
        .map(key => key.slice(this.keyPrefix.length));

      // Return the first address that can be decrypted with the session password
      for (const address of addresses) {
        try {
          await this.getWalletData(address, session.password);
          return address;
        } catch {
          continue;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get current address:', error);
      return null;
    }
  }

  async getSession(): Promise<SessionData | null> {
    try {
      if (!window.sessionStorage) {
        console.warn('Session storage not available');
        return null;
      }

      const encrypted = sessionStorage.getItem(this.sessionKey);
      if (!encrypted) {
        return null;
      }

      try {
        const sessionData = await this._decrypt(encrypted, 'session') as SessionData;
        if (!sessionData || !sessionData.password || !sessionData.expires) {
          console.warn('Invalid session data structure:', sessionData);
          return null;
        }

        // Check for inactivity timeout (30 minutes)
        const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
        const inactiveTime = Date.now() - lastActivity;
        if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
          this.logout();
          return null;
        }

        if (sessionData.expires <= Date.now()) {
          console.log('Session expired:', {
            expires: new Date(sessionData.expires).toLocaleString(),
            now: new Date().toLocaleString()
          });
          return null;
        }

        // Update last activity timestamp
        localStorage.setItem('last_activity', Date.now().toString());
        return sessionData;
      } catch {
        return null;
      }
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }
}

// Export the implementation as the default and type
export type WalletManager = WalletManagerImpl;
export default WalletManagerImpl;
