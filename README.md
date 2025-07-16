# Polkamarkets POC

A simple Node.js project to interact with the PredictionMarketV3_4 smart contract using ethers.js and TypeScript.

## Features

- **Buy** prediction market shares
- **Sell** prediction market shares
- **Claim Winnings** from resolved markets
- View user market shares before and after transactions
- **ERC20 Token Support** with automatic approval handling
- **Dynamic Token Decimals** - works with any ERC20 token
- **TypeScript** support with full type safety
- **Yarn** package manager

## Installation

1. Navigate to the project directory:
```bash
cd polkamarkets-poc
```

2. Install dependencies:
```bash
yarn install
```

## Usage

The script accepts a private key as an argument and performs various actions on prediction markets.

### Basic Syntax

```bash
yarn dev <action> <privateKey> [parameters...]
```

### Available Actions

#### 1. Buy Shares
```bash
yarn dev buy <privateKey> <marketId> <outcomeId> <value> [minShares]
```

**Parameters:**
- `privateKey`: Your wallet's private key (starts with 0x)
- `marketId`: The prediction market ID
- `outcomeId`: The outcome to buy (0, 1, 2, etc.)
- `value`: Amount to spend in wei (e.g., 1000000000000000000 for 1 ETH)
- `minShares`: Minimum shares to receive (optional, defaults to 0)

**Example:**
```bash
yarn dev buy 0x1234567890abcdef... 1 0 1000000000000000000
```

#### 2. Sell Shares
```bash
yarn dev sell <privateKey> <marketId> <outcomeId> <value> [maxShares]
```

**Parameters:**
- `privateKey`: Your wallet's private key
- `marketId`: The prediction market ID
- `outcomeId`: The outcome to sell
- `value`: Amount to receive in wei
- `maxShares`: Maximum shares to sell (optional, defaults to max)

**Example:**
```bash
yarn dev sell 0x1234567890abcdef... 1 0 500000000000000000
```

#### 3. Claim Winnings
```bash
yarn dev claimWinnings <privateKey> <marketId>
```

**Parameters:**
- `privateKey`: Your wallet's private key
- `marketId`: The resolved market ID

**Example:**
```bash
yarn dev claimWinnings 0x1234567890abcdef... 1
```

## ERC20 Token Support

The application automatically handles ERC20 token interactions:

### 🔄 Automatic Features

- **Token Detection**: Automatically reads token name, symbol, and decimals
- **Balance Checking**: Verifies sufficient token balance before transactions
- **Allowance Management**: Checks and requests approval if needed
- **Dynamic Formatting**: Uses correct decimal places for any ERC20 token

### 💡 How It Works

1. **Before Buy Operations**:
   - Checks your token balance
   - Verifies allowance for the prediction market contract
   - Requests approval if insufficient allowance
   - Executes the buy transaction

2. **Supported Tokens**: Works with any standard ERC20 token (USDC, DAI, USDT, etc.)

3. **Gas Optimization**: Only requests approval when necessary

## Required Environment Variables

⚠️ **These environment variables are required before running the application:**

### Option 1: Use .env file (Recommended)

Create a `.env` file in the project root:

```bash
# .env file (automatically loaded)
RPC_URL="https://your-rpc-endpoint.com"
CONTRACT_ADDRESS="0xYourContractAddress..."
ERC20_TOKEN_ADDRESS="0xYourTokenAddress..."
```

**Example .env file:**
```bash
# .env
RPC_URL="https://rpc.sepolia.linea.build"
CONTRACT_ADDRESS="0xED5CCb260f80A7EB1E5779B02115b4dc25aA3cDE"
ERC20_TOKEN_ADDRESS="0xFEce4462D57bD51A6A552365A011b95f0E16d9B7"
```

Then run the application directly:
```bash
yarn dev buy 0x1234... 1 0 1000000000000000000
```

### Option 2: Export environment variables

```bash
# Set environment variables manually
export RPC_URL="https://rpc.sepolia.linea.build"
export CONTRACT_ADDRESS="0xED5CCb260f80A7EB1E5779B02115b4dc25aA3cDE"
export ERC20_TOKEN_ADDRESS="0xFEce4462D57bD51A6A552365A011b95f0E16d9B7"

# Then run the application
yarn dev buy 0x1234... 1 0 1000000000000000000
```

## Building for Production

To compile the TypeScript code:

```bash
yarn build
```

To run the compiled JavaScript:

```bash
yarn start buy 0x1234... 1 0 1000000000000000000
```

## Development

For development with automatic TypeScript compilation:

```bash
yarn dev <action> <privateKey> [parameters...]
```

To watch for changes and recompile automatically:

```bash
yarn watch
```

## Contract Information

- **Network**: Configured via `RPC_URL` environment variable
- **Contract Address**: Configured via `CONTRACT_ADDRESS` environment variable
- **ERC20 Token**: Configured via `ERC20_TOKEN_ADDRESS` environment variable
- **ABIs**: Located in `contracts/PredictionMarketV3_4.json` and `contracts/ERC20.json`

**Example Configuration:**
- **Network**: Linea Sepolia (`https://rpc.sepolia.linea.build`)
- **Contract**: `0xED5CCb260f80A7EB1E5779B02115b4dc25aA3cDE`
- **Token**: `0xFEce4462D57bD51A6A552365A011b95f0E16d9B7` (USDC on Linea Sepolia)

## Safety Notes

⚠️ **Important Security Information:**

1. **Never commit private keys** to version control
2. **Use environment variables** for sensitive data in production
3. **Test with small amounts** first
4. **Verify contract addresses** before use

## Project Structure

```
polkamarkets-poc/
├── src/
│   └── index.ts              # Main TypeScript application
├── contracts/
│   └── PredictionMarketV3_4.json  # Contract ABI
├── dist/                     # Compiled JavaScript (after build)
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Example Output

```
Connected to: https://rpc.sepolia.linea.build
Wallet address: 0x1234567890abcdef1234567890abcdef12345678
Wallet balance: 1.0 ETH

Contract address: 0xED5CCb260f80A7EB1E5779B02115b4dc25aA3cDE
Token address: 0xFEce4462D57bD51A6A552365A011b95f0E16d9B7

Token: USD Coin (USDC)
Decimals: 6

User shares for market 1:
  Liquidity: 0.0 USDC
  Outcome shares: 0.0, 0.0
---

Executing buy:
  Market ID: 1
  Outcome ID: 0
  Value: 10.0 USDC
  Min Shares: 0

USDC balance: 100.0 USDC
Checking USDC allowance...
Current allowance: 5.0 USDC
Required amount: 10.0 USDC

Insufficient allowance. Approving 10.0 USDC...
Approval gas estimate: 46000
Gas price: 0.5 gwei
Approval transaction sent: 0xdef123...
Approval confirmed in block: 12345677
✅ Approval successful!

Estimated gas: 95000
Gas price: 0.5 gwei
Transaction sent: 0xabcdef1234567890...
Transaction confirmed in block: 12345678
Gas used: 89234

---

User shares for market 1:
  Liquidity: 0.0 USDC
  Outcome shares: 9.5, 0.0

Action completed successfully! ✅
```

## Troubleshooting

- **"Insufficient funds"**: Check your wallet balance
- **"Market not found"**: Verify the market ID exists
- **"Invalid outcome"**: Check the outcome ID is valid for the market
- **"Transaction reverted"**: Check market status and your permissions
