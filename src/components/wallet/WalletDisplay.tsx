import { useEffect, useState } from 'react';
import { WalletState, WalletInfo } from '../../lib/tura-wallet/wallet_state';
import { Button } from '../ui/button';
import { WalletDebugInfo } from './WalletDebugInfo';

export const WalletDisplay: React.FC = () => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: '',
    balance: '0',
    isConnected: false
  });
  
  useEffect(() => {
    const walletState = WalletState.getInstance();
    const unsubscribe = walletState.subscribe(setWalletInfo);
    setWalletInfo(walletState.getState());
    return () => {
      unsubscribe();
    };
  }, []);
  
  const handleRefresh = async () => {
    await WalletState.getInstance().refreshBalance();
  };
  
  if (!walletInfo.address) return null;
  
  return (
    <>
      <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2">
        <span className="text-sm font-medium">
          {`${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => navigator.clipboard.writeText(walletInfo.address)}
          disabled={!walletInfo.isConnected}
        >
          Copy
        </Button>
        <span className="text-sm ml-auto">{walletInfo.balance} TURA</span>
        <Button 
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={handleRefresh}
          disabled={!walletInfo.isConnected}
        >
          Refresh
        </Button>
      </div>
      <WalletDebugInfo />
    </>
  );
};

export { WalletDebugInfo };
