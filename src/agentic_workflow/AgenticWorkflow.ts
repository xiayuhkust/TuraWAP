import { VirtualWalletSystem } from '../lib/virtual-wallet-system';

export interface Message {
  text: string;
  timestamp: string;
  sender: 'user' | 'agent';
}

export interface Intent {
  name: string;
  confidence: number;
}

export abstract class AgenticWorkflow {
  protected walletSystem: VirtualWalletSystem;
  public name: string;
  public description: string;
  protected agentConversation: Message[];
  protected abstract exampleTxt: string[];
  private storageKey: string = '';
  private currentAddress: string | null;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
    this.currentAddress = null;
    this.agentConversation = [];
    this.walletSystem = new VirtualWalletSystem();
    this.updateStorageKey();
    this.agentConversation = this.loadConversation();
  }

  private updateStorageKey(): void {
    const addressPart = this.currentAddress || 'guest';
    this.storageKey = `chat_${addressPart}_${this.name.toLowerCase().replace(/\s+/g, '_')}`;
  }

  public setCurrentAddress(address: string | null): void {
    if (this.currentAddress !== address) {
      this.currentAddress = address;
      this.updateStorageKey();
      this.agentConversation = this.loadConversation();
    }
  }

  private loadConversation(): Message[] {
    try {
      // Don't load guest conversations
      if (this.storageKey.startsWith('chat_guest_')) {
        return [];
      }
      
      const stored = this.walletSystem.getConversation(this.storageKey);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        console.error(`${this.name}: Invalid conversation format in storage`);
        return [];
      }
      
      return parsed;
    } catch (error) {
      console.error(`${this.name}: Failed to load conversation:`, error);
      return [];
    }
  }

  private saveConversation(): void {
    try {
      this.walletSystem.saveConversation(this.storageKey, JSON.stringify(this.agentConversation));
    } catch (error) {
      console.error(`${this.name}: Failed to save conversation:`, error);
    }
  }

  public async processMessage(text: string): Promise<string> {
    try {
      if (!text || text.trim() === '') {
        return '';
      }

      const timestamp = new Date().toISOString();
      const userMessage = {
        text,
        timestamp,
        sender: 'user' as const
      };

      try {
        this.agentConversation.push(userMessage);
        this.saveConversation();

        const response = await this.handleIntent({ name: 'unknown', confidence: 0.0 }, text);
        
        const agentMessage = {
          text: response,
          timestamp: new Date().toISOString(),
          sender: 'agent' as const
        };
        
        this.agentConversation.push(agentMessage);

        // Trim conversation history if too long
        if (this.agentConversation.length > 100) {
          this.agentConversation = this.agentConversation.slice(-100);
        }

        this.saveConversation();
        return response;

      } catch (error) {
        // Remove the user message if processing failed
        this.agentConversation = this.agentConversation.filter(msg => msg !== userMessage);
        throw error;
      }

    } catch (error) {
      console.error(`${this.name} error:`, error);
      
      let errorMessage: string;
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('OpenAI')) {
          errorMessage = 'I am temporarily unable to process requests. Please try again later.';
        } else if (error.message.includes('wallet') || error.message.includes('balance')) {
          errorMessage = error.message;
        } else {
          errorMessage = 'I encountered an unexpected error. Please try again or contact support.';
        }
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }

      const errorResponse = `❌ ${errorMessage}`;
      
      this.agentConversation.push({
        text: errorResponse,
        timestamp: new Date().toISOString(),
        sender: 'agent'
      });
      this.saveConversation();
      
      return errorResponse;
    }
  }

  protected abstract handleIntent(intent: Intent, text: string): Promise<string>;

  public getMessages(): Message[] {
    return this.agentConversation;
  }

  public clearMessages(): void {
    this.agentConversation = [];
    this.saveConversation();
  }
}
