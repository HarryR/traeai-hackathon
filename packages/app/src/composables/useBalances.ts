import { ref, watch } from 'vue';
import { JsonRpcProvider, Contract, formatUnits, formatEther } from 'ethers';
import { SUPPORTED_NETWORKS, SUPPORTED_TOKENS, ERC20_ABI } from '../utils/constants';

// balances: chainId -> tokenSymbol -> balanceString
export type BalancesMap = Record<number, Record<string, string>>;

export function useBalances(address: string | null) {
  const balances = ref<BalancesMap>({});
  const loading = ref(false);

  const fetchBalances = async (userAddress: string) => {
    loading.value = true;
    const newBalances: BalancesMap = {};

    try {
      const promises = Object.values(SUPPORTED_NETWORKS).map(async (network) => {
        const networkBalances: Record<string, string> = {};
        newBalances[network.chainId] = networkBalances;

        try {
          const provider = new JsonRpcProvider(network.rpcUrl);
          const tokens = SUPPORTED_TOKENS[network.chainId] || [];
          
          for (const token of tokens) {
            try {
              if (token.isNative) {
                const balance = await provider.getBalance(userAddress);
                networkBalances[token.symbol] = formatEther(balance);
              } else {
                const contract = new Contract(token.address, ERC20_ABI, provider);
                const balance = await contract.balanceOf(userAddress);
                networkBalances[token.symbol] = formatUnits(balance, token.decimals);
              }
            } catch (err) {
              console.error(`Failed to fetch ${token.symbol} balance on chain ${network.chainId}:`, err);
              networkBalances[token.symbol] = 'Error';
            }
          }
        } catch (err) {
          console.error(`Failed to connect to chain ${network.chainId}:`, err);
        }
      });

      await Promise.all(promises);
      balances.value = newBalances;
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      loading.value = false;
    }
  };

  // Watch for address changes
  watch(() => address, (newAddress) => {
    if (newAddress) {
      fetchBalances(newAddress);
    } else {
      balances.value = {};
    }
  }, { immediate: true });

  return {
    balances,
    loading,
    fetchBalances
  };
}
