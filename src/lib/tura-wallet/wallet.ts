import Web3 from 'web3';
// Chain configuration
import { CHAIN_CONFIG } from '../../config/chain';

export class WalletService {
  private web3: Web3;
  private provider: any;
  private connectionAttempts: number = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;

  constructor() {
    this.setupProvider();
  }

  public cleanup() {
    if (this.provider?.disconnect) {
      this.provider.disconnect();
    }
    if (this.provider?.removeAllListeners) {
      this.provider.removeAllListeners();
    }
  }

  private setupProvider() {
    try {
      this.cleanup();
      const wsUrl = CHAIN_CONFIG.rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      this.provider = new Web3.providers.WebsocketProvider(wsUrl, {
        reconnect: {
          auto: true,
          delay: this.reconnectDelay,
          maxAttempts: this.maxReconnectAttempts,
        },
        timeout: 5000,
      });

      this.web3 = new Web3(this.provider);
      
      this.provider.on('connect', () => {
        console.log('Web3 provider connected');
        this.connectionAttempts = 0;
      });
      
      this.provider.on('error', (error: Error) => {
        console.error('Web3 provider error:', error);
      });
      
      this.provider.on('end', async () => {
        console.warn('Web3 provider disconnected');
        if (this.connectionAttempts < this.maxReconnectAttempts) {
          this.connectionAttempts++;
          await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
          this.setupProvider();
        }
      });
    } catch (error) {
      console.error('Failed to setup Web3 provider:', error);
      throw error;
    }
  }



  async createAccount(privateKey?: string) {
    try {
      // Create account with private key if provided, otherwise create new one
      const account = privateKey 
        ? this.web3.eth.accounts.privateKeyToAccount(privateKey)
        : this.web3.eth.accounts.create();
      console.log('Created new account:', account.address);
      
      return {
        address: account.address,
        privateKey: account.privateKey
      };
    } catch (error) {
      console.error('Failed to create account:', error);
      if (error instanceof Error) {
        throw new Error('Failed to create wallet account: ' + error.message);
      }
      throw new Error('Failed to create wallet account');
    }
  }

  async getBalance(address: string) {
    try {
      // Validate address format
      if (!this.web3.utils.isAddress(address)) {
        throw new Error('Invalid Ethereum address format');
      }
      
      // Get and convert balance
      const balance = await this.web3.eth.getBalance(address);
      const balanceEth = this.web3.utils.fromWei(balance, 'ether');
      console.log('Balance for', address, ':', balanceEth, 'TURA');
      
      return balanceEth;
    } catch (error) {
      console.error('Failed to get balance:', error);
      if (error instanceof Error) {
        throw new Error('Failed to get wallet balance: ' + error.message);
      }
      throw new Error('Failed to get wallet balance');
    }
  }

  async sendTransaction(fromAddress: string, toAddress: string, amount: string, privateKey: string) {
    try {
      // Validate addresses
      if (!this.web3.utils.isAddress(fromAddress) || !this.web3.utils.isAddress(toAddress)) {
        throw new Error('Invalid Ethereum address format');
      }
      
      // Validate private key
      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error('Invalid private key format');
      }
      
      // Convert amount to Wei and validate
      const value = this.web3.utils.toWei(amount.toString(), 'ether');
      if (Number(value) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      
      // Get latest nonce and gas price
      const [nonce, gasPrice] = await Promise.all([
        this.web3.eth.getTransactionCount(fromAddress, 'latest'),
        this.web3.eth.getGasPrice()
      ]);
      
      // Check if account has sufficient balance
      const balance = await this.web3.eth.getBalance(fromAddress);
      const totalCost = BigInt(value) + (BigInt(gasPrice) * BigInt(21000));
      
      if (BigInt(balance) < totalCost) {
        throw new Error('Insufficient balance for transaction');
      }
      
      // Prepare transaction
      const tx = {
        from: fromAddress,
        to: toAddress,
        value: value,
        gas: 21000,  // Standard ETH transfer
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: CHAIN_CONFIG.chainId
      };
      
      // Sign and send transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(tx, privateKey);
      if (!signedTx.rawTransaction) {
        throw new Error('Failed to sign transaction');
      }
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log('Transaction successful:', receipt.transactionHash);
      // Convert Web3's receipt to our TransactionReceipt type
      return {
        transactionHash: receipt.transactionHash.toString(),
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash.toString(),
        status: Boolean(receipt.status),
        from: receipt.from?.toString(),
        to: receipt.to?.toString(),
        contractAddress: receipt.contractAddress?.toString(),
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      if (error instanceof Error) {
        throw new Error('Failed to send transaction: ' + error.message);
      }
      throw new Error('Failed to send transaction');
    }
  }
}

export default WalletService;
