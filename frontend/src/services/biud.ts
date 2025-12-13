/**
 * BiUD Frontend - Stacks Contract Service
 * Handles all interactions with the BiUD smart contract
 */

import {
  callReadOnlyFunction,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringUtf8CV,
  principalCV,
  uintCV,
  ClarityValue,
  cvToJSON,
  TxBroadcastResult,
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet, StacksDevnet } from '@stacks/network';

// Contract configuration - MAINNET DEPLOYED
const CONTRACT_ADDRESS = 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97';
const CONTRACT_NAME = 'biud-username-v3';

// Network configuration (change based on environment)
const getNetwork = () => {
  const env = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
  switch (env) {
    case 'mainnet':
      return new StacksMainnet();
    case 'testnet':
      return new StacksTestnet();
    default:
      return new StacksDevnet();
  }
};

// Helper to parse Clarity values to JSON
const parseResult = (result: ClarityValue) => {
  return cvToJSON(result);
};

// ════════════════════════════════════════════════════════════════════════════
// READ-ONLY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Check if a name is available for registration
 */
export async function isNameAvailable(label: string): Promise<boolean> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'is-available',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value;
}

/**
 * Get full name information
 */
export async function getNameInfo(label: string): Promise<any | null> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-name',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value || null;
}

/**
 * Get owner of a name
 */
export async function getOwner(label: string): Promise<string | null> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-owner',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value || null;
}

/**
 * Get expiry block height for a name
 */
export async function getExpiry(label: string): Promise<number | null> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-expiry',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value ? parseInt(parsed.value) : null;
}

/**
 * Check if a name is premium
 */
export async function isPremiumName(label: string): Promise<boolean> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'is-premium-name',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value;
}

/**
 * Get registration fee for a label
 */
export async function getRegistrationFee(label: string): Promise<number> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-registration-fee',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parseInt(parsed.value);
}

/**
 * Get current fee configuration
 */
export async function getFeeConfig(): Promise<any> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-fee-config',
    functionArgs: [],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  return parseResult(result);
}

/**
 * Get all names owned by a principal
 */
export async function getNamesByOwner(owner: string): Promise<number[]> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-names-by-owner',
    functionArgs: [principalCV(owner)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value?.['name-ids'] || [];
}

/**
 * Get label by name ID (reverse lookup)
 */
export async function getLabelById(nameId: number): Promise<string | null> {
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-label-by-id',
    functionArgs: [uintCV(nameId)],
    network: getNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  
  const parsed = parseResult(result);
  return parsed.value || null;
}

/**
 * Get the primary/display name for an address
 * Returns the first registered name (will use get-primary-name in v4)
 */
export async function getPrimaryName(address: string): Promise<{
  label: string;
  fullName: string;
} | null> {
  try {
    // Get all name IDs owned by this address
    const nameIds = await getNamesByOwner(address);
    
    if (!nameIds || nameIds.length === 0) {
      return null;
    }
    
    // Get the first name ID (primary)
    // Handle both raw number and object with value property
    const firstEntry = nameIds[0];
    const firstNameId = typeof firstEntry === 'object' && firstEntry !== null 
      ? (firstEntry as any).value 
      : firstEntry;
    
    if (firstNameId === undefined || firstNameId === null) {
      return null;
    }
    
    // Get the label for this name ID
    const label = await getLabelById(firstNameId);
    
    if (!label) {
      return null;
    }
    
    return {
      label,
      fullName: `${label}.sBTC`,
    };
  } catch (error) {
    console.error('Error fetching primary name:', error);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TRANSACTION OPTIONS (For use with @stacks/connect)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get transaction options for registering a name
 */
export function getRegisterNameOptions(label: string) {
  return {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'register-name',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  };
}

/**
 * Get transaction options for renewing a name
 */
export function getRenewNameOptions(label: string) {
  return {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'renew-name',
    functionArgs: [stringUtf8CV(label)],
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  };
}

/**
 * Get transaction options for transferring a name
 */
export function getTransferNameOptions(label: string, newOwner: string) {
  return {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'transfer-name',
    functionArgs: [stringUtf8CV(label), principalCV(newOwner)],
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  };
}

/**
 * Get transaction options for setting a resolver
 */
export function getSetResolverOptions(label: string, resolver: string) {
  return {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'set-resolver',
    functionArgs: [stringUtf8CV(label), principalCV(resolver)],
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Format STX amount from microSTX
 */
export function formatSTX(microSTX: number): string {
  return (microSTX / 1_000_000).toFixed(6);
}

/**
 * Validate label format (lowercase a-z, 0-9, hyphen, 1-32 chars)
 */
export function validateLabel(label: string): { valid: boolean; error?: string } {
  if (!label || label.length === 0) {
    return { valid: false, error: 'Label cannot be empty' };
  }
  
  if (label.length > 32) {
    return { valid: false, error: 'Label cannot exceed 32 characters' };
  }
  
  const validPattern = /^[a-z0-9-]+$/;
  if (!validPattern.test(label)) {
    return { valid: false, error: 'Label can only contain lowercase letters, numbers, and hyphens' };
  }
  
  if (label.startsWith('-') || label.endsWith('-')) {
    return { valid: false, error: 'Label cannot start or end with a hyphen' };
  }
  
  return { valid: true };
}

/**
 * Get full name with TLD
 */
export function getFullName(label: string): string {
  return `${label}.sBTC`;
}

/**
 * Estimate blocks until expiry
 */
export function estimateTimeUntilExpiry(currentBlock: number, expiryBlock: number): string {
  const blocksRemaining = expiryBlock - currentBlock;
  
  if (blocksRemaining <= 0) {
    return 'Expired';
  }
  
  // Approximate 10 minutes per block
  const minutesRemaining = blocksRemaining * 10;
  const daysRemaining = Math.floor(minutesRemaining / 60 / 24);
  
  if (daysRemaining > 365) {
    return `~${Math.floor(daysRemaining / 365)} years`;
  } else if (daysRemaining > 30) {
    return `~${Math.floor(daysRemaining / 30)} months`;
  } else if (daysRemaining > 0) {
    return `~${daysRemaining} days`;
  } else {
    return `<1 day`;
  }
}
