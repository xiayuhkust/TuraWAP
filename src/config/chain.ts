export const CHAIN_CONFIG = {
  chainId: 1337,
  chainName: 'Tura',
  rpcUrl: process.env.NODE_ENV === 'production'
    ? 'https://rpc-beta1.turablockchain.com'
    : '/rpc',
  nativeCurrency: {
    name: 'TURA',
    symbol: 'TURA',
    decimals: 18
  }
} as const;
