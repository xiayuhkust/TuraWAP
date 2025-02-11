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
    const session = await this.walletManager.getSession();
    const lastWallet = localStorage.getItem('last_wallet_address');
    
    if (lastWallet) {
      try {
        const balance = await this.walletManager.getBalance(lastWallet);
        await this.updateState({
          address: lastWallet,
          balance,
          isConnected: session?.password ? await this.walletManager.isConnected() : false
        });
      } catch (error) {
        console.error('Failed to load last wallet:', error);
      }
    } else {
      const wallets = this.walletManager.listStoredWallets();
      if (wallets.length > 0) {
        const address = wallets[0];
        try {
          const balance = await this.walletManager.getBalance(address);
          await this.updateState({
            address,
            balance,
            isConnected: session?.password ? await this.walletManager.isConnected() : false
          });
        } catch (error) {
          console.error('Failed to load wallet:', error);
        }
      }
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
