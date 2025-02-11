import * as React from 'react';
import { useState, useEffect } from 'react';
import { WalletState } from '../../lib/tura-wallet/wallet_state';
import { WalletManagerImpl } from '../../lib/tura-wallet/wallet_manager';

export const WalletDebugInfo: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState({
    address: '',
    isConnected: false,
    sessionExpires: null as number | null,
    sessionData: {
      hasSession: false,
      hasPassword: false,
      hasEncryptionKey: false,
      lastActivity: null as number | null,
      storedWallets: [] as string[],
      sessionStorageSize: 0,
      encryptionStatus: ''
    }
  });

  useEffect(() => {
    const walletState = WalletState.getInstance();
    const walletManager = new WalletManagerImpl();
    
    const updateDebugInfo = async () => {
      const session = await walletManager.getSession();
      const currentState = walletState.getState();
      
      const now = Date.now();
      const remainingTime = session?.expires ? Math.floor((session.expires - now) / 1000) : 0;
      
      // Get stored wallets
      const storedWallets = Object.keys(localStorage)
        .filter(key => key.startsWith('wallet_') && key !== 'wallet_session_key')
        .map(key => key.slice(7));

      // Check session storage size
      const sessionStorageSize = sessionStorage.getItem('wallet_session')?.length || 0;
      
      // Check encryption key status
      let encryptionStatus = 'Missing';
      const sessionKey = localStorage.getItem('wallet_session_key');
      if (sessionKey) {
        encryptionStatus = `Present (${sessionKey.length} chars)`;
      }
      
      console.log('Session debug:', {
        hasSession: !!session,
        hasPassword: !!session?.password,
        expires: session?.expires ? new Date(session.expires).toLocaleString() : 'none',
        remainingTime,
        now: new Date(now).toLocaleString(),
        isConnected: currentState.isConnected,
        address: currentState.address || 'none',
        lastActivity: localStorage.getItem('last_activity') 
          ? new Date(parseInt(localStorage.getItem('last_activity') || '0')).toLocaleString()
          : 'none',
        sessionKey: !!localStorage.getItem('wallet_session_key'),
        sessionStorageSize,
        storedWallets: storedWallets.length,
        encryptionStatus
      });
      
      setDebugInfo({
        address: currentState.address,
        isConnected: currentState.isConnected,
        sessionExpires: session?.expires || null,
        sessionData: {
          hasSession: !!session,
          hasPassword: !!session?.password,
          hasEncryptionKey: !!sessionKey,
          lastActivity: localStorage.getItem('last_activity') 
            ? parseInt(localStorage.getItem('last_activity') || '0')
            : null,
          storedWallets,
          sessionStorageSize,
          encryptionStatus
        }
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
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm font-mono space-y-1">
      <div>Address: {debugInfo.address}</div>
      <div>Connected: {debugInfo.isConnected ? 'Yes' : 'No'}</div>
      <div className="space-y-1">
        <div className="font-semibold border-b pb-1 mb-1">Session Status</div>
        <div>Session Time Remaining: {remainingTime}s</div>
        <div>Session Active: {debugInfo.sessionData.hasSession ? 'Yes' : 'No'}</div>
        <div>Session Password: {debugInfo.sessionData.hasPassword ? 'Present' : 'Missing'}</div>
        <div>Session Expires: {debugInfo.sessionExpires 
          ? new Date(debugInfo.sessionExpires).toLocaleString()
          : 'None'}</div>
        <div>Last Activity: {debugInfo.sessionData.lastActivity 
          ? new Date(debugInfo.sessionData.lastActivity).toLocaleString()
          : 'None'}</div>

        <div className="font-semibold border-b pb-1 mt-3 mb-1">Storage Info</div>
        <div>Session Storage: {debugInfo.sessionData.sessionStorageSize > 0 
          ? `Present (${debugInfo.sessionData.sessionStorageSize} bytes)` 
          : 'Missing'}</div>
        <div>Encryption Key: {debugInfo.sessionData.encryptionStatus}</div>
        <div>Last Wallet: {localStorage.getItem('last_wallet_address') || 'None'}</div>
        <div>Stored Wallets: {debugInfo.sessionData.storedWallets.length}</div>
        <div>Wallet List: {debugInfo.sessionData.storedWallets.join(', ') || 'None'}</div>
      </div>
    </div>
  );
};
