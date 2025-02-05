import { AgenticWorkflow, Intent } from './AgenticWorkflow';
import { OpenAI } from 'openai';
import { VirtualWalletSystem } from '../lib/virtual-wallet-system';
import type { SessionData, WalletResponse } from '../lib/tura-wallet/wallet_manager';

/// <reference types="vite/client" />

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
  private state: { 
    type: 'idle' | 'awaiting_wallet_password' | 'awaiting_login_password';
    address?: string;
  } = { type: 'idle' };

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

Just let me know what you'd like to do!`;
  }

  private async handleLogin(address?: string): Promise<string> {
    if (!address) {
      return "Please provide your wallet address to log in.";
    }

    try {
      // Validate address format
      if (!address.startsWith('0x') || address.length !== 42) {
        return "Invalid wallet address format. Please provide a valid Ethereum address.";
      }

      this.state = { type: 'awaiting_login_password', address };
      return "Please enter your wallet password:";
    } catch (error) {
      console.error('Login error:', error);
      return "Failed to process login request. Please try again.";
    }
  }

  private async handleBalanceCheck(): Promise<string> {
    const session = await this.walletSystem.getSession();
    if (!session?.password) {
      return "You need to log in to your wallet first. Please provide your wallet address and I'll help you log in.";
    }

    const walletAddress = (session as WalletResponse).address;
    const balance = await this.walletSystem.getBalance(walletAddress);
    const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    return `💰 Your wallet (${shortAddress}) contains ${balance} TURA`;
  }

  private async handleCreateWallet(password?: string): Promise<string> {
    try {
      if (!password) {
        this.state = { type: 'awaiting_wallet_password' };
        return "Please provide a password for your new wallet (minimum 8 characters):";
      }

      if (password.length < 8) {
        return "Password must be at least 8 characters long. Please try again:";
      }

      const response = await this.walletSystem.createWallet(password);
      
      return `🎉 Wallet created successfully!\nYour wallet address: ${response.address}\n\n` +
             `Your initial balance is 0 TURA.`;
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
LOGIN - When user wants to log in to their wallet
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

    // Handle password states
    if (this.state.type === 'awaiting_wallet_password') {
      this.state = { type: 'idle' };
      return await this.handleCreateWallet(text);
    }
    
    if (this.state.type === 'awaiting_login_password') {
      const address = this.state.address;
      this.state = { type: 'idle' };
      if (!address) {
        return "Something went wrong. Please try again.";
      }
      try {
        await this.walletSystem.login(address, text);
        return "✅ Successfully logged in! You can now check your balance or send tokens.";
      } catch (error) {
        return "❌ Login failed. Please check your password and try again.";
      }
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
          const toAddressMatch = text.match(/0x[a-fA-F0-9]{40}/);
          const amountMatch = text.match(/\d+(\.\d+)?/);
          
          if (!toAddressMatch || !amountMatch) {
            return "Please provide a valid wallet address and amount to send. For example: 'send 10 TURA to 0x...'";
          }

          const session = await this.walletSystem.getSession();
          if (!session?.password) {
            return "You need to log in to your wallet first. Please provide your wallet address and I'll help you log in.";
          }

          try {
            const receipt = await this.walletSystem.sendTransaction(
              (session as WalletResponse).address,
              toAddressMatch[0],
              amountMatch[0],
              session.password
            );

            if (!receipt.status) {
              return "❌ Transaction failed. Please try again.";
            }

            return `✅ Successfully sent ${amountMatch[0]} TURA!\nTransaction hash: ${receipt.transactionHash}`;
          } catch (error) {
            console.error('Transaction error:', error);
            return `❌ ${error instanceof Error ? error.message : 'Transaction failed. Please try again.'}`; 
          }
        case 'login':
          const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
          return await this.handleLogin(addressMatch?.[0]);
      }
    }
    
    return this.getWelcomeMessage();
  }
}
