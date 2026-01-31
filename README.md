# Trae AI Hackathon — Paid Feature Request App

Built in ~2 hours using Trae AI editor and GPT-5.2-Codex, this project turns feature requests into paid, onchain-backed contributions. Users connect a wallet, pick the feature they want most, and contribute in crypto while the app tracks totals in USD.

**What It Does**
- Collects paid feature requests with wallet-connected contributions
- Aggregates total value per feature and displays a clean USD total
- Encrypts requestor contact info for privacy-minded follow-up
- Supports Ethereum mainnet and Sepolia for live demos

**How It Works**
- A user selects a feature request and enters contribution details
- The app connects to an EVM wallet and accepts a donation
- Contributions are tracked per feature and summed into USD totals
- Donor info is encrypted client-side before submission

**Tech Stack**
- Vue 3 + Vite for the UI
- ethers v6 for wallet and chain interaction
- QR code generation for wallet connect flows
- TypeScript for reliability in a rapid build

**Local Development**
```bash
pnpm install
pnpm dev
```

**Repo Structure**
- packages/app: Vue app with components, composables, and utils

**Hackathon Notes**
- Built end-to-end in a fast iteration loop with Trae AI
- Focused on a polished donation flow and simple totals display
- Optimized for quick demoing on mainnet or Sepolia

**Next Ideas**
- Multi-chain feature pools with per-chain totals
- Creator payouts and milestone tracking
- Public roadmap board with onchain proof of support
