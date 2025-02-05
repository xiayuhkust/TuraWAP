export interface UserTableEntry {
  balance: number;
}

export interface UserTable {
  [address: string]: UserTableEntry;
}

export interface TransactionResult {
  success: boolean;
  message: string;
  newBalance?: number;
}

import type { AgentData } from '../types/agentTypes';
import { WalletManager, WalletManagerImpl } from './tura-wallet/wallet_manager';

export interface AgentTable {
  agents: AgentData[];
}

export class VirtualWalletSystem {
  private walletManager: WalletManager;
  private readonly agentTableKey = 'mockAgentTable';

  constructor() {
    this.walletManager = new WalletManagerImpl();
  }

  public async createWallet(password: string): Promise<{ address: string }> {
    const response = await this.walletManager.createWallet(password);
    return { address: response.address };
  }

  public async getBalance(address: string): Promise<number> {
    const balance = await this.walletManager.getBalance(address);
    return parseFloat(balance);
  }

  public async transferTokens(
    fromAddress: string,
    toAddress: string,
    amount: number,
    password: string
  ): Promise<TransactionResult> {
    try {
      const receipt = await this.walletManager.sendTransaction(
        fromAddress,
        toAddress,
        amount.toString(),
        password
      );
      return {
        success: receipt.status,
        message: receipt.status ? 'Transaction successful' : 'Transaction failed',
        newBalance: await this.getBalance(fromAddress)
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Transaction failed',
        newBalance: await this.getBalance(fromAddress)
      };
    }
  }

  public async login(address: string, password: string): Promise<{ address: string }> {
    const response = await this.walletManager.login(address, password);
    return { address: response.address };
  }

  public async getSession() {
    return this.walletManager.getSession();
  }

  public saveAgent(agentData: AgentData): boolean {
    try {
      const agentTable = JSON.parse(localStorage.getItem(this.agentTableKey) || '{"agents":[]}') as AgentTable;
      agentTable.agents.push(agentData);
      localStorage.setItem(this.agentTableKey, JSON.stringify(agentTable));
      return true;
    } catch (error) {
      console.error('Failed to save agent:', error);
      return false;
    }
  }

  public getAgentsByOwner(address: string): AgentData[] {
    try {
      const agentTable = JSON.parse(localStorage.getItem(this.agentTableKey) || '{"agents":[]}') as AgentTable;
      return agentTable.agents.filter(agent => agent.owner === address);
    } catch (error) {
      console.error('Failed to get agents:', error);
      return [];
    }
  }

  public getConversation(key: string): string | null {
    return localStorage.getItem(key);
  }

  public saveConversation(key: string, data: string): void {
    localStorage.setItem(key, data);
  }
}
