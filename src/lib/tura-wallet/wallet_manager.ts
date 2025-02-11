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
  private static sessionEncryptionKey: string;
  private walletService: WalletService;
  private readonly keyPrefix = 'wallet_';
  private readonly sessionKey = 'wallet_session';
  private readonly lastWalletKey = 'last_wallet_address';

  private static getSessionKey(): string {
    if (!WalletManagerImpl.sessionEncryptionKey) {
      const storedKey = localStorage.getItem('wallet_session_key');
      if (storedKey) {
        WalletManagerImpl.sessionEncryptionKey = storedKey;
      } else {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        WalletManagerImpl.sessionEncryptionKey = Array.from(array)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        localStorage.setItem('wallet_session_key', WalletManagerImpl.sessionEncryptionKey);
      }
    }
    return WalletManagerImpl.sessionEncryptionKey;
  }
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

  private async _encrypt(data: WalletData | SessionData, password: string): Promise<string> {
    try {
      // Use secure session key for session data, or derive key for wallet data
      const key = password === 'session' ? WalletManagerImpl.getSessionKey() : await this._deriveKey(password);
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
        resultLength: encrypted.length,
        isSession: password === 'session'
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
      
      // Use secure session key for session data, or derive key for wallet data
      const key = password === 'session' ? WalletManagerImpl.getSessionKey() : await this._deriveKey(password);
      let decoded: EncryptedData;
      
      try {
        decoded = JSON.parse(atob(encryptedData));
      } catch {
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

      // Initialize session with 5 minute duration
      const sessionExpiration = Date.now() + (5 * 60 * 1000);
      console.log('Creating new session:', {
        createdAt: new Date().toLocaleString(),
        expires: new Date(sessionExpiration).toLocaleString(),
        duration: '5 minutes'
      });
      
      const sessionData: SessionData = {
        password: password,
        expires: sessionExpiration
      };
      
      // Ensure session encryption key exists
      WalletManagerImpl.getSessionKey();
      
      const encryptedSession = await this._encrypt(sessionData, 'session');
      sessionStorage.setItem(this.sessionKey, encryptedSession);
      
      // Verify session was stored correctly
      const verifySession = await this._decrypt(encryptedSession, 'session') as SessionData;
      if (!verifySession || !verifySession.expires || verifySession.expires !== sessionExpiration) {
        console.error('Session verification failed:', {
          hasSession: !!verifySession,
          expectedExpires: new Date(sessionExpiration).toLocaleString(),
          actualExpires: verifySession?.expires ? new Date(verifySession.expires).toLocaleString() : 'none'
        });
        throw new Error('Failed to initialize session properly');
      }

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
      
      // Initialize session with 5 minute duration
      const sessionExpiration = Date.now() + (5 * 60 * 1000);
      console.log('Creating new session on login:', {
        createdAt: new Date().toLocaleString(),
        expires: new Date(sessionExpiration).toLocaleString(),
        duration: '5 minutes'
      });
      
      const sessionData: SessionData = {
        password: password,
        expires: sessionExpiration
      };
      
      // Ensure session encryption key exists
      WalletManagerImpl.getSessionKey();
      
      const encryptedSession = await this._encrypt(sessionData, 'session');
      sessionStorage.setItem(this.sessionKey, encryptedSession);
      
      // Verify session was stored correctly
      const verifySession = await this._decrypt(encryptedSession, 'session') as SessionData;
      if (!verifySession || !verifySession.expires || verifySession.expires !== sessionExpiration) {
        console.error('Session verification failed on login:', {
          hasSession: !!verifySession,
          expectedExpires: new Date(sessionExpiration).toLocaleString(),
          actualExpires: verifySession?.expires ? new Date(verifySession.expires).toLocaleString() : 'none'
        });
        throw new Error('Failed to initialize session properly during login');
      }

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
    localStorage.removeItem('wallet_session_key');  // Add cleanup of session encryption key
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
    if (!window.sessionStorage) {
      console.warn('Session storage not available');
      return null;
    }

    const encrypted = sessionStorage.getItem(this.sessionKey);
    if (!encrypted) {
      return null;
    }

    try {
      // Ensure session encryption key exists
      WalletManagerImpl.getSessionKey();
      
      const sessionData = await this._decrypt(encrypted, 'session') as SessionData;
      
      // Log session data for debugging
      console.log('Decrypted session data:', {
        hasPassword: !!sessionData?.password,
        expires: sessionData?.expires ? new Date(sessionData.expires).toLocaleString() : 'none',
        remainingTime: sessionData?.expires ? Math.floor((sessionData.expires - Date.now()) / 1000) : 0,
        now: new Date().toLocaleString()
      });

      // Validate session data structure
      if (!sessionData || typeof sessionData !== 'object') {
        console.warn('Invalid session data format:', sessionData);
        return null;
      }

      // Handle missing or invalid session data
      if (!sessionData.password || !sessionData.expires) {
        console.warn('Incomplete session data:', { 
          hasPassword: !!sessionData.password, 
          hasExpires: !!sessionData.expires,
          sessionData
        });
        return null;
      }
        
      // Validate expiration time
      if (typeof sessionData.expires !== 'number' || isNaN(sessionData.expires)) {
        console.error('Invalid session expiration time:', sessionData.expires);
        return null;
      }
      
      // Only proceed if we have a valid session
      const lastWallet = localStorage.getItem(this.lastWalletKey);
      if (!lastWallet) {
        console.warn('No last wallet found for session');
        return null;
      }

      // Check for inactivity timeout (30 minutes)
      const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
      const inactiveTime = Date.now() - lastActivity;
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
        console.log('Session inactive timeout reached:', {
          lastActivity: new Date(lastActivity).toLocaleString(),
          inactiveTime: Math.floor(inactiveTime / 1000),
          threshold: 30 * 60
        });
        this.logout();
        return null;
      }

      // Always update last activity timestamp for valid sessions
      localStorage.setItem('last_activity', Date.now().toString());

      // Check session expiration
      const now = Date.now();
      const remainingTime = Math.max(0, Math.floor((sessionData.expires - now) / 1000));
      
      if (sessionData.expires <= now) {
        console.log('Session expired:', {
          expires: new Date(sessionData.expires).toLocaleString(),
          now: new Date(now).toLocaleString(),
          remainingTime
        });
        // When session expires, disconnect but keep the address
        this._isConnected = false;
        await WalletState.getInstance().updateState({ isConnected: false });
        return null;
      }

      // Extend session time if less than 4 minutes remaining
      if (remainingTime < 240) {
        const oldExpires = sessionData.expires;
        sessionData.expires = now + (5 * 60 * 1000); // Reset to 5 minutes
        
        try {
          const encryptedSession = await this._encrypt(sessionData, 'session');
          sessionStorage.setItem(this.sessionKey, encryptedSession);
          
          console.log('Session extended:', {
            oldExpires: new Date(oldExpires).toLocaleString(),
            newExpires: new Date(sessionData.expires).toLocaleString(),
            oldRemainingTime: remainingTime,
            newRemainingTime: 300 // 5 minutes in seconds
          });
        } catch (error) {
          console.error('Failed to extend session:', error);
          // Keep the old expiration time on encryption failure
          sessionData.expires = oldExpires;
        }
      } else {
        console.log('Session status:', {
          expires: new Date(sessionData.expires).toLocaleString(),
          remainingTime,
          now: new Date(now).toLocaleString()
        });
      }

      return sessionData;
    } catch (error: unknown) {
      console.error('Failed to process session:', error);
      return null;
    }
  }
}

// Export the implementation as the default and type
export type WalletManager = WalletManagerImpl;
export default WalletManagerImpl;
