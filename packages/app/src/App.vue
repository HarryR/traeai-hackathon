<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Contract, JsonRpcProvider, formatEther, formatUnits, parseEther, parseUnits } from 'ethers';
import QRCode from 'qrcode';
import { useWallet } from './composables/useWallet';
import { useBalances } from './composables/useBalances';
import { FEATURES, SUPPORTED_NETWORKS, SUPPORTED_TOKENS, OWNER_PUBKEY, ERC20_ABI, deriveFeatureAddress } from './utils/constants';
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
const ethUsdPrice = ref<number | null>(null);
const loadingFeatureTotals = ref(false);
const featureTotalsError = ref<string | null>(null);
const featureTotals = ref<Record<string, { address: string; totalUsd: number | null }>>({});

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
  fetchFeatureTotals();
});

watch(pageUrl, (url) => {
  if (url) generateQr(url);
});

const handleSelectFeature = (featureId: string) => {
  selectedFeatureId.value = featureId;
  const derivedAddress = deriveFeatureAddress(featureId);
  console.log('Feature selection:', { featureId, derivedAddress });
};

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
    const fundingAddress = deriveFeatureAddress(feature.id);
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
      fundingAddress,
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
        to: fundingAddress,
        value: parseEther(contributionAmount.value.toString())
      });
    } else {
      const contract = new Contract(currency.address, ERC20_ABI, signer.value);
      tx = await contract.transfer(
        fundingAddress, 
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
    fetchFeatureTotals();
    
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

const fetchEthUsdPrice = async () => {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
  if (!response.ok) throw new Error('Failed to fetch ETH price');
  const data = await response.json();
  const price = data?.ethereum?.usd;
  if (typeof price !== 'number') throw new Error('Invalid ETH price');
  ethUsdPrice.value = price;
};

const fetchFeatureTotals = async () => {
  loadingFeatureTotals.value = true;
  featureTotalsError.value = null;

  try {
    await fetchEthUsdPrice();
  } catch (error) {
    ethUsdPrice.value = null;
  }

  try {
    const totalsByFeature: Record<string, { address: string; totalUsd: number | null }> = {};
    const networks = Object.values(SUPPORTED_NETWORKS);

    await Promise.all(FEATURES.map(async (feature) => {
      const address = deriveFeatureAddress(feature.id);
      let totalUsd: number | null = 0;
      let missingEthUsd = false;

      await Promise.all(networks.map(async (network) => {
        const provider = new JsonRpcProvider(network.rpcUrl.trim());
        const tokens = SUPPORTED_TOKENS[network.chainId] || [];

        await Promise.all(tokens.map(async (token) => {
          try {
            if (token.isNative) {
              const balance = await provider.getBalance(address);
              const amount = Number(formatEther(balance));
              const hasAmount = amount > 0;
              if (ethUsdPrice.value !== null) {
                totalUsd = (totalUsd ?? 0) + amount * ethUsdPrice.value;
              } else if (hasAmount) {
                missingEthUsd = true;
              }
              return;
            }

            const contract = new Contract(token.address, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);
            const amount = Number(formatUnits(balance, token.decimals));
            if (token.isStableUsd) {
              totalUsd = (totalUsd ?? 0) + amount;
            }
          } catch (error) {
          }
        }));
      }));

      if (missingEthUsd) totalUsd = null;
      totalsByFeature[feature.id] = { address, totalUsd };
    }));

    featureTotals.value = totalsByFeature;
  } catch (error) {
    featureTotalsError.value = 'Failed to load feature totals.';
  } finally {
    loadingFeatureTotals.value = false;
  }
};

const formatUsdAmount = (amount: number) => {
  if (!Number.isFinite(amount)) return '$0.00';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
};

</script>

<template>
  <div class="container">
    <header>
      <div class="brand">
        <h1>NomadCam Feature Requests</h1>
        <p class="subtitle">Portable security you control from anywhere</p>
        <a
          class="project-link"
          href="https://github.com/harryR/nomadcam"
          target="_blank"
          rel="noopener"
        >
          github.com/harryR/nomadcam
        </a>
      </div>
      <WalletConnect />
    </header>
    
    <main>
      <section class="intro-section">
        <div class="intro-card">
          <h2 class="intro-title">Turn any Android tablet into a private security cam</h2>
          <p class="intro-copy">
            NomadCam is a motion-detecting camera that alerts you through Telegram, runs fully on-device,
            and works over WiFi or cellular. No subscriptions, no cloud lock-in, just hardware you already own.
          </p>
          <p class="intro-copy">
            We use feature requests to focus on what matters most for travelers and to fund device testing,
            platform releases, and long-term maintenance.
          </p>
          <div class="intro-pills">
            <span class="intro-pill">Telegram control</span>
            <span class="intro-pill">No cloud</span>
            <span class="intro-pill">WiFi or cellular</span>
            <span class="intro-pill">GPU motion detection</span>
          </div>
        </div>
        <div class="intro-card intro-card-accent">
          <h3 class="intro-title">Set it and forget it</h3>
          <p class="intro-copy">
            Pair a Find My Device Network tracker to auto-arm when you leave and disarm when you return.
            Point, scan the QR link to Telegram, and get instant motion GIFs if something moves.
          </p>
          <div class="intro-pills">
            <span class="intro-pill">Auto arm/disarm</span>
            <span class="intro-pill">Instant alerts</span>
            <span class="intro-pill">Portable setup</span>
          </div>
        </div>
        <div class="intro-card intro-card-media">
          <h3 class="intro-title">See the demo</h3>
          <img
            class="demo-media"
            src="https://raw.githubusercontent.com/HarryR/nomadcam/main/docs/demo.webp"
            alt="NomadCam demo"
          />
          <p class="intro-copy">
            Motion detection, Telegram control, and zero cloud dependence in one portable setup.
          </p>
        </div>
      </section>

      <!-- Feature Selection Section -->
      <section class="features-section">
        <h2>Choose a feature to support</h2>
        <div class="features-grid">
          <div 
            v-for="feature in FEATURES" 
            :key="feature.id" 
            class="feature-card"
            :class="{ selected: selectedFeatureId === feature.id }"
            @click="handleSelectFeature(feature.id)"
          >
            <div class="feature-header">
              <div class="radio-indicator"></div>
              <h3>{{ feature.title }}</h3>
            </div>
            <p class="feature-desc">{{ feature.description }}</p>
            <div class="feature-totals">
              <div v-if="loadingFeatureTotals" class="feature-totals-status">Loading totals...</div>
              <div v-else-if="featureTotalsError" class="feature-totals-status">{{ featureTotalsError }}</div>
              <div v-else-if="featureTotals[feature.id]" class="feature-totals-list">
                <div v-if="featureTotals[feature.id].totalUsd !== null" class="feature-total-usd">
                  {{ formatUsdAmount(featureTotals[feature.id].totalUsd) }} donated
                </div>
                <div v-else class="feature-total-usd">USD total unavailable</div>
              </div>
            </div>
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

.project-link {
  color: #a0b7ff;
  text-decoration: none;
  font-size: 0.9rem;
}

.project-link:hover {
  color: #c4d1ff;
}

.intro-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.intro-card {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 1.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.intro-card-accent {
  border-color: rgba(100, 108, 255, 0.4);
  background: linear-gradient(145deg, rgba(30, 30, 30, 0.95), rgba(32, 32, 42, 0.95));
}

.intro-card-media {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.intro-title {
  margin: 0 0 0.75rem;
  color: #f2f2f2;
  font-size: 1.2rem;
}

.intro-copy {
  margin: 0 0 1.25rem;
  color: #b5b5b5;
  line-height: 1.6;
}

.intro-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.intro-pill {
  background: rgba(100, 108, 255, 0.12);
  color: #c8d0ff;
  border: 1px solid rgba(100, 108, 255, 0.25);
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
}

.demo-media {
  width: 100%;
  border-radius: 12px;
  border: 1px solid #333;
  background: #0f0f0f;
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

.feature-totals {
  margin-top: 0.75rem;
  margin-left: calc(20px + 1rem);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #bdbdbd;
}

.feature-totals-status {
  color: #7f8cff;
}

.feature-total-usd {
  color: #e2e6ff;
  font-weight: 600;
  margin-top: 0.1rem;
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
