import Web3 from 'web3';
import { Web3ProviderService } from './web3-provider';
import { WalletState } from './wallet_state';
import { CHAIN_CONFIG } from '../../config/chain';

export class WalletService {
  private web3: Web3 | null = null;
  private providerService: Web3ProviderService;

  constructor() {
    this.providerService = new Web3ProviderService();
  }

  public async ensureConnection(): Promise<Web3> {
    if (this.web3) return this.web3;
    try {
      const web3 = await this.providerService.connect();
      this.web3 = web3;
      await WalletState.getInstance().updateState({ isConnected: true });
      return web3;
    } catch (error) {
      await WalletState.getInstance().updateState({ isConnected: false });
      throw error;
    }
  }

  public async isConnected(): Promise<boolean> {
    try {
      const web3 = await this.ensureConnection();
      const isListening = await web3.eth.net.isListening();
      await WalletState.getInstance().updateState({ isConnected: isListening });
      return isListening;
    } catch (error) {
      await WalletState.getInstance().updateState({ isConnected: false });
      return false;
    }
  }

  public cleanup(): void {
    this.providerService.cleanup();
    this.web3 = null;
    WalletState.getInstance().updateState({ isConnected: false });
  }

  public async createWallet(password: string, existingPrivateKey?: string): Promise<{ address: string; privateKey: string }> {
    try {
      const web3 = await this.ensureConnection();
      const account = existingPrivateKey ? 
        web3.eth.accounts.privateKeyToAccount(existingPrivateKey) :
        web3.eth.accounts.create();
      const encryptedAccount = web3.eth.accounts.encrypt(account.privateKey, password);
      localStorage.setItem(`wallet_${account.address.toLowerCase()}`, JSON.stringify(encryptedAccount));
      return { 
        address: account.address,
        privateKey: account.privateKey
      };
    } catch (error) {
      await WalletState.getInstance().updateState({ isConnected: false });
      throw error;
    }
  }

  public async getBalance(address: string): Promise<string> {
    try {
      const web3 = await this.ensureConnection();
      if (!web3.utils.isAddress(address)) {
        throw new Error('Invalid address format');
      }
      const balance = await web3.eth.getBalance(address);
      return web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get balance: ${error.message}`);
      }
      throw new Error('Failed to get balance');
    }
  }

  public async sendTransaction(fromAddress: string, toAddress: string, amount: string, privateKey: string): Promise<any> {
    try {
      const web3 = await this.ensureConnection();
      if (!web3.utils.isAddress(fromAddress) || !web3.utils.isAddress(toAddress)) {
        throw new Error('Invalid address format');
      }

      const [nonce, gasPrice] = await Promise.all([
        web3.eth.getTransactionCount(fromAddress),
        web3.eth.getGasPrice()
      ]);

      const tx = {
        from: fromAddress,
        to: toAddress,
        value: web3.utils.toWei(amount, 'ether'),
        gas: '21000',
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: CHAIN_CONFIG.chainId
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
      if (!signedTx.rawTransaction) {
        throw new Error('Failed to sign transaction');
      }
      return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    } catch (error) {
      await WalletState.getInstance().updateState({ isConnected: false });
      if (error instanceof Error) {
        throw new Error(`Transaction failed: ${error.message}`);
      }
      throw new Error('Transaction failed');
    }
  }
}
