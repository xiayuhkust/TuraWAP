import { useEffect, useState } from 'react';
import { WalletState, WalletInfo } from '../../lib/tura-wallet/wallet_state';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

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
    <Card className="p-3">
      <CardContent className="p-0">
        <div className="flex items-center gap-2">
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
      </CardContent>
    </Card>
  );
};
