import Web3 from 'web3';
import { CHAIN_CONFIG } from '../../config/chain';

declare global {
  interface Window {
    ethereum?: any;
  }
}

type ProviderState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class Web3ProviderService {
  private web3: Web3 | null = null;
  private provider: any = null;
  private state: ProviderState = 'disconnected';
  private error: Error | null = null;

  public async connect(): Promise<Web3> {
    try {
      this.state = 'connecting';
      
      if (window.ethereum) {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            this.provider = window.ethereum;
            await Promise.race([
              window.ethereum.request({ method: 'eth_requestAccounts' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Extension connection timeout')), 3000)
              )
            ]);
            break;
          } catch (err) {
            retryCount++;
            if (retryCount === maxRetries) {
              console.warn('Extension connection failed, falling back to HTTP provider');
              const endpoint = CHAIN_CONFIG.rpcUrl;
              if (!endpoint.startsWith('https://') && !endpoint.startsWith('/')) {
                throw new Error('Production endpoints must use HTTPS');
              }
              this.provider = new Web3.providers.HttpProvider(endpoint);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        const endpoint = CHAIN_CONFIG.rpcUrl;
        if (!endpoint.startsWith('https://') && !endpoint.startsWith('/')) {
          throw new Error('Production endpoints must use HTTPS');
        }
        this.provider = new Web3.providers.HttpProvider(endpoint);
      }
      
      this.web3 = new Web3(this.provider);
      await this.testConnection();
      this.state = 'connected';
      return this.web3;
    } catch (error) {
      this.state = 'error';
      this.error = error instanceof Error ? error : new Error(String(error));
      throw this.error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.web3) throw new Error('Web3 not initialized');
    await this.web3.eth.net.isListening();
  }

  public getState(): ProviderState {
    return this.state;
  }

  public getError(): Error | null {
    return this.error;
  }

  public cleanup(): void {
    if (this.provider?.disconnect) {
      this.provider.disconnect();
    }
    this.provider = null;
    this.web3 = null;
    this.state = 'disconnected';
    this.error = null;
  }
}
