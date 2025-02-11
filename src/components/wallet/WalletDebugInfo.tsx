import React, { useEffect, useState } from 'react';
import { WalletState } from '../../lib/tura-wallet/wallet_state';
import { WalletManagerImpl } from '../../lib/tura-wallet/wallet_manager';

export const WalletDebugInfo: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState({
    address: '',
    isConnected: false,
    sessionExpires: null as number | null,
    sessionReadStatus: {
      hasEncryptedData: false,
      decryptionSuccess: false,
      lastError: '',
      lastAttempt: null as number | null
    }
  });

  useEffect(() => {
    const walletState = WalletState.getInstance();
    const walletManager = new WalletManagerImpl();
    
    const updateDebugInfo = async () => {
      const currentState = walletState.getState();
      const now = Date.now();
      
      // Check session storage and encryption key
      const encryptedSession = sessionStorage.getItem('wallet_session');
      const sessionKey = localStorage.getItem('wallet_session_key');
      
      let sessionReadStatus = {
        hasEncryptedData: !!encryptedSession,
        decryptionSuccess: false,
        lastError: '',
        lastAttempt: now
      };

      try {
        const session = await walletManager.getSession();
        
        if (session) {
          sessionReadStatus.decryptionSuccess = true;
        } else if (encryptedSession) {
          sessionReadStatus.lastError = 'Session decryption failed';
        }
        
        console.log('Session debug:', {
          hasEncryptedData: sessionReadStatus.hasEncryptedData,
          encryptedDataSize: encryptedSession?.length || 0,
          hasSessionKey: !!sessionKey,
          decryptionSuccess: sessionReadStatus.decryptionSuccess,
          hasSession: !!session,
          hasPassword: !!session?.password,
          expires: session?.expires ? new Date(session.expires).toLocaleString() : 'none',
          remainingTime: session?.expires ? Math.floor((session.expires - now) / 1000) : 0,
          now: new Date(now).toLocaleString(),
          isConnected: currentState.isConnected,
          address: currentState.address || 'none',
          lastActivity: localStorage.getItem('last_activity') 
            ? new Date(parseInt(localStorage.getItem('last_activity') || '0')).toLocaleString()
            : 'none',
          lastError: sessionReadStatus.lastError || 'None'
        });
        
        setDebugInfo({
          address: currentState.address,
          isConnected: currentState.isConnected,
          sessionExpires: session?.expires || null,
          sessionReadStatus
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sessionReadStatus.lastError = errorMessage;
        setDebugInfo(prev => ({
          ...prev,
          sessionReadStatus
        }));
      }
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

  const remainingTime = debugInfo.sessionExpires
    ? Math.max(0, Math.floor((debugInfo.sessionExpires - Date.now()) / 1000))
    : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm font-mono space-y-1">
      <div>Address: {debugInfo.address}</div>
      <div>Connected: {debugInfo.isConnected ? 'Yes' : 'No'}</div>
      <div className="border-b pb-1 mb-2">Session Status</div>
      <div>Session Time: {remainingTime}s</div>
      <div>Has Session: {debugInfo.sessionExpires ? 'Yes' : 'No'}</div>
      <div>Session Key: {localStorage.getItem('wallet_session_key') ? 'Present' : 'Missing'}</div>
      <div>Last Activity: {localStorage.getItem('last_activity') 
        ? new Date(parseInt(localStorage.getItem('last_activity') || '0')).toLocaleTimeString()
        : 'None'}</div>
      
      <div className="border-b pb-1 mt-3 mb-2">Session Debug</div>
      <div>Encrypted Data: {debugInfo.sessionReadStatus.hasEncryptedData ? 'Present' : 'Missing'}</div>
      <div>Decryption: {debugInfo.sessionReadStatus.decryptionSuccess ? 'Success' : 'Not Successful'}</div>
      {debugInfo.sessionReadStatus.lastError && (
        <div className="text-red-400">Error: {debugInfo.sessionReadStatus.lastError}</div>
      )}
      <div>Last Check: {debugInfo.sessionReadStatus.lastAttempt 
        ? new Date(debugInfo.sessionReadStatus.lastAttempt).toLocaleTimeString()
        : 'None'}</div>
    </div>
  );
};
