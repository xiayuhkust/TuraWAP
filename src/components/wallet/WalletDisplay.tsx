import { useEffect, useState } from 'react';
import { WalletState, WalletInfo } from '../../lib/tura-wallet/wallet_state';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
    return () => unsubscribe();
  }, []);
  
  const handleRefresh = async () => {
    await WalletState.getInstance().refreshBalance();
  };
  
  if (!walletInfo.address) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Address:</span>
            <span className="text-sm">
              {`${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Balance:</span>
            <span className="text-sm">{walletInfo.balance} TURA</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={!walletInfo.isConnected}
            >
              Refresh Balance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(walletInfo.address)}
              disabled={!walletInfo.isConnected}
            >
              Copy Address
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
