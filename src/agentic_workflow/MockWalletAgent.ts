import { AgenticWorkflow, Intent } from './AgenticWorkflow';
import { OpenAI } from 'openai';
import { VirtualWalletSystem } from '../lib/virtual-wallet-system';
import { Wallet } from 'ethers';

// Initialize OpenAI client with API key from environment
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('OpenAI API key not found in environment variables');
  throw new Error('OpenAI API key is required for intent recognition');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export class MockWalletAgent extends AgenticWorkflow {
  private state: { type: 'idle' | 'awaiting_faucet_confirmation' } = { type: 'idle' };
  // Using inherited walletSystem from AgenticWorkflow

  constructor() {
    super(
      "MockWalletAgent",
      "Your personal wallet assistant - I can help you check balances, send TURA, and manage your wallet."
    );
    
    this.walletSystem = new VirtualWalletSystem();
  }

  private getWelcomeMessage(): string {
    return `I can help you manage your wallet! Here's what I can do:

🔑 Create a new wallet
💰 Check your balance
💸 Send TURA tokens to another address
🚰 Get test tokens from our faucet

Just let me know what you'd like to do!`;
  }

  private async handleFaucetRequest(): Promise<string> {
    const address = this.walletSystem.getCurrentAddress();
    if (!address) {
      return "You'll need a wallet first before you can receive test tokens. Would you like me to help you create one? Just say 'create wallet' to get started.";
    }

    const balance = await this.walletSystem.getBalance(address);
    if (balance === 0) {
      this.state = { type: 'awaiting_faucet_confirmation' };
      return `Would you like to receive 100 TURA test tokens? Please confirm with 'yes' or 'y'.`;
    }
    return `You already have ${balance} TURA tokens. The faucet is only available for new wallets with 0 balance.`;
  }

  private async processFaucetDistribution(): Promise<string> {
    const address = this.walletSystem.getCurrentAddress();
    if (!address) {
      this.state = { type: 'idle' };
      return "Please create a wallet first.";
    }

    const result = await this.walletSystem.distributeFaucet(address);
    this.state = { type: 'idle' };
    return `✅ ${result.message}\nYour new balance is ${result.newBalance} TURA.`;
  }



  private async handleBalanceCheck(): Promise<string> {
    const address = this.walletSystem.getCurrentAddress();
    if (!address) {
      return "You don't have a wallet yet. Would you like me to help you create one? Just say 'create wallet' to get started.";
    }

    const balance = await this.walletSystem.getBalance(address);
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return `💰 Your wallet (${shortAddress}) contains ${balance} TURA`;
  }

  private async handleCreateWallet(): Promise<string> {
    try {
      const existingAddress = this.walletSystem.getCurrentAddress();
      if (existingAddress) {
        const balance = await this.walletSystem.getBalance(existingAddress);
        return `You already have a wallet! Your address is: ${existingAddress} with ${balance} TURA. You can ask me to check your balance or get test tokens.`;
      }

      const wallet = Wallet.createRandom();
      if (!wallet.mnemonic?.phrase) {
        throw new Error('Failed to generate mnemonic phrase');
      }

      // Keep the '0x' prefix for the private key
      const privateKey = wallet.privateKey;
        
      const { address } = this.walletSystem.createWallet(privateKey);
      this.walletSystem.setCurrentAddress(address);
      
      return `🎉 Wallet created successfully!\nYour wallet address: ${address}\n\n` +
             `🔑 Important: Save your mnemonic phrase:\n${wallet.mnemonic.phrase}\n\n` +
             `Your initial balance is 0 TURA. You can request test tokens using the faucet.`;
    } catch (error) {
      console.error('Error creating wallet:', error);
      return '❌ Failed to create wallet. Please try again.';
    }
  }

  private async recognizeIntent(text: string): Promise<Intent> {
    if (!text || text.trim() === '') {
      return { name: 'unknown', confidence: 0.0 };
    }

    const result = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a wallet assistant. Classify user messages into exactly one of these categories:
CREATE_WALLET - When user wants to create a new wallet
CHECK_BALANCE - When user wants to check their balance
SEND_TOKENS - When user wants to send/transfer TURA tokens
GET_TOKENS - When user wants to get test tokens from faucet
UNKNOWN - When the intent doesn't match any of the above

Respond with a JSON object containing 'intent' and 'confidence' fields.
Example: {"intent": "CREATE_WALLET", "confidence": 0.95}`
        },
        { role: 'user', content: text }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0,
      max_tokens: 50,
      response_format: { type: "json_object" }
    });

    const content = result.choices[0].message?.content;
    if (!content) {
      return { name: 'unknown', confidence: 0.0 };
    }

    const completion = JSON.parse(content);
    return {
      name: completion.intent?.toLowerCase() || 'unknown',
      confidence: completion.confidence || 0.0
    };
  }

  protected async handleIntent(_intent: Intent, text: string): Promise<string> {
    if (!text || text.trim() === '') {
      return this.getWelcomeMessage();
    }

    const lowerText = text.toLowerCase().trim();
    
    // Handle faucet confirmation state
    if (this.state.type === 'awaiting_faucet_confirmation') {
      if (lowerText === 'yes' || lowerText === 'y') {
        return await this.processFaucetDistribution();
      }
      this.state = { type: 'idle' };
      return "Okay, I won't send you any test tokens. Let me know if you change your mind!";
    }
    
    // Use GPT-3.5 for intent recognition
    const recognizedIntent = await this.recognizeIntent(text);
    if (recognizedIntent.confidence >= 0.7) {
      switch (recognizedIntent.name) {
        case 'create_wallet':
          return await this.handleCreateWallet();
        case 'check_balance':
          return await this.handleBalanceCheck();
        case 'send_tokens':
          return `Transfer functionality is currently under maintenance. Please try again later.`;
        case 'get_tokens':
          return await this.handleFaucetRequest();
      }
    }
    
    return this.getWelcomeMessage();
  }
}