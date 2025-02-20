import { WalletService } from './wallet';
import { Buffer } from 'buffer';
import { WalletState } from './wallet_state';

// @ts-expect-error bip39 module has no type declarations
import * as bip39 from 'bip39';

// Ensure Buffer is available globally
if (typeof window !== 'undefined') {
  (window as Window & { Buffer: typeof Buffer }).Buffer = Buffer;
}

declare global {
  interface Window {
    ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
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
  private walletService: WalletService;
  // Removed unused currentAddress field
  private readonly keyPrefix = 'wallet_';
  private readonly sessionKey = 'wallet_session';
  private readonly lastWalletKey = 'last_wallet_address';
  private _isConnected: boolean = false;
  private connectionCheckInterval: number | null = null;

  private setupConnectionCheck() {
    if (this.connectionCheckInterval) {
      window.clearInterval(this.connectionCheckInterval);
    }
    
    this.connectionCheckInterval = window.setInterval(async () => {
      try {
        const connected = await this.walletService.isConnected();
        if (!this._isConnected && connected) {
          this._isConnected = true;
          await WalletState.getInstance().updateState({ isConnected: true });
        } else if (this._isConnected && !connected) {
          this._isConnected = false;
          await WalletState.getInstance().updateState({ isConnected: false });
        }
      } catch {
        if (this._isConnected) {
          this._isConnected = false;
          await WalletState.getInstance().updateState({ isConnected: false });
        }
      }
    }, 5000);
  }

  public async isConnected(): Promise<boolean> {
    try {
      const connected = await this.walletService.isConnected();
      if (this._isConnected !== connected) {
        this._isConnected = connected;
        await WalletState.getInstance().updateState({ isConnected: connected });
      }
      return connected;
    } catch {
      if (this._isConnected) {
        this._isConnected = false;
        await WalletState.getInstance().updateState({ isConnected: false });
      }
      return false;
    }
  }

  constructor() {
    this.walletService = new WalletService();
    this.setupConnectionCheck();
  }

  public async connect(): Promise<void> {
    try {
      const connected = await this.walletService.isConnected();
      if (!connected) {
        await this.walletService.ensureConnection();
        await WalletState.getInstance().updateState({ 
          isConnected: true,
          address: await this.getCurrentAddress() || ''
        });
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      await WalletState.getInstance().updateState({ 
        isConnected: false,
        address: '',
        balance: '0'
      });
      throw error instanceof Error ? error : new Error('Failed to connect wallet');
    }
  }

  public cleanup() {
    if (this.connectionCheckInterval) {
      window.clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    this.walletService.cleanup();
  }

  private async _deriveKey(password: string): Promise<string> {
    if (!window.crypto?.subtle?.digest) {
      throw new Error('Your browser does not support secure hashing (crypto.subtle.digest)');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private isValidEncryptedData(data: EncryptedData): boolean {
    if (!data || typeof data !== 'object') return false;
    if (!data.data || typeof data.data !== 'object') return false;
    if (!data.key || typeof data.key !== 'string') return false;
    if (!data.timestamp || typeof data.timestamp !== 'number') return false;
    
    // Validate WalletData
    if ('address' in data.data) {
      const wallet = data.data as WalletData;
      if (!wallet.address || !wallet.createdAt) return false;
    }
    
    // Validate SessionData
    if ('expires' in data.data) {
      const session = data.data as SessionData;
      if (!session.password || typeof session.expires !== 'number') return false;
    }
    
    return true;
  }


  private async _encrypt(data: WalletData | SessionData, password: string): Promise<string> {
    try {
      // Validate inputs
      if (!data || !password) {
        throw new Error('Invalid data or password for encryption');
      }

      if (typeof data !== 'object') {
        throw new Error('Data must be a valid object');
      }

      const key = await this._deriveKey(password);
      if (!key) {
        throw new Error('Failed to derive encryption key');
      }

      const encryptedData: EncryptedData = {
        data: data,
        key: key,
        timestamp: Date.now()
      };

      // Validate data structure before encryption
      if (!this.isValidEncryptedData(encryptedData)) {
        throw new Error('Invalid encrypted data structure');
      }

      const encrypted = btoa(JSON.stringify(encryptedData));
      
      console.log('Encryption successful:', {
        hasData: !!data,
        hasKey: !!key,
        timestamp: new Date(encryptedData.timestamp).toLocaleString(),
        resultLength: encrypted.length,
        type: 'session' in data ? 'session' : 'wallet'
      });
      
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async _decrypt(encryptedData: string, password: string): Promise<WalletData | SessionData> {
    try {
      if (!encryptedData || !password) {
        throw new Error('No encrypted data or password provided');
      }
      
      const key = await this._deriveKey(password);
      if (!key) {
        throw new Error('Failed to derive decryption key');
      }

      let decoded: EncryptedData;
      try {
        decoded = JSON.parse(atob(encryptedData));
      } catch (error) {
        console.error('Failed to parse encrypted data:', error);
        throw new Error('Invalid encrypted data format');
      }
      
      if (!this.isValidEncryptedData(decoded)) {
        throw new Error('Invalid encrypted data structure');
      }
      
      if (decoded.key !== key) {
        throw new Error('Invalid password');
      }

      console.log('Decryption successful:', {
        type: 'session' in decoded.data ? 'session' : 'wallet',
        timestamp: new Date(decoded.timestamp).toLocaleString()
      });
      
      return decoded.data;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed: ' + (error instanceof Error ? error.message : 'Invalid password or data'));
    }
  }

  async createWallet(password: string): Promise<WalletResponse> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
      throw new Error(
        'Your browser does not support required security features: ' +
        (!window.crypto?.subtle ? 'crypto.subtle, ' : '') +
        (!window.crypto?.getRandomValues ? 'crypto.getRandomValues' : '')
      );
    }

    try {
      // Generate mnemonic using bip39 with proper entropy
      const entropy = new Uint8Array(16);
      crypto.getRandomValues(entropy);
      const mnemonic = bip39.entropyToMnemonic(
        Buffer.from(entropy).toString('hex')
      );

      // Create wallet using new WalletService
      const response = await this.walletService.createWallet(password);
      
      const walletData: WalletData = {
        address: response.address,
        privateKey: '', // Private key is handled by WalletService
        mnemonic: mnemonic,
        createdAt: new Date().toISOString()
      };

      const encrypted = await this._encrypt(walletData, password);
      const lowerAddress = response.address.toLowerCase();
      localStorage.setItem(
        `${this.keyPrefix}${lowerAddress}`,
        encrypted
      );
      localStorage.setItem(this.lastWalletKey, lowerAddress);

      const sessionData: SessionData = {
        password: password,
        expires: Date.now() + (5 * 60 * 1000)
      };
      
      // Store session status for debug visibility (not the actual key)
      localStorage.setItem('wallet_session_key', 'active');
      
      // Use a constant key for session encryption
      const encryptedSession = await this._encrypt(sessionData, 'session');
      sessionStorage.setItem(this.sessionKey, encryptedSession);

      // Update wallet state
      await WalletState.getInstance().updateState({
        address: response.address,
        balance: await this.getBalance(response.address),
        isConnected: await this.isConnected()
      });

      return {
        address: response.address,
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
      const response = await this.walletService.createWallet(password);

      const walletData: WalletData = {
        address: response.address,
        privateKey: '', // Private key is handled by WalletService
        mnemonic: mnemonic,
        createdAt: new Date().toISOString()
      };

      const encrypted = await this._encrypt(walletData, password);
      const lowerAddress = response.address.toLowerCase();
      localStorage.setItem(
        `${this.keyPrefix}${lowerAddress}`,
        encrypted
      );
      localStorage.setItem(this.lastWalletKey, lowerAddress);

      return {
        address: response.address,
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

      localStorage.setItem(this.lastWalletKey, walletData.address.toLowerCase());
      
      const sessionData: SessionData = {
        password: password,
        expires: Date.now() + (5 * 60 * 1000)
      };
      
      // Store session status for debug visibility (not the actual key)
      localStorage.setItem('wallet_session_key', 'active');
      
      // Use a constant key for session encryption
      const encryptedSession = await this._encrypt(sessionData, 'session');
      sessionStorage.setItem(this.sessionKey, encryptedSession);

      // Update wallet state
      const balance = await this.getBalance(walletData.address);
      const isConnected = await this.isConnected();
      await WalletState.getInstance().updateState({
        address: walletData.address,
        balance,
        isConnected
      });
      
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

      const receipt = await this.walletService.sendTransaction(
        fromAddress,
        toAddress,
        amount,
        walletData.privateKey
      );

      // Update wallet state after successful transaction
      if (receipt.status) {
        await WalletState.getInstance().updateState({
          address: fromAddress,
          balance: await this.getBalance(fromAddress),
          isConnected: await this.isConnected()
        });
      }

      return receipt;
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

      // Try last used wallet first
      const lastAddress = localStorage.getItem(this.lastWalletKey);
      if (lastAddress) {
        try {
          await this.getWalletData(lastAddress, session.password);
          return lastAddress;
        } catch {
          // Last used wallet not accessible, continue to check others
        }
      }

      // Fall back to checking all wallets
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

  public listStoredWallets(): string[] {
    try {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(this.keyPrefix))
        .map(key => key.slice(this.keyPrefix.length));
    } catch (error) {
      console.error('Failed to access localStorage:', error);
      return [];
    }
  }

  public logout(): void {
    sessionStorage.removeItem(this.sessionKey);
    localStorage.removeItem('last_activity');
    localStorage.removeItem(this.lastWalletKey);
    localStorage.removeItem('wallet_session_key'); // Clean up session key
    this.cleanup();
    WalletState.getInstance().updateState({
      address: '',
      balance: '0',
      isConnected: false
    });
  }

  public isWalletConnected(): boolean {
    return this._isConnected;
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
          // When session expires, disconnect but keep the address
          this._isConnected = false;
          await WalletState.getInstance().updateState({ isConnected: false });
          return null;
        }

        // Extend session time if more than 1 minute has passed since last activity
        if (inactiveTime > 60 * 1000) {
          sessionData.expires = Date.now() + (5 * 60 * 1000); // Extend by 5 minutes
          const encryptedSession = await this._encrypt(sessionData, 'session');
          sessionStorage.setItem(this.sessionKey, encryptedSession);
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
