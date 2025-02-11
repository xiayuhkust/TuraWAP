import { default as i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Chat page
      chat: 'Chat',
      confirm: 'Confirm',
      officialAgents: 'Official Agents',
      communityAgents: 'Community Agents',
      workflows: 'Workflows',
      fee: 'Fee',
      contract: 'Contract',
      
      // Wallet
      copy: 'Copy',
      refresh: 'Refresh',
      leaveSession: 'Leave Session',
      clearAccount: 'Clear Account',
      
      // ReconnectDialog
      sessionExpired: 'Session Expired',
      sessionExpiredDesc: 'Your session has expired. Please enter your password to reconnect or clear your account.',
      enterPassword: 'Enter your wallet password',
      reconnect: 'Reconnect',
      reconnecting: 'Reconnecting...',
      
      // Common
      signAndDeploy: 'Sign & Deploy',
      cancel: 'Cancel',
      error: 'Error',
      loading: 'Loading...',
      confirmTransaction: 'Confirm Transaction',
      confirmTransactionDesc: 'Please confirm this transaction in your wallet.',
      errorPasswordRequired: 'Error: Password is required',
      agentOperationFailed: 'Agent operation failed',
      unknownError: 'Unknown error',
      transactionFailed: 'Transaction failed',
      speechToTextFailed: 'Failed to convert speech to text. Please try again.'
    },
    agent: {
      createWalletPrompt: 'Please enter a password for your new wallet (minimum 8 characters):',
      walletCreatedSuccess: '🎉 Wallet created successfully!\n\n🔐 IMPORTANT: Save these details securely. They will only be shown once!',
      balanceTemplate: '💰 Your wallet ({address}) contains {amount} TURA',
      loginPrompt: 'Please enter your wallet password:',
      loginSuccess: '✅ Successfully logged in! You can now check your balance or send tokens.',
      loginFailed: '❌ Login failed. Please check your password and try again.',
      invalidAddress: 'Invalid wallet address format. Please provide a valid Ethereum address.',
      needWalletFirst: 'You need to create or import a wallet first. Type \'create wallet\' to get started.',
      transactionSuccess: '✅ Successfully sent {amount} TURA!',
      transactionFailed: '❌ Transaction failed. Please try again.',
      balanceFailed: 'Failed to get balance. Please try again.',
      examples: {
        createWallet: '🔑 Create a new wallet',
        checkBalance: '💰 Check your balance',
        sendTokens: '💸 Send TURA tokens to another address'
      },
      passwordTooShort: 'Password must be at least 8 characters long.',
      walletAddress: 'Your wallet address: {address}',
      initialBalance: 'Your initial balance is {balance} TURA.',
      createWalletFailed: 'Failed to create wallet. Please try again.'
    }
  },
  zh: {
    translation: {
      // Chat page
      chat: '聊天',
      confirm: '确认',
      officialAgents: '官方代理',
      communityAgents: '社区代理',
      workflows: '工作流程',
      fee: '费用',
      contract: '合约',
      
      // Wallet
      copy: '复制',
      refresh: '刷新',
      leaveSession: '退出会话',
      clearAccount: '清除账户',
      
      // ReconnectDialog
      sessionExpired: '会话已过期',
      sessionExpiredDesc: '您的会话已过期。请输入钱包密码重新连接或清除账户。',
      enterPassword: '请输入钱包密码',
      reconnect: '重新连接',
      reconnecting: '正在重新连接...',
      
      // Common
      signAndDeploy: '签名并部署',
      cancel: '取消',
      error: '错误',
      loading: '加载中...',
      confirmTransaction: '确认交易',
      confirmTransactionDesc: '请在钱包中确认此交易',
      errorPasswordRequired: '错误：需要密码',
      agentOperationFailed: '代理操作失败',
      unknownError: '未知错误',
      transactionFailed: '交易失败',
      speechToTextFailed: '语音转文字失败，请重试'
    },
    agent: {
      createWalletPrompt: '请输入新钱包的密码（至少8个字符）：',
      walletCreatedSuccess: '🎉 钱包创建成功！\n\n🔐 重要：请安全保存以下信息，这些信息只会显示一次！',
      balanceTemplate: '💰 您的钱包（{address}）余额为 {amount} TURA',
      loginPrompt: '请输入钱包密码：',
      loginSuccess: '✅ 登录成功！您现在可以查看余额或发送代币。',
      loginFailed: '❌ 登录失败。请检查密码后重试。',
      invalidAddress: '无效的钱包地址格式。请提供有效的以太坊地址。',
      needWalletFirst: '您需要先创建或导入钱包。输入"创建钱包"开始。',
      transactionSuccess: '✅ 成功发送 {amount} TURA！',
      transactionFailed: '❌ 交易失败。请重试。',
      balanceFailed: '获取余额失败。请重试。',
      examples: {
        createWallet: '🔑 创建新钱包',
        checkBalance: '💰 查看余额',
        sendTokens: '💸 发送TURA代币'
      },
      passwordTooShort: '密码必须至少8个字符。',
      walletAddress: '您的钱包地址：{address}',
      initialBalance: '您的初始余额为 {balance} TURA。',
      createWalletFailed: '创建钱包失败。请重试。'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
