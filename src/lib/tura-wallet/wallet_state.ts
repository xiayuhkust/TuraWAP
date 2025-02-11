import { WalletManagerImpl } from './wallet_manager';

export interface WalletInfo {
  address: string;
  balance: string;
  isConnected: boolean;
}

export class WalletState {
  private static instance: WalletState;
  private subscribers: Set<(state: WalletInfo) => void>;
  private currentState: WalletInfo;
  private walletManager: WalletManagerImpl;
  
  private constructor() {
    this.subscribers = new Set();
    this.walletManager = new WalletManagerImpl();
    this.currentState = {
      address: '',
      balance: '0',
      isConnected: false
    };
    
    // Initialize from localStorage if wallet exists
    this.initializeFromStorage().catch(error => {
      console.error('Failed to initialize from storage:', error);
    });
  }

  private async initializeFromStorage(): Promise<void> {
    try {
      // Get session and validate it
      const session = await this.walletManager.getSession();
      console.log('Initializing wallet state:', {
        hasSession: !!session,
        sessionExpires: session?.expires ? new Date(session.expires).toLocaleString() : 'none',
        remainingTime: session?.expires ? Math.floor((session.expires - Date.now()) / 1000) : 0
      });

      // Get last wallet or find available wallets
      const lastWallet = localStorage.getItem('last_wallet_address');
      const targetWallet = lastWallet || this.walletManager.listStoredWallets()[0];
      
      if (!targetWallet) {
        console.log('No wallets found during initialization');
        return;
      }

      try {
        // Check if we can connect to the wallet
        const isConnected = session?.password ? await this.walletManager.isConnected() : false;
        
        // Get balance only if we have a valid session or wallet
        const balance = await this.walletManager.getBalance(targetWallet);
        
        console.log('Wallet state initialized:', {
          wallet: targetWallet,
          hasBalance: !!balance,
          isConnected,
          sessionValid: !!session?.password
        });

        // Update state with validated data
        await this.updateState({
          address: targetWallet,
          balance,
          isConnected
        });
      } catch (error: unknown) {
        console.error('Failed to initialize wallet state:', {
          wallet: targetWallet,
          hasSession: !!session,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Update state with safe defaults on error
        await this.updateState({
          address: targetWallet,
          balance: '0',
          isConnected: false
        });
      }
    } catch (error: unknown) {
      console.error('Critical error during wallet initialization:', error);
      // Ensure we have a clean state on critical errors
      this.currentState = {
        address: '',
        balance: '0',
        isConnected: false
      };
    }
  }
  
  public static getInstance(): WalletState {
    if (!WalletState.instance) {
      WalletState.instance = new WalletState();
    }
    return WalletState.instance;
  }
  
  public subscribe(callback: (state: WalletInfo) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  public async updateState(info: Partial<WalletInfo>) {
    this.currentState = { ...this.currentState, ...info };
    this.subscribers.forEach(callback => callback(this.currentState));
  }
  
  public async refreshBalance() {
    if (this.currentState.address) {
      const balance = await this.walletManager.getBalance(this.currentState.address);
      await this.updateState({ balance });
    }
  }
  
  public getState(): WalletInfo {
    return { ...this.currentState };
  }
  
  public cleanup() {
    this.subscribers.clear();
    this.walletManager.cleanup();
  }
}

export default WalletState;
