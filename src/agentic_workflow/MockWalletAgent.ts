import { AgenticWorkflow, Intent } from './AgenticWorkflow';
import { OpenAI } from 'openai';
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
  private messages = {
    en: {
      createWallet: "🔑 Create a new wallet",
      checkBalance: "💰 Check your balance",
      sendTokens: "💸 Send TURA tokens to another address",
      enterPassword: "Please enter a password for your new wallet (minimum 8 characters):",
      invalidPassword: "Password must be at least 8 characters long.",
      walletCreated: "🎉 Wallet created successfully!\n\n🔐 IMPORTANT: Save these details securely. They will only be shown once!",
      invalidAddress: "Invalid wallet address format. Please provide a valid Ethereum address.",
      loginPrompt: "Please enter your wallet password:",
      loginFailed: "Failed to process login request. Please try again.",
      needWallet: "You need to create or import a wallet first. Type 'create wallet' to get started.",
      balanceFailed: "Failed to get balance. Please try again.",
      loginSuccess: "✅ Successfully logged in! You can now check your balance or send tokens.",
      transactionFailed: "❌ Transaction failed. Please try again."
    },
    zh: {
      createWallet: "🔑 创建新钱包",
      checkBalance: "💰 查看余额",
      sendTokens: "💸 发送TURA代币",
      enterPassword: "请输入新钱包的密码（至少8个字符）：",
      invalidPassword: "密码必须至少8个字符。",
      walletCreated: "🎉 钱包创建成功！\n\n🔐 重要：请安全保存以下信息，这些信息只会显示一次！",
      invalidAddress: "无效的钱包地址格式。请提供有效的以太坊地址。",
      loginPrompt: "请输入钱包密码：",
      loginFailed: "登录请求处理失败。请重试。",
      needWallet: "您需要先创建或导入钱包。输入"创建钱包"开始。",
      balanceFailed: "获取余额失败。请重试。",
      loginSuccess: "✅ 登录成功！您现在可以查看余额或发送代币。",
      transactionFailed: "❌ 交易失败。请重试。"
    }
  };

  private currentLang = localStorage.getItem('language') || 'en';

  protected get exampleTxt(): string[] {
    return [
      this.messages[this.currentLang].createWallet,
      this.messages[this.currentLang].checkBalance,
      this.messages[this.currentLang].sendTokens
    ];
  };

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
    if (!address) {
      return ""; // Don't process if no address is provided
    }

    try {
      // Validate address format
      if (!address.startsWith('0x') || address.length !== 42) {
        return this.messages[this.currentLang].invalidAddress;
      }

      this.state = { type: 'awaiting_login_password', address };
      return this.messages[this.currentLang].loginPrompt;
    } catch (error) {
      console.error('Login error:', error);
      return this.messages[this.currentLang].loginFailed;
    }
  }

  private async handleBalanceCheck(): Promise<string> {
    const address = await this.walletManager.getCurrentAddress();
    if (!address) {
      return this.messages[this.currentLang].needWallet;
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
      return `❌ ${error instanceof Error ? error.message : this.messages[this.currentLang].balanceFailed}`;
    }
  }

  private async handleCreateWallet(input?: string): Promise<string> {
    if (this.state.type === 'idle') {
      this.state = { type: 'awaiting_wallet_password' };
      return this.messages[this.currentLang].enterPassword;
    }
    
    if (this.state.type === 'awaiting_wallet_password') {
      if (!input || input.length < 8) {
        return this.messages[this.currentLang].invalidPassword;
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
        
        return `${this.messages[this.currentLang].walletCreated}\n\n` +
               `📝 Mnemonic Phrase:\n${response.mnemonic}\n\n` +
               `Your wallet address: ${response.address}\n\n` +
               `Your initial balance is ${balance} TURA.`;
      } catch (error) {
        this.state = { type: 'idle' }; // Reset on error
        console.error('Error creating wallet:', error);
        return `❌ ${error instanceof Error ? error.message : 'Failed to create wallet. Please try again.'}`;
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
        return "Something went wrong. Please try again.";
      }
      try {
        await this.walletManager.login(address, text);
        return this.messages[this.currentLang].loginSuccess;
      } catch (error) {
        return this.messages[this.currentLang].loginFailed;
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
              return this.messages[this.currentLang].transactionFailed;
            }

            return `✅ Successfully sent ${amountMatch[0]} TURA!`;
          } catch (error) {
            console.error('Transaction error:', error);
            return `❌ ${error instanceof Error ? error.message : this.messages[this.currentLang].transactionFailed}`;
          }
        case 'login':
          const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
          return await this.handleLogin(addressMatch?.[0]);
      }
    }
    
    return '';
  }
}
