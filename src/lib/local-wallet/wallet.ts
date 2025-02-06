import Web3 from 'web3';

import { CHAIN_CONFIG } from '../../config/chain';

export interface WalletData {
  address: string;
  privateKey: string;
  createdAt: string;
}

export interface TransactionResult {
  success: boolean;
  message: string;
  newBalance?: string;
}

export class LocalWalletService {
  private web3: Web3;
  private readonly walletPrefix = 'wallet_';
  private currentAddress: string | null = null;

  constructor() {
    this.web3 = new Web3(new Web3.providers.HttpProvider(CHAIN_CONFIG.rpcUrl));
  }

  public async createWallet(): Promise<WalletData> {
    try {
      const account = this.web3.eth.accounts.create();
      const walletData: WalletData = {
        address: account.address,
        privateKey: account.privateKey,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem(
        `${this.walletPrefix}${account.address.toLowerCase()}`,
        JSON.stringify(walletData)
      );
      this.currentAddress = account.address;
      return walletData;
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw new Error('Failed to create wallet');
    }
  }

  public async getBalance(address: string): Promise<string> {
    try {
      if (!this.web3.utils.isAddress(address)) {
        throw new Error('Invalid address format');
      }
      const balance = await this.web3.eth.getBalance(address);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw new Error('Failed to get balance');
    }
  }

  public async sendTransaction(
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKey: string
  ): Promise<TransactionResult> {
    try {
      if (!this.web3.utils.isAddress(fromAddress) || !this.web3.utils.isAddress(toAddress)) {
        throw new Error('Invalid address format');
      }

      const value = this.web3.utils.toWei(amount, 'ether');
      const [nonce, gasPrice] = await Promise.all([
        this.web3.eth.getTransactionCount(fromAddress, 'latest'),
        this.web3.eth.getGasPrice()
      ]);

      const tx = {
        from: fromAddress,
        to: toAddress,
        value,
        gas: 21000,
        gasPrice,
        nonce,
        chainId: CHAIN_CONFIG.chainId
      };

      const signedTx = await this.web3.eth.accounts.signTransaction(tx, privateKey);
      if (!signedTx.rawTransaction) {
        throw new Error('Failed to sign transaction');
      }

      await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      const newBalance = await this.getBalance(fromAddress);

      return {
        success: true,
        message: 'Transaction successful',
        newBalance
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  public getCurrentAddress(): string | null {
    return this.currentAddress;
  }

  public setCurrentAddress(address: string | null): void {
    this.currentAddress = address;
  }

  public getWalletData(address: string): WalletData | null {
    try {
      const data = localStorage.getItem(`${this.walletPrefix}${address.toLowerCase()}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get wallet data:', error);
      return null;
    }
  }

  public logoutAccount(): void {
    this.currentAddress = null;
  }

  public async distributeFaucet(_address: string): Promise<TransactionResult> {
    // Simulated faucet distribution
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      message: 'Faucet tokens distributed',
      newBalance: '1000'
    };
  }

  public async deductFee(address: string, fee: number): Promise<TransactionResult> {
    try {
      const balance = await this.getBalance(address);
      if (parseFloat(balance) < fee) {
        return {
          success: false,
          message: 'Insufficient balance for fee',
          newBalance: balance
        };
      }
      // Simulate fee deduction
      return {
        success: true,
        message: 'Fee deducted',
        newBalance: (parseFloat(balance) - fee).toString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to deduct fee'
      };
    }
  }
}

export default LocalWalletService;
