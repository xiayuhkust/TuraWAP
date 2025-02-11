import i18n from 'i18next';
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
