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
  import { ethers } from 'ethers';
  
  export interface AgentTable {
    agents: AgentData[];
  }
  
  export class VirtualWalletSystem {
    static instance: VirtualWalletSystem;
  
    constructor() {
      if (!VirtualWalletSystem.instance) {
        VirtualWalletSystem.instance = this;
      }
      return VirtualWalletSystem.instance;
    }
    private readonly userTableKey = 'mockUserTable';
    private readonly addressKey = 'lastWalletAddress';
    private readonly agentTableKey = 'mockAgentTable';
    private readonly faucetAmount = 100;
  
    private getUserTable(): UserTable {
      const raw = localStorage.getItem(this.userTableKey) || '{}';
      return JSON.parse(raw);
    }
  
    private saveUserTable(table: UserTable): void {
      localStorage.setItem(this.userTableKey, JSON.stringify(table));
      window.dispatchEvent(new StorageEvent('storage', {
        key: this.userTableKey,
        newValue: JSON.stringify(table)
      }));
    }
  
    public getCurrentAddress(): string | null {
      return localStorage.getItem(this.addressKey);
    }
  
    public setCurrentAddress(address: string): void {
      localStorage.setItem(this.addressKey, address);
    }
  
    public logoutAccount(): void {
      localStorage.removeItem(this.addressKey);
    }
  
    public createWallet(privateKey: string): { address: string } {
      try {
        // Add '0x' prefix if not present
        const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const wallet = new ethers.Wallet(formattedKey);
        const address = wallet.address;
  
        const userTable = this.getUserTable();
        userTable[address] = { balance: 0 };
        this.saveUserTable(userTable);
        localStorage.setItem(this.addressKey, address);
        this.setKeyData(address, privateKey);
  
        return { address };
      } catch (error) {
        console.error('Error creating wallet:', error);
        throw new Error('Failed to create wallet with the provided private key');
      }
    }
  
    public async getBalance(address: string): Promise<number> {
      const userTable = this.getUserTable();
      return userTable[address]?.balance || 0;
    }
  
    public async distributeFaucet(address: string): Promise<TransactionResult> {
      const userTable = this.getUserTable();
      userTable[address] = userTable[address] || { balance: 0 };
      userTable[address].balance += this.faucetAmount;
      this.saveUserTable(userTable);
  
      return {
        success: true,
        message: `Successfully added ${this.faucetAmount} tokens to your wallet`,
        newBalance: userTable[address].balance
      };
    }
  
    public async transferTokens(
      fromAddress: string,
      toAddress: string,
      amount: number
    ): Promise<TransactionResult> {
      const userTable = this.getUserTable();
      userTable[fromAddress] = userTable[fromAddress] || { balance: 0 };
      userTable[toAddress] = userTable[toAddress] || { balance: 0 };
      
      userTable[fromAddress].balance -= amount;
      userTable[toAddress].balance += amount;
      this.saveUserTable(userTable);
  
      return {
        success: true,
        message: `Successfully transferred ${amount} tokens`,
        newBalance: userTable[fromAddress].balance
      };
    }
  
    public async deductFee(address: string, fee: number): Promise<TransactionResult> {
      const userTable = this.getUserTable();
      userTable[address].balance -= fee;
      this.saveUserTable(userTable);
  
      return {
        success: true,
        message: `Successfully deducted fee of ${fee} tokens`,
        newBalance: userTable[address].balance
      };
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
  
    public getKeyData(address: string): string | null {
      return localStorage.getItem(`key_${address}`);
    }
  
    public setKeyData(address: string, data: string): void {
      localStorage.setItem(`key_${address}`, data);
    }
  
    public clearKeyData(address: string): void {
      localStorage.removeItem(`key_${address}`);
    }
  
    public clearAllData(): void {
      localStorage.clear();
    }
  }