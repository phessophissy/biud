/**
 * BiUD Frontend - Wallet Connection Component
 * Uses @stacks/connect for wallet integration
 * Supports both desktop (Leather) and mobile (Xverse) wallets
 */

'use client';

import { useState, useEffect } from 'react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { getPrimaryName } from '../services/biud';

const appConfig = new AppConfig(['store_write', 'publish_data']);

// Create userSession only on client side
let userSession: UserSession | null = null;
if (typeof window !== 'undefined') {
  userSession = new UserSession({ appConfig });
}

// Detect if user is on mobile device
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [primaryName, setPrimaryName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is signed in on mount (client-side only)
    checkSession();
    
    // Also check for pending sign-in (handles redirect flow on mobile)
    handlePendingSignIn();
  }, []);

  // Fetch primary name when address changes
  useEffect(() => {
    if (address) {
      fetchPrimaryName(address);
    } else {
      setPrimaryName(null);
    }
  }, [address]);

  const fetchPrimaryName = async (addr: string) => {
    try {
      const name = await getPrimaryName(addr);
      if (name) {
        setPrimaryName(name.fullName);
      } else {
        setPrimaryName(null);
      }
    } catch (error) {
      console.error('Error fetching primary name:', error);
      setPrimaryName(null);
    }
  };

  const handlePendingSignIn = async () => {
    if (typeof window === 'undefined' || !userSession) return;
    
    try {
      // Check if there's a pending sign-in from redirect
      if (userSession.isSignInPending()) {
        console.log('Pending sign-in detected, handling...');
        const userData = await userSession.handlePendingSignIn();
        if (userData) {
          const userAddress = userData?.profile?.stxAddress?.mainnet;
          if (userAddress) {
            setAddress(userAddress);
            onConnect?.(userAddress);
          }
        }
      }
    } catch (e) {
      console.error('Error handling pending sign-in:', e);
    }
  };

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
        icon: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png',
      },
      onFinish: (payload) => {
        // payload contains the authentication response directly
        console.log('Wallet connection payload:', payload);
        
        try {
          // Try to get address from payload first (more reliable on mobile)
          const addressFromPayload = payload?.userSession?.loadUserData()?.profile?.stxAddress?.mainnet;
          
          if (addressFromPayload) {
            setAddress(addressFromPayload);
            onConnect?.(addressFromPayload);
            return;
          }
          
          // Fallback: check userSession directly
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
          // Last resort: try to reload session after a small delay
          setTimeout(() => {
            checkSession();
          }, 500);
        }
      },
      onCancel: () => {
        console.log('User cancelled wallet connection');
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
    setPrimaryName(null);
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
        <div className="flex flex-col items-end">
          {primaryName ? (
            <span className="text-sm font-semibold text-bitcoin">
              {primaryName}
            </span>
          ) : null}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
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
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleConnect}
        className="bg-stacks hover:bg-stacks/90 text-white px-6 py-2 rounded-lg font-medium transition-colors"
      >
        Connect Wallet
      </button>
      {isMobileDevice() && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[200px]">
          Use Xverse mobile app for best experience
        </p>
      )}
    </div>
  );
}

// Export userSession for use in other components
export { userSession };
