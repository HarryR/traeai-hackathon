<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useWallet } from '../composables/useWallet';
import { SUPPORTED_NETWORKS } from '../utils/constants';

const { 
  connect, 
  disconnect, 
  connected, 
  connecting, 
  address, 
  chainId, 
  switchChain,
  checkExistingConnection,
  availableProviders
} = useWallet();

const hasWallet = computed(() => {
  return availableProviders.value.size > 0 || (typeof window !== 'undefined' && (window as any).ethereum);
});

const shortAddress = computed(() => {
  if (!address.value) return '';
  return `${address.value.slice(0, 6)}...${address.value.slice(-4)}`;
});

const currentNetworkName = computed(() => {
  if (!chainId.value) return 'Unknown Network';
  return SUPPORTED_NETWORKS[chainId.value]?.name || `Chain ID: ${chainId.value}`;
});

const isSupportedNetwork = computed(() => {
  return chainId.value && SUPPORTED_NETWORKS[chainId.value];
});

const handleConnect = async () => {
  try {
    await connect();
  } catch (e) {
    console.error('Connection failed:', e);
    alert('Failed to connect wallet');
  }
};

const handleSwitchNetwork = async (targetChainId: number) => {
  await switchChain(`0x${targetChainId.toString(16)}`);
};

onMounted(() => {
  checkExistingConnection();
});
</script>

<template>
  <div class="wallet-connect">
    <div v-if="!hasWallet" class="no-wallet">
      No Wallet Detected!
    </div>
    <div v-else-if="!connected">
      <button 
        @click="handleConnect" 
        :disabled="connecting"
        class="connect-btn"
      >
        {{ connecting ? 'Connecting...' : 'Connect Wallet' }}
      </button>
    </div>

    <div v-else class="wallet-info">
      <div class="network-selector">
        <span :class="{ 'unsupported': !isSupportedNetwork }">
          {{ currentNetworkName }}
        </span>
        <div class="dropdown">
          <button class="switch-btn">Switch Network</button>
          <div class="dropdown-content">
            <button 
              v-for="network in SUPPORTED_NETWORKS" 
              :key="network.chainId"
              @click="handleSwitchNetwork(network.chainId)"
              :disabled="chainId === network.chainId"
            >
              {{ network.name }}
            </button>
          </div>
        </div>
      </div>
      
      <div class="address-display">
        {{ shortAddress }}
        <button @click="disconnect" class="disconnect-btn" title="Disconnect">
          &times;
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-connect {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.connect-btn {
  background-color: #646cff;
  color: white;
  border: none;
  padding: 0.6em 1.2em;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.25s;
}

.connect-btn:hover {
  background-color: #535bf2;
}

.connect-btn:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

.no-wallet {
  color: #ff4444;
  font-weight: 500;
  padding: 0.6em 1.2em;
  border: 1px solid #ff4444;
  border-radius: 8px;
  background: rgba(255, 68, 68, 0.1);
}

.wallet-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  background: #2a2a2a;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #444;
}

.address-display {
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.disconnect-btn {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  line-height: 1;
}

.disconnect-btn:hover {
  color: #ff4444;
}

.network-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-right: 1px solid #444;
  padding-right: 1rem;
}

.unsupported {
  color: #ff4444;
}

.dropdown {
  position: relative;
  display: inline-block;
}

.switch-btn {
  background: #444;
  border: none;
  color: white;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}

.dropdown-content {
  display: none;
  position: absolute;
  right: 0;
  background-color: #333;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
  border-radius: 4px;
  overflow: hidden;
}

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown-content button {
  color: white;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}

.dropdown-content button:hover {
  background-color: #444;
}

.dropdown-content button:disabled {
  background-color: #2a2a2a;
  color: #666;
  cursor: default;
}
</style>
