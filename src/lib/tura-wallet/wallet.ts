import Web3 from 'web3';
import { Web3ProviderService } from './web3-provider';

export class WalletService {
  private web3: Web3 | null = null;
  private providerService: Web3ProviderService;

  constructor() {
    this.providerService = new Web3ProviderService();
  }

  public async ensureConnection(): Promise<Web3> {
    if (this.web3) return this.web3;
    const web3 = await this.providerService.connect();
    this.web3 = web3;
    return web3;
  }

  public async isConnected(): Promise<boolean> {
    try {
      const web3 = await this.ensureConnection();
      return await web3.eth.net.isListening();
    } catch (error) {
      return false;
    }
  }

  public cleanup(): void {
    this.providerService.cleanup();
    this.web3 = null;
  }

  public async createWallet(password: string): Promise<{ address: string }> {
    const web3 = await this.ensureConnection();
    const account = web3.eth.accounts.create();
    const encryptedAccount = web3.eth.accounts.encrypt(account.privateKey, password);
    localStorage.setItem(`wallet_${account.address.toLowerCase()}`, JSON.stringify(encryptedAccount));
    return { address: account.address };
  }

  public async getBalance(address: string): Promise<string> {
    const web3 = await this.ensureConnection();
    if (!web3.utils.isAddress(address)) {
      throw new Error('Invalid address format');
    }
    const balance = await web3.eth.getBalance(address);
    return web3.utils.fromWei(balance, 'ether');
  }

  public async sendTransaction(fromAddress: string, toAddress: string, amount: string, privateKey: string): Promise<any> {
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
      nonce: nonce
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  }
}
