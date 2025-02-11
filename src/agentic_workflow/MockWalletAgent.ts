import { AgenticWorkflow, Intent } from './AgenticWorkflow';
import { OpenAI } from 'openai';
import { useTranslation } from 'react-i18next';
import { WalletManagerImpl } from '../lib/tura-wallet/wallet_manager';
import { WalletState } from '../lib/tura-wallet/wallet_state';

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
  private getT() {
    const { t } = useTranslation();
    return t;
  }

  protected get exampleTxt(): string[] {
    return [
      this.getT()('agent.examples.createWallet'),
      this.getT()('agent.examples.checkBalance'),
      this.getT()('agent.examples.sendTokens')
    ];
  }

  private state: { 
    type: 'idle' | 'awaiting_wallet_password' | 'awaiting_login_password';
    address?: string;
    mnemonic?: string;
    privateKey?: string;
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
    const t = this.getT();
    if (!address) {
      return ""; // Don't process if no address is provided
    }

    try {
      // Validate address format
      if (!address.startsWith('0x') || address.length !== 42) {
        return t('agent.invalidAddress');
      }

      this.state = { type: 'awaiting_login_password', address };
      return t('agent.loginPrompt');
    } catch (error) {
      console.error('Login error:', error);
      return t('agent.loginFailed');
    }
  }

  private async handleBalanceCheck(): Promise<string> {
    const address = await this.walletManager.getCurrentAddress();
    if (!address) {
      return this.getT()('agent.needWalletFirst');
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

      return this.getT()('agent.balanceTemplate', { address: shortAddress, amount: balance });
    } catch (error) {
      console.error('Failed to get balance:', error);
      return `❌ ${error instanceof Error ? error.message : this.getT()('agent.balanceFailed')}`;
    }
  }

  private async handleCreateWallet(input?: string): Promise<string> {
    if (this.state.type === 'idle') {
      this.state = { type: 'awaiting_wallet_password' };
      return this.getT()('agent.createWalletPrompt');
    }
    
    if (this.state.type === 'awaiting_wallet_password') {
      if (!input || input.length < 8) {
        return this.getT()('agent.passwordTooShort');
      }
      
      try {
        const response = await this.walletManager.createWallet(input);
        const balance = await this.walletManager.getBalance(response.address);
        
        await WalletState.getInstance().updateState({
          address: response.address,
          balance,
          isConnected: true
        });
        
        // Clear state
        this.state = { type: 'idle' };
        
        return `${this.getT()('agent.walletCreatedSuccess')}\n\n` +
               `${this.getT()('agent.mnemonicPhrase')}\n${response.mnemonic}\n\n` +
               `${this.getT()('agent.walletAddress', { address: response.address })}\n\n` +
               `${this.getT()('agent.initialBalance', { balance })}`;
      } catch (error) {
        this.state = { type: 'idle' }; // Reset on error
        console.error('Error creating wallet:', error);
        return `❌ ${error instanceof Error ? error.message : this.getT()('agent.createWalletFailed')}`;
      }
    }
    
    return '';
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
      return await this.handleCreateWallet(text);
    }
    
    if (this.state.type === 'awaiting_login_password') {
      const address = this.state.address;
      this.state = { type: 'idle' };
      if (!address) {
        return this.getT()('agent.somethingWrong');
      }
      try {
        await this.walletManager.login(address, text);
        return this.getT()('agent.loginSuccess');
      } catch (error) {
        return this.getT()('agent.loginFailed');
      }
    }
    
    // Use GPT-3.5 for intent recognition
    const recognizedIntent = await this.recognizeIntent(text);
    if (recognizedIntent.confidence >= 0.7) {
      switch (recognizedIntent.name) {
        case 'create_wallet':
          if (this.state.type !== 'idle') {
            return await this.handleCreateWallet(text);
          }
          return await this.handleCreateWallet();
        case 'check_balance':
          return await this.handleBalanceCheck();
        case 'send_tokens':
          const toAddressMatch = text.match(/0x[a-fA-F0-9]{40}/);
          const amountMatch = text.match(/\d+(\.\d+)?/);
          
          if (!toAddressMatch || !amountMatch) {
            return this.getT()('agent.invalidAmountAddress');
          }

          const fromAddress = await this.walletManager.getCurrentAddress();
          if (!fromAddress) {
            return this.getT()('agent.needWalletFirst');
          }

          try {
            const session = await this.walletManager.getSession();
            if (!session?.password) {
              return this.getT()('agent.needLogin');
            }

            const receipt = await this.walletManager.sendTransaction(
              fromAddress,
              toAddressMatch[0],
              amountMatch[0],
              session.password
            );

            if (!receipt.status) {
              return this.getT()('agent.transactionFailed');
            }

            return this.getT()('agent.transactionSuccess', { amount: amountMatch[0] });
          } catch (error) {
            console.error('Transaction error:', error);
            return `❌ ${error instanceof Error ? error.message : this.getT()('agent.transactionFailed')}`; 
          }
        case 'login':
          const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
          return await this.handleLogin(addressMatch?.[0]);
      }
    }
    
    return '';
  }
}
