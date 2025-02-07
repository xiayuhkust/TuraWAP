import { useEffect, useState } from 'react';
import { WalletState } from '../../lib/tura-wallet/wallet_state';
import { WalletManagerImpl } from '../../lib/tura-wallet/wallet_manager';

export const WalletDebugInfo: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState({
    address: '',
    isConnected: false,
    sessionExpires: null as number | null
  });

  useEffect(() => {
    const walletState = WalletState.getInstance();
    const walletManager = new WalletManagerImpl();
    
    const updateDebugInfo = async () => {
      const session = await walletManager.getSession();
      const currentState = walletState.getState();
      
      setDebugInfo({
        address: currentState.address,
        isConnected: currentState.isConnected,
        sessionExpires: session?.expires || null
      });
    };

    const unsubscribe = walletState.subscribe(() => {
      updateDebugInfo();
    });

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!debugInfo.address) return null;

  const remainingTime = debugInfo.sessionExpires 
    ? Math.max(0, Math.floor((debugInfo.sessionExpires - Date.now()) / 1000))
    : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm font-mono">
      <div>Address: {debugInfo.address}</div>
      <div>Connected: {debugInfo.isConnected ? 'Yes' : 'No'}</div>
      <div>Session Time: {remainingTime}s</div>
    </div>
  );
};
