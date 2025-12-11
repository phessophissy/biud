/**
 * BiUD Frontend - Wallet Connection Component
 * Uses @stacks/connect for wallet integration
 */

'use client';

import { useState, useEffect } from 'react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);

// Create userSession only on client side
let userSession: UserSession | null = null;
if (typeof window !== 'undefined') {
  userSession = new UserSession({ appConfig });
}

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is signed in on mount (client-side only)
    checkSession();
  }, []);

  const clearSession = () => {
    // Clear any stored session data
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('blockstack-session');
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('blockstack') || key.startsWith('stacks')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    setAddress(null);
  };

  const checkSession = () => {
    if (typeof window === 'undefined' || !userSession) {
      setIsLoading(false);
      return;
    }

    try {
      // First check if there's actually session data before calling isUserSignedIn
      const sessionData = localStorage.getItem('blockstack-session');
      if (!sessionData) {
        setIsLoading(false);
        return;
      }

      if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        const userAddress = userData?.profile?.stxAddress?.mainnet;
        if (userAddress) {
          setAddress(userAddress);
          onConnect?.(userAddress);
        }
      }
    } catch (e) {
      // Session data corrupted, clear it
      console.log('Session check failed, clearing session:', e);
      clearSession();
    }
    setIsLoading(false);
  };

  const handleConnect = () => {
    if (!userSession) return;
    
    showConnect({
      appDetails: {
        name: 'BiUD - Bitcoin Username Domain',
        icon: '/logo.png',
      },
      onFinish: () => {
        try {
          if (userSession?.isUserSignedIn()) {
            const userData = userSession.loadUserData();
            const userAddress = userData?.profile?.stxAddress?.mainnet;
            if (userAddress) {
              setAddress(userAddress);
              onConnect?.(userAddress);
            }
          }
        } catch (e) {
          console.error('Connection finish error:', e);
        }
      },
      userSession,
    });
  };

  const handleDisconnect = () => {
    // Sign out from user session
    try {
      userSession?.signUserOut();
    } catch (e) {
      // Ignore signout errors
    }
    
    clearSession();
    onDisconnect?.();
  };

  if (isLoading) {
    return (
      <button
        disabled
        className="bg-gray-600 text-white px-4 py-2 rounded-lg opacity-50"
      >
        Loading...
      </button>
    );
  }

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={handleDisconnect}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="bg-stacks hover:bg-stacks/90 text-white px-6 py-2 rounded-lg font-medium transition-colors"
    >
      Connect Wallet
    </button>
  );
}

// Export userSession for use in other components
export { userSession };
