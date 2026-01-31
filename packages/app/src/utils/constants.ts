import { secp256k1 } from '@noble/curves/secp256k1';
import { getAddress, keccak256, toUtf8Bytes } from 'ethers';

export interface Network {
  chainId: number;
  name: string;
  rpcUrl: string;
  currency: string;
  explorerUrl: string;
  isTestnet: boolean;
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  isNative?: boolean;
  isStableUsd?: boolean;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  fundingAddress: string;
}

export const SUPPORTED_NETWORKS: Record<number, Network> = {
  1: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://1rpc.io/eth',
    currency: 'ETH',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false
  },
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://1rpc.io/sepolia',
    currency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://1rpc.io/matic',
    currency: 'ETH',
    explorerUrl: 'https://polygonscan.com/',
    isTestnet: false
  }
};

export const OWNER_PUBKEY: string = '04941caf7c02e18bae7d9593670a5ca4a19d6b27c689dd432bd39169a43f9c16b7e2ed686dc7e4f9a80e8034814809f3eccb492d43e40137ef320b60755081c2fd';
export const FEATURE_ROOT_PUBKEY: string = '04aa6211a9034ee81b0e338ec728d2ab2eb624a4299d17b763d9566b9a6845876daaf08883451420ad82adbf2b87cbce583aee8fde0cb07e0e0ea6f85f5f816e5e';

const SECP256K1_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

function hashFeatureIdToScalar(featureId: string): bigint {
  const digest = keccak256(toUtf8Bytes(featureId));
  const scalar = BigInt(digest) % SECP256K1_ORDER;
  return scalar === 0n ? 1n : scalar;
}

export function deriveFeatureAddress(featureId: string): string {
  const scalar = hashFeatureIdToScalar(featureId);
  const rootPoint = secp256k1.ProjectivePoint.fromHex(FEATURE_ROOT_PUBKEY);
  const derivedPoint = rootPoint.multiply(scalar);
  const uncompressed = derivedPoint.toRawBytes(false);
  const hash = keccak256(uncompressed.slice(1));
  return getAddress(`0x${hash.slice(-40)}`);
}

export const SUPPORTED_TOKENS: Record<number, Token[]> = {
  1: [
    {
      address: 'NATIVE',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ethereum',
      isNative: true
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      isStableUsd: true
    }
  ],
  11155111: [
    {
      address: 'NATIVE',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ethereum',
      isNative: true
    },
    {
      address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      isStableUsd: true
    }
  ],
  137: [
    {
      address: 'NATIVE',
      symbol: 'POL',
      decimals: 18,
      name: 'Polygon',
      isNative: true
    },
    {
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      isStableUsd: true
    }
  ]
};

export const FEATURES: Feature[] = [
  {
    id: 'feat-001',
    title: 'Smart Zones & Quiet Hours',
    description: 'Draw motion zones, ignore hotspots, and schedule quiet hours to reduce false alerts.',
    fundingAddress: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
  },
  {
    id: 'feat-002',
    title: 'Event Timeline & Clip Vault',
    description: 'Review a timeline of motion events with GIF/video clips and one-tap export.',
    fundingAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'
  },
  {
    id: 'feat-003',
    title: 'Multi-Device Coverage',
    description: 'Link multiple tablets or phones to one account with unified alerts.',
    fundingAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906'
  },
  {
    id: 'feat-004',
    title: 'Publish on F-Droid',
    description: 'Ship a reproducible build and official listing for the open-source Android store.',
    fundingAddress: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65'
  },
  {
    id: 'feat-005',
    title: 'Publish on Google Play',
    description: 'Release a polished Play Store build with Play Integrity compliance.',
    fundingAddress: '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc'
  },
  {
    id: 'feat-006',
    title: 'iPhone & iPad Companion',
    description: 'Launch an iOS/iPadOS client for viewing alerts, clips, and status.',
    fundingAddress: '0x976ea74026e726554db657fa54763abd0c3a0aa9'
  },
  {
    id: 'feat-007',
    title: 'Offline Clip Buffer',
    description: 'Store recent clips locally and sync once connectivity returns.',
    fundingAddress: '0x14dc79964da2c08b23698b3d3cc7ca32193d9955'
  },
  {
    id: 'feat-008',
    title: 'Smart Person Detection',
    description: 'Optional on-device person detection to reduce pet or curtain false positives.',
    fundingAddress: '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f'
  }
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];
