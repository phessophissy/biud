/**
 * BiUD Frontend - Name Details Component
 * Display detailed information about a registered name
 */

'use client';

import { useState, useEffect } from 'react';
import { getNameInfo, formatSTX, estimateTimeUntilExpiry } from '../services/biud';

interface NameDetailsProps {
  label: string;
  currentBlock?: number;
}

interface NameInfo {
  label: string;
  'full-name': string;
  owner: string;
  'expiry-height': number;
  resolver: string | null;
  'is-premium': boolean;
  'name-id': number;
  'created-at': number;
  'last-renewed': number;
}

export default function NameDetails({ label, currentBlock = 0 }: NameDetailsProps) {
  const [nameInfo, setNameInfo] = useState<NameInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNameInfo() {
      setIsLoading(true);
      try {
        const info = await getNameInfo(label);
        setNameInfo(info);
        setError(null);
      } catch (err) {
        setError('Failed to fetch name information');
        setNameInfo(null);
      } finally {
        setIsLoading(false);
      }
    }

    if (label) {
      fetchNameInfo();
    }
  }, [label]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md animate-pulse transition-colors">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 transition-colors">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!nameInfo) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
        <p className="text-gray-600 dark:text-gray-400">Name not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          {nameInfo['full-name']}
        </h2>
        {nameInfo['is-premium'] && (
          <span className="px-3 py-1 bg-bitcoin text-white text-sm rounded-full">
            Premium
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Owner */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Owner</p>
          <p className="font-mono text-sm break-all text-gray-900 dark:text-white">{nameInfo.owner}</p>
        </div>

        {/* Expiry */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Expires</p>
          <p className="font-medium text-gray-900 dark:text-white">
            Block {nameInfo['expiry-height'].toLocaleString()}
          </p>
          {currentBlock > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {estimateTimeUntilExpiry(currentBlock, nameInfo['expiry-height'])}
            </p>
          )}
        </div>

        {/* Name ID */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Name ID</p>
          <p className="font-medium text-gray-900 dark:text-white">#{nameInfo['name-id']}</p>
        </div>

        {/* Created */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Created at Block</p>
          <p className="font-medium text-gray-900 dark:text-white">{nameInfo['created-at'].toLocaleString()}</p>
        </div>

        {/* Resolver */}
        {nameInfo.resolver && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg md:col-span-2 transition-colors">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Resolver</p>
            <p className="font-mono text-sm break-all text-gray-900 dark:text-white">{nameInfo.resolver}</p>
          </div>
        )}
      </div>
    </div>
  );
}
