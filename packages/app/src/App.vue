<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Contract, parseEther, parseUnits } from 'ethers';
import QRCode from 'qrcode';
import { useWallet } from './composables/useWallet';
import { useBalances } from './composables/useBalances';
import { FEATURES, SUPPORTED_NETWORKS, SUPPORTED_TOKENS, OWNER_PUBKEY, ERC20_ABI } from './utils/constants';
import { encryptMessage } from './utils/encryption';
import WalletConnect from './components/WalletConnect.vue';

const { address, connected, chainId, signer } = useWallet();
const { balances, fetchBalances, loading: loadingBalances } = useBalances(address.value);

// Contribution Form State
const selectedFeatureId = ref(FEATURES[0].id);
const email = ref('');
const contributionAmount = ref('');
const selectedCurrency = ref<string>(''); // Symbol of selected currency
const txStatus = ref<{ type: 'info' | 'success' | 'error', message: string } | null>(null);
const pageUrl = ref('');
const qrDataUrl = ref('');

// Available currencies for the current chain
const availableCurrencies = computed(() => {
  if (!chainId.value || !SUPPORTED_TOKENS[chainId.value]) return [];
  return SUPPORTED_TOKENS[chainId.value];
});

// Set default currency when chain changes or on mount
watch(availableCurrencies, (currencies) => {
  if (currencies.length > 0 && !selectedCurrency.value) {
    selectedCurrency.value = currencies[0].symbol;
  } else if (currencies.length > 0) {
    // Check if selected currency is still valid, if not reset
    const exists = currencies.find(c => c.symbol === selectedCurrency.value);
    if (!exists) selectedCurrency.value = currencies[0].symbol;
  }
}, { immediate: true });

// Watch for address changes to refetch balances
watch(address, (newAddress) => {
  if (newAddress) {
    fetchBalances(newAddress);
  }
});

const generateQr = async (url: string) => {
  try {
    qrDataUrl.value = await QRCode.toDataURL(url, { width: 180, margin: 1 });
  } catch (e) {
    qrDataUrl.value = '';
  }
};

onMounted(() => {
  pageUrl.value = window.location.href;
  if (pageUrl.value) generateQr(pageUrl.value);
});

watch(pageUrl, (url) => {
  if (url) generateQr(url);
});

const handleContribute = async () => {
  if (!connected.value || !signer.value) {
    alert('Please connect your wallet first');
    return;
  }
  
  if (!contributionAmount.value || isNaN(Number(contributionAmount.value))) {
    alert('Please enter a valid amount');
    return;
  }

  const feature = FEATURES.find(f => f.id === selectedFeatureId.value);
  if (!feature) {
    alert('Invalid feature selected');
    return;
  }

  txStatus.value = { type: 'info', message: 'Initiating transaction...' };
  
  try {
    const currency = availableCurrencies.value.find(c => c.symbol === selectedCurrency.value);
    if (!currency) throw new Error('Invalid currency selected');
    
    let encryptedEmail = '';
    if (email.value) {
      try {
        txStatus.value = { type: 'info', message: 'Encrypting data...' };
        encryptedEmail = await encryptMessage(OWNER_PUBKEY, email.value);
      } catch (e) {
        console.error('Encryption error:', e);
        // Fallback or error handling if encryption fails
        throw new Error('Failed to encrypt email');
      }
    }

    console.log('Contributing:', {
      featureId: feature.id,
      fundingAddress: feature.fundingAddress,
      email: email.value, // Keep plain for debug/log
      encryptedEmail,     // Add encrypted version
      amount: contributionAmount.value,
      currency: currency,
      network: chainId.value
    });
    
    txStatus.value = { type: 'info', message: 'Please confirm transaction in your wallet...' };
    
    let tx;
    if (currency.isNative) {
      tx = await signer.value.sendTransaction({
        to: feature.fundingAddress,
        value: parseEther(contributionAmount.value.toString())
      });
    } else {
      const contract = new Contract(currency.address, ERC20_ABI, signer.value);
      tx = await contract.transfer(
        feature.fundingAddress, 
        parseUnits(contributionAmount.value.toString(), currency.decimals)
      );
    }

    txStatus.value = { type: 'info', message: `Transaction submitted. Hash: ${tx.hash}. Waiting for confirmation...` };
    
    await tx.wait();
    
    txStatus.value = { 
      type: 'success', 
      message: `Successfully contributed ${contributionAmount.value} ${selectedCurrency.value} to ${feature.title}!` 
    };
    
    // Clear form after success
    email.value = '';
    contributionAmount.value = '';
    
    // Refetch balances
    if (address.value) fetchBalances(address.value);
    
  } catch (error: any) {
    console.error('Contribution failed:', error);
    // User rejected transaction
    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      txStatus.value = { type: 'error', message: 'Transaction rejected by user.' };
    } else {
      txStatus.value = { 
        type: 'error', 
        message: error.message || 'Transaction failed. Please try again.' 
      };
    }
  }
};

</script>

<template>
  <div class="container">
    <header>
      <div class="brand">
        <h1>Feature Request Tracker</h1>
        <p class="subtitle">Vote with your Crypto</p>
      </div>
      <WalletConnect />
    </header>
    
    <main>
      <!-- Feature Selection Section -->
      <section class="features-section">
        <h2>Choose a feature to support</h2>
        <div class="features-grid">
          <div 
            v-for="feature in FEATURES" 
            :key="feature.id" 
            class="feature-card"
            :class="{ selected: selectedFeatureId === feature.id }"
            @click="selectedFeatureId = feature.id"
          >
            <div class="feature-header">
              <div class="radio-indicator"></div>
              <h3>{{ feature.title }}</h3>
            </div>
            <p class="feature-desc">{{ feature.description }}</p>
          </div>
        </div>
      </section>

      <!-- Contribution Form -->
      <section class="contribution-section card-style">
        <h2>Make your Contribution</h2>
        <div class="form-content">
          <div class="form-group">
            <label>Your Email (Optional)</label>
            <div class="input-wrapper">
              <input 
                v-model="email" 
                type="email" 
                placeholder="updates@example.com"
                class="input-field modern-input"
              />
              <span class="input-icon">✉️</span>
            </div>
            <small>We'll notify you when this feature is shipped.</small>
          </div>

          <div class="form-group">
            <label>Contribution Amount</label>
            <div class="amount-input-group modern-group">
              <input 
                v-model="contributionAmount" 
                type="number" 
                placeholder="0.00"
                min="0"
                step="any"
                class="input-field amount-input modern-input"
              />
              <div class="currency-selector">
                <select v-model="selectedCurrency" class="currency-select" :disabled="availableCurrencies.length === 0">
                  <option v-for="token in availableCurrencies" :key="token.symbol" :value="token.symbol">
                    {{ token.symbol }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <button @click="handleContribute" class="pay-btn sexy-btn" :disabled="!connected || !contributionAmount">
            Pay & Support
          </button>

          <!-- Transaction Status -->
          <div v-if="txStatus" class="tx-status" :class="txStatus.type">
            {{ txStatus.message }}
          </div>
        </div>
      </section>

      <!-- Balances Section -->
      <section v-if="connected" class="balances-section">
        <h3>Your Balances</h3>
        <div class="balances-grid">
          <div v-for="(network, id) in SUPPORTED_NETWORKS" :key="id" class="balance-card">
            <div class="network-name">{{ network.name }}</div>
            <div class="token-balances">
              <div v-if="loadingBalances">Loading...</div>
              <div v-else-if="balances[network.chainId]">
                <div v-for="token in SUPPORTED_TOKENS[network.chainId]" :key="token.symbol" class="token-balance">
                  {{ balances[network.chainId][token.symbol] || '0.0' }} {{ token.symbol }}
                </div>
              </div>
              <div v-else>0.0</div>
            </div>
          </div>
        </div>
      </section>

      <section class="qr-section">
        <h3>Share this page</h3>
        <div class="qr-card">
          <img
            v-if="qrDataUrl"
            class="qr-image"
            :src="qrDataUrl"
            alt="QR code for this page"
          />
          <div class="qr-url">{{ pageUrl }}</div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    text-align: center;
  }

  .brand {
    margin-bottom: 0.5rem;
  }
}

.brand h1 {
  margin: 0;
  font-size: 1.5rem;
  background: linear-gradient(to right, #646cff, #42b883);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.subtitle {
  margin: 0;
  color: #888;
  font-size: 0.9rem;
}

section {
  margin-bottom: 3rem;
}

h2, h3 {
  color: #eee;
  margin-bottom: 1.5rem;
}

/* Balances */
.balances-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.balance-card {
  background: #2a2a2a;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #333;
}

.network-name {
  color: #888;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.token-balances {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.token-balance {
  font-size: 1.1rem;
  font-weight: 500;
}

/* Features */
.features-grid {
  display: grid;
  gap: 1rem;
}

.feature-card {
  background: #2a2a2a;
  padding: 1.5rem;
  border-radius: 12px;
  border: 2px solid #333;
  cursor: pointer;
  transition: all 0.2s;
}

.feature-card:hover {
  border-color: #555;
  transform: translateY(-2px);
}

.feature-card.selected {
  border-color: #646cff;
  background: rgba(100, 108, 255, 0.05);
}

.feature-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.radio-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #666;
  position: relative;
}

.feature-card.selected .radio-indicator {
  border-color: #646cff;
}

.feature-card.selected .radio-indicator::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #646cff;
}

.feature-desc {
  margin: 0;
  color: #aaa;
  margin-left: calc(20px + 1rem);
}

/* Sexy Contribution Form */
.card-style {
  background: #1e1e1e;
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid #333;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  right: 1rem;
  opacity: 0.5;
}

.modern-input {
  background: #2a2a2a;
  border: 2px solid #333;
  border-radius: 12px;
  padding: 1rem;
  font-size: 1rem;
  color: #fff;
  transition: all 0.2s;
  width: 100%;
}

.modern-input:focus {
  border-color: #646cff;
  outline: none;
  background: #333;
}

.modern-group {
  display: flex;
  gap: 0.5rem;
  background: #2a2a2a;
  border: 2px solid #333;
  border-radius: 12px;
  padding: 0.5rem;
  transition: border-color 0.2s;
}

.modern-group:focus-within {
  border-color: #646cff;
}

.modern-group .modern-input {
  border: none;
  background: transparent;
  padding: 0.5rem;
}

.currency-selector {
  position: relative;
  display: flex;
  align-items: center;
  padding-right: 0.5rem;
}

.currency-select {
  background: #1a1a1a;
  color: #fff;
  border: 1px solid #444;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}

.sexy-btn {
  background: linear-gradient(135deg, #646cff 0%, #42b883 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 1rem;
}

.sexy-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(100, 108, 255, 0.4);
}

.sexy-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #444;
}

small {
  color: #666;
}

.tx-status {
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
  animation: fadeIn 0.3s ease;
}

.tx-status.info {
  background: rgba(100, 108, 255, 0.1);
  color: #aaddff;
  border: 1px solid rgba(100, 108, 255, 0.2);
}

.tx-status.success {
  background: rgba(66, 184, 131, 0.1);
  color: #42b883;
  border: 1px solid rgba(66, 184, 131, 0.2);
}

.tx-status.error {
  background: rgba(255, 100, 100, 0.1);
  color: #ff6464;
  border: 1px solid rgba(255, 100, 100, 0.2);
}

.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
}

.qr-image {
  width: 180px;
  height: 180px;
  border-radius: 8px;
  background: #fff;
  padding: 8px;
}

.qr-url {
  color: #888;
  font-size: 0.85rem;
  word-break: break-all;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
