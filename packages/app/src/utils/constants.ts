export interface Network {
  chainId: number;
  name: string;
  rpcUrl: string;
  currency: string;
  explorerUrl: string;
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  isNative?: boolean;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  fundingAddress: string;
}

export const SUPPORTED_NETWORKS: Record<number, Network> = {
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://1rpc.io/sepolia',
    currency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io'
  }
};

export const OWNER_PUBKEY: string = '04941caf7c02e18bae7d9593670a5ca4a19d6b27c689dd432bd39169a43f9c16b7e2ed686dc7e4f9a80e8034814809f3eccb492d43e40137ef320b60755081c2fd';

export const SUPPORTED_TOKENS: Record<number, Token[]> = {
  11155111: [
    {
      address: 'NATIVE',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ethereum',
      isNative: true
    },
    {
      address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', // Mock USDC on Sepolia
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
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
