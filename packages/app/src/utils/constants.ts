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
    title: 'Dark Mode Support',
    description: 'Add a comprehensive dark mode theme across the entire application.',
    fundingAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
  },
  {
    id: 'feat-002',
    title: 'Mobile Application',
    description: 'Develop a native mobile application for iOS and Android.',
    fundingAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
  },
  {
    id: 'feat-003',
    title: 'Staking Rewards',
    description: 'Implement a staking mechanism for governance tokens.',
    fundingAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
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
