import * as React from 'react';
import { useState, useEffect } from 'react';
import { WalletState, WalletInfo } from '../../lib/tura-wallet/wallet_state';
import { Button } from '../ui/button';
import { WalletDebugInfo } from './WalletDebugInfo';
import { ReconnectDialog } from './ReconnectDialog';
import { WalletManagerImpl } from '../../lib/tura-wallet/wallet_manager';

export const WalletDisplay: React.FC = () => {
  const [showReconnect, setShowReconnect] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: '',
    balance: '0',
    isConnected: false
  });
  
  useEffect(() => {
    const walletState = WalletState.getInstance();
    const unsubscribe = walletState.subscribe((state) => {
      setWalletInfo(state);
      if (!state.isConnected && state.address) {
        setShowReconnect(true);
      }
    });
    setWalletInfo(walletState.getState());
    return () => {
      unsubscribe();
    };
  }, []);
  
  const handleRefresh = async () => {
    await WalletState.getInstance().refreshBalance();
  };

  const handleReconnect = async (password: string) => {
    const walletManager = new WalletManagerImpl();
    await walletManager.login(walletInfo.address, password);
    setShowReconnect(false);
  };

  const handleClearAccount = () => {
    const walletManager = new WalletManagerImpl();
    walletManager.logout();
    Object.keys(localStorage)
      .filter(key => key.startsWith('wallet_') || key === 'last_wallet_address')
      .forEach(key => localStorage.removeItem(key));
    setShowReconnect(false);
  };
  
  if (!walletInfo.address) return null;
  
  return (
    <>
      <div className="flex gap-4 bg-secondary/50 rounded-lg p-4">
        {/* Left section - 70% width */}
        <div className="flex-[0.7] flex flex-col gap-3">
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{walletInfo.balance} TURA</span>
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
        </div>
        
        {/* Right section - 30% width */}
        <div className="flex-[0.3] flex flex-col gap-2 justify-center">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              sessionStorage.removeItem('wallet_session');
              WalletState.getInstance().updateState({ isConnected: false });
            }}
          >
            Leave Session
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              // Clear all wallet-related data from localStorage
              Object.keys(localStorage)
                .filter(key => key.startsWith('wallet_') || key === 'last_wallet_address')
                .forEach(key => localStorage.removeItem(key));
              WalletState.getInstance().updateState({
                address: '',
                balance: '0',
                isConnected: false
              });
            }}
          >
            Clear Account
          </Button>
        </div>
      </div>
      <div className="hidden">
        <WalletDebugInfo />
      </div>
      <ReconnectDialog
        open={showReconnect}
        onClose={() => setShowReconnect(false)}
        onReconnect={handleReconnect}
        onClearAccount={handleClearAccount}
      />
    </>
  );
};

export { WalletDebugInfo };
