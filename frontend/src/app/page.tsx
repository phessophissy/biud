/**
 * BiUD Frontend - Main Application Page
 * Landing page with name search functionality
 */

'use client';

import { useState } from 'react';
import WalletConnect from '../components/WalletConnect';
import NameSearch from '../components/NameSearch';
import NameDetails from '../components/NameDetails';
import ThemeToggle from '../components/ThemeToggle';

export default function Home() {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const handleNameSelected = (label: string, available: boolean, fee: number) => {
    setSelectedName(label);
    setIsAvailable(available);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="BiUD" className="w-8 h-8" />
            <span className="text-2xl font-bold text-stacks">BiUD</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">.sBTC</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <WalletConnect
              onConnect={(address) => setConnectedAddress(address)}
              onDisconnect={() => setConnectedAddress(null)}
            />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6 transition-colors">
            Your Bitcoin Username
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 transition-colors">
            Register your unique <span className="text-bitcoin font-semibold">.sBTC</span> name on the Bitcoin blockchain.
            Simple. Secure. Decentralized.
          </p>

          {/* Name Search */}
          <NameSearch onNameSelected={handleNameSelected} />

          {/* Action Buttons */}
          {selectedName && isAvailable && connectedAddress && (
            <div className="mt-8">
              <button className="px-8 py-4 bg-stacks hover:bg-stacks/90 text-white rounded-lg font-semibold text-lg transition-colors">
                Register {selectedName}.sBTC
              </button>
            </div>
          )}

          {selectedName && isAvailable && !connectedAddress && (
            <p className="mt-6 text-gray-600 dark:text-gray-400 transition-colors">
              Connect your wallet to register this name
            </p>
          )}
        </div>
      </section>

      {/* Name Details Section */}
      {selectedName && !isAvailable && (
        <section className="py-12 px-4 bg-gray-50 dark:bg-gray-800 transition-colors">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 transition-colors">Name Details</h2>
            <NameDetails label={selectedName} currentBlock={0} />
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12 transition-colors">
            Why BiUD?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white transition-colors">Secured by Bitcoin</h3>
              <p className="text-gray-600 dark:text-gray-300 transition-colors">
                Built on Stacks, your name is secured by the most secure blockchain in the world.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white transition-colors">Fast & Cheap</h3>
              <p className="text-gray-600 dark:text-gray-300 transition-colors">
                Register, renew, and transfer names with low fees and fast confirmation times.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white transition-colors">Fully Decentralized</h3>
              <p className="text-gray-600 dark:text-gray-300 transition-colors">
                No central authority. You own your name completely on-chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto text-center text-gray-500 dark:text-gray-400">
          <p>BiUD — Bitcoin Username Domain</p>
          <p className="text-sm mt-2">Built on Stacks • Secured by Bitcoin</p>
        </div>
      </footer>
    </div>
  );
}
