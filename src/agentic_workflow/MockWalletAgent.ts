import { AgenticWorkflow, Intent } from './AgenticWorkflow';
import { OpenAI } from 'openai';
import { WalletManagerImpl } from '../lib/tura-wallet/wallet_manager';

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
  protected exampleTxt = [
    "🔑 Create a new wallet",
    "💰 Check your balance", 
    "💸 Send TURA tokens to another address"
  ];

  private state: { 
    type: 'idle' | 'awaiting_wallet_password' | 'awaiting_login_password';
    address?: string;
  } = { type: 'idle' };

  private walletManager: WalletManagerImpl;

  constructor() {
    super(
      "MockWalletAgent",
      "Your personal wallet assistant - I can help you check balances, send TURA, and manage your wallet."
    );
    
    this.walletManager = new WalletManagerImpl();
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
    const address = await this.walletManager.getCurrentAddress();
    if (!address) {
      return "You need to create or import a wallet first. Type 'create wallet' to get started.";
    }

    try {
      const balance = await this.walletManager.getBalance(address);
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

      window.dispatchEvent(new CustomEvent('wallet-updated', { 
        detail: { 
          address: address,
          balance: balance
        }
      }));

      return `💰 Your wallet (${shortAddress}) contains ${balance} TURA`;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return `❌ ${error instanceof Error ? error.message : 'Failed to get balance. Please try again.'}`;
    }
  }

  private async handleCreateWallet(password?: string): Promise<string> {
    if (!password) {
      this.state = { type: 'awaiting_wallet_password' };
      return 'Please enter a password for your new wallet (minimum 8 characters):';
    }

    try {
      const response = await this.walletManager.createWallet(password);
      const balance = await this.walletManager.getBalance(response.address);
      
      // Update WalletState
      await WalletState.getInstance().updateState({
        address: response.address,
        balance,
        isConnected: true
      });
      
      return `🎉 Wallet created successfully!\nYour wallet address: ${response.address}\n\n` +
             `🔐 Your wallet is secured with your password. Don't forget it!\n\n` +
             `Your initial balance is ${balance} TURA.`;
    } catch (error) {
      console.error('Error creating wallet:', error);
      return `❌ ${error instanceof Error ? error.message : 'Failed to create wallet. Please try again.'}`;
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
      return '';
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
        await this.walletManager.login(address, text);
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

          const fromAddress = await this.walletManager.getCurrentAddress();
          if (!fromAddress) {
            return "You need to create or import a wallet first. Type 'create wallet' to get started.";
          }

          try {
            const session = await this.walletManager.getSession();
            if (!session?.password) {
              return "Please log in to your wallet first.";
            }

            const receipt = await this.walletManager.sendTransaction(
              fromAddress,
              toAddressMatch[0],
              amountMatch[0],
              session.password
            );

            if (!receipt.status) {
              return "❌ Transaction failed. Please try again.";
            }

            return `✅ Successfully sent ${amountMatch[0]} TURA!`;
          } catch (error) {
            console.error('Transaction error:', error);
            return `❌ ${error instanceof Error ? error.message : 'Transaction failed. Please try again.'}`; 
          }
        case 'login':
          const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
          return await this.handleLogin(addressMatch?.[0]);
      }
    }
    
    return '';
  }
}
