declare namespace AgentTranslation {
  interface Responses {
    createWalletPrompt: string;
    walletCreatedSuccess: string;
    balanceTemplate: string;
    loginPrompt: string;
    loginSuccess: string;
    loginFailed: string;
    invalidAddress: string;
    needWalletFirst: string;
    transactionSuccess: string;
    transactionFailed: string;
    balanceFailed: string;
    examples: {
      createWallet: string;
      checkBalance: string;
      sendTokens: string;
    };
  }
}

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      agent: AgentTranslation.Responses;
    };
  }
}
