// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { ethers, JsonRpcProvider, Wallet, Contract, ContractTransactionReceipt } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Environment variables are required
const RPC_URL: string = process.env.RPC_URL || (() => {
  console.error('❌ Error: RPC_URL environment variable is required');
  console.error('Set it with: export RPC_URL="https://your-rpc-endpoint.com"');
  process.exit(1);
})();

const CONTRACT_ADDRESS: string = process.env.CONTRACT_ADDRESS || (() => {
  console.error('❌ Error: CONTRACT_ADDRESS environment variable is required');
  console.error('Set it with: export CONTRACT_ADDRESS="0xYourContractAddress..."');
  process.exit(1);
})();

const ERC20_TOKEN_ADDRESS: string = process.env.ERC20_TOKEN_ADDRESS || (() => {
  console.error('❌ Error: ERC20_TOKEN_ADDRESS environment variable is required');
  console.error('Set it with: export ERC20_TOKEN_ADDRESS="0xYourTokenAddress..."');
  process.exit(1);
})();

// Interfaces
interface ContractABI {
  abi: any[];
}

interface ParsedArguments {
  action: string;
  privateKey: string;
  marketId?: string;
  outcomeId?: string;
  value?: string;
  minShares?: string;
  maxShares?: string;
}

interface EthersSetup {
  provider: JsonRpcProvider;
  signer: Wallet;
}

interface UserShares {
  liquidity: bigint;
  shares: bigint[];
}

interface TokenInfo {
  decimals: number;
  symbol: string;
  name: string;
}

// Read ABI from contracts folder
function readABI(): any[] {
  try {
    const abiPath: string = path.join(__dirname, '../contracts/PredictionMarketV3_4.json');
    const abiFile: ContractABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    return abiFile.abi;
  } catch (error: any) {
    console.error('Error reading ABI file:', error.message);
    process.exit(1);
  }
}

// Read ERC20 ABI from contracts folder
function readERC20ABI(): any[] {
  try {
    const abiPath: string = path.join(__dirname, '../contracts/ERC20.json');
    const abiFile: ContractABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    return abiFile.abi;
  } catch (error: any) {
    console.error('Error reading ERC20 ABI file:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArguments(): ParsedArguments {
  const args: string[] = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: yarn dev <action> <privateKey>

Required Environment Variables:
  RPC_URL              RPC endpoint (e.g. https://polygon-rpc.com)
  CONTRACT_ADDRESS     Smart contract address
  ERC20_TOKEN_ADDRESS  ERC20 token address (for payments)

Actions:
  buy <marketId> <outcomeId> <value> [minShares]
  sell <marketId> <outcomeId> <value> [maxShares]
  claimWinnings <marketId>

Examples:
  yarn dev buy 0x1234... 1 0 1000000000000000000
  yarn dev sell 0x1234... 1 0 500000000000000000
  yarn dev claimWinnings 0x1234... 1
    `);
    process.exit(1);
  }

  const action: string = args[0];
  const privateKey: string = args[1];

  // Parse remaining arguments based on action
  const parsedArgs: ParsedArguments = { action, privateKey };

  switch (action) {
    case 'buy':
      if (args.length < 5) {
        console.error('Buy action requires: marketId, outcomeId, value, and optionally minShares');
        process.exit(1);
      }
      parsedArgs.marketId = args[2];
      parsedArgs.outcomeId = args[3];
      parsedArgs.value = args[4];
      parsedArgs.minShares = args[5] || '0'; // Default to 0 if not provided
      break;

    case 'sell':
      if (args.length < 5) {
        console.error('Sell action requires: marketId, outcomeId, value, and optionally maxShares');
        process.exit(1);
      }
      parsedArgs.marketId = args[2];
      parsedArgs.outcomeId = args[3];
      parsedArgs.value = args[4];
      parsedArgs.maxShares = args[5] || ethers.MaxUint256.toString(); // Default to max if not provided
      break;

    case 'claimWinnings':
      if (args.length < 3) {
        console.error('ClaimWinnings action requires: marketId');
        process.exit(1);
      }
      parsedArgs.marketId = args[2];
      break;

    default:
      console.error(`Unknown action: ${action}`);
      console.error('Valid actions: buy, sell, claimWinnings');
      process.exit(1);
  }

  return parsedArgs;
}

// Setup ethers provider and signer
async function setupEthers(privateKey: string, rpcUrl: string): Promise<EthersSetup> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    console.log(`Connected to: ${rpcUrl}`);
    console.log(`Wallet address: ${signer.address}`);

    // Check balance
    const balance: bigint = await provider.getBalance(signer.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH\n`);

    return { provider, signer };
  } catch (error: any) {
    console.error('Error setting up ethers:', error.message);
    process.exit(1);
  }
}

// Create contract instance
function createContract(contractAddress: string, abi: any[], signer: Wallet): Contract {
  try {
    return new ethers.Contract(contractAddress, abi, signer);
  } catch (error: any) {
    console.error('Error creating contract instance:', error.message);
    process.exit(1);
  }
}

// Get token information (decimals, symbol, name)
async function getTokenInfo(tokenContract: Contract): Promise<TokenInfo> {
  try {
    const [decimals, symbol, name] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name()
    ]);

    return {
      decimals: Number(decimals),
      symbol: symbol,
      name: name
    };
  } catch (error: any) {
    console.error('Error getting token info:', error.message);
    throw error;
  }
}

// Format token amount using token decimals
function formatTokenAmount(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

// Parse token amount using token decimals
function parseTokenAmount(amount: string, decimals: number): bigint {
  return ethers.parseUnits(amount, decimals);
}

// Check allowance and approve if needed
async function checkAndApprove(tokenContract: Contract, spenderAddress: string, amount: bigint, userAddress: string, tokenInfo: TokenInfo): Promise<void> {
  try {
    console.log(`Checking ${tokenInfo.symbol} allowance...`);

    const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
    console.log(`Current allowance: ${formatTokenAmount(currentAllowance, tokenInfo.decimals)} ${tokenInfo.symbol}`);
    console.log(`Required amount: ${formatTokenAmount(amount, tokenInfo.decimals)} ${tokenInfo.symbol}`);

    if (currentAllowance < amount) {
      console.log(`\nInsufficient allowance. Approving ${formatTokenAmount(amount, tokenInfo.decimals)} ${tokenInfo.symbol}...`);

      // Estimate gas for approval
      const gasEstimate = await tokenContract.approve.estimateGas(spenderAddress, amount);
      const provider = tokenContract.runner?.provider as JsonRpcProvider;
      const gasPrice = await provider.getFeeData();

      console.log(`Approval gas estimate: ${gasEstimate.toString()}`);
      console.log(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);

      const approveTx = await tokenContract.approve(spenderAddress, amount, {
        gasLimit: gasEstimate * BigInt(120) / BigInt(100),
        gasPrice: gasPrice.gasPrice
      });

      console.log(`Approval transaction sent: ${approveTx.hash}`);
      const approveReceipt = await approveTx.wait();
      console.log(`Approval confirmed in block: ${approveReceipt.blockNumber}`);
      console.log(`✅ Approval successful!\n`);
    } else {
      console.log(`✅ Sufficient allowance already exists.\n`);
    }
  } catch (error: any) {
    console.error('Error checking/approving allowance:', error.message);
    throw error;
  }
}

// Execute buy action
async function executeBuy(
  contract: Contract,
  tokenContract: Contract,
  tokenInfo: TokenInfo,
  marketId: string,
  outcomeId: string,
  value: string,
  minShares: string,
  userAddress: string
): Promise<ContractTransactionReceipt> {
    try {
    console.log(`Executing buy:`);
    console.log(`  Market ID: ${marketId}`);
    console.log(`  Outcome ID: ${outcomeId}`);
    console.log(`  Value: ${formatTokenAmount(BigInt(value), tokenInfo.decimals)} ${tokenInfo.symbol}`);
    console.log(`  Min Shares: ${minShares}\n`);

    // Check token balance
    const balance = await tokenContract.balanceOf(userAddress);
    console.log(`${tokenInfo.symbol} balance: ${formatTokenAmount(balance, tokenInfo.decimals)} ${tokenInfo.symbol}`);

    if (balance < BigInt(value)) {
      throw new Error(`Insufficient ${tokenInfo.symbol} balance. Required: ${formatTokenAmount(BigInt(value), tokenInfo.decimals)}, Available: ${formatTokenAmount(balance, tokenInfo.decimals)}`);
    }

    // Check and approve if needed
    await checkAndApprove(tokenContract, CONTRACT_ADDRESS, BigInt(value), userAddress, tokenInfo);

    // Estimate gas and get current gas price
    const gasEstimate = await contract.buy.estimateGas(marketId, outcomeId, minShares, value);
    const provider = contract.runner?.provider as JsonRpcProvider;
    const gasPrice = await provider.getFeeData();

    console.log(`Estimated gas: ${gasEstimate.toString()}`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);

    const tx = await contract.buy(marketId, outcomeId, minShares, value, {
      gasLimit: gasEstimate * BigInt(120) / BigInt(100), // Add 20% buffer
      gasPrice: gasPrice.gasPrice
    });
    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    return receipt;
  } catch (error: any) {
    console.error('Error executing buy:', error.message);
    throw error;
  }
}

// Execute sell action
async function executeSell(
  contract: Contract,
  tokenInfo: TokenInfo,
  marketId: string,
  outcomeId: string,
  value: string,
  maxShares: string
): Promise<ContractTransactionReceipt> {
  try {
    console.log(`Executing sell:`);
    console.log(`  Market ID: ${marketId}`);
    console.log(`  Outcome ID: ${outcomeId}`);
    console.log(`  Value: ${formatTokenAmount(BigInt(value), tokenInfo.decimals)} ${tokenInfo.symbol}`);
    console.log(`  Max Shares: ${maxShares}\n`);

    // Estimate gas and get current gas price
    const gasEstimate = await contract.sell.estimateGas(marketId, outcomeId, value, maxShares);
    const provider = contract.runner?.provider as JsonRpcProvider;
    const gasPrice = await provider.getFeeData();

    console.log(`Estimated gas: ${gasEstimate.toString()}`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);

    const tx = await contract.sell(marketId, outcomeId, value, maxShares, {
      gasLimit: gasEstimate * BigInt(120) / BigInt(100), // Add 20% buffer
      gasPrice: gasPrice.gasPrice
    });
    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    return receipt;
  } catch (error: any) {
    console.error('Error executing sell:', error.message);
    throw error;
  }
}

// Execute claimWinnings action
async function executeClaimWinnings(contract: Contract, marketId: string): Promise<ContractTransactionReceipt> {
  try {
    console.log(`Executing claimWinnings:`);
    console.log(`  Market ID: ${marketId}\n`);

    // Estimate gas and get current gas price
    const gasEstimate = await contract.claimWinnings.estimateGas(marketId);
    const provider = contract.runner?.provider as JsonRpcProvider;
    const gasPrice = await provider.getFeeData();

    console.log(`Estimated gas: ${gasEstimate.toString()}`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);

    const tx = await contract.claimWinnings(marketId, {
      gasLimit: gasEstimate * BigInt(120) / BigInt(100), // Add 20% buffer
      gasPrice: gasPrice.gasPrice
    });
    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    return receipt;
  } catch (error: any) {
    console.error('Error executing claimWinnings:', error.message);
    throw error;
  }
}

// Get user market shares (helper function)
async function getUserShares(contract: Contract, tokenInfo: TokenInfo, marketId: string, userAddress: string): Promise<UserShares | null> {
  try {
    const [liquidity, shares] = await contract.getUserMarketShares(marketId, userAddress);
    console.log(`User shares for market ${marketId}:`);
    console.log(`  Liquidity: ${formatTokenAmount(liquidity, tokenInfo.decimals)} ${tokenInfo.symbol}`);
    console.log(`  Outcome shares: ${shares.map((s: bigint) => formatTokenAmount(s, tokenInfo.decimals)).join(', ')}`);
    return { liquidity, shares };
  } catch (error: any) {
    console.error('Error getting user shares:', error.message);
    return null;
  }
}

// Main function
async function main(): Promise<void> {
  try {
    const args: ParsedArguments = parseArguments();
    const abi: any[] = readABI();
    const erc20Abi: any[] = readERC20ABI();

    // Setup ethers
    const { provider, signer }: EthersSetup = await setupEthers(args.privateKey, RPC_URL);

    // Create contract instances
    const contract: Contract = createContract(CONTRACT_ADDRESS, abi, signer);
    const tokenContract: Contract = createContract(ERC20_TOKEN_ADDRESS, erc20Abi, signer);

    console.log(`Contract address: ${CONTRACT_ADDRESS}`);
    console.log(`Token address: ${ERC20_TOKEN_ADDRESS}\n`);

    // Get token information
    const tokenInfo: TokenInfo = await getTokenInfo(tokenContract);
    console.log(`Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
    console.log(`Decimals: ${tokenInfo.decimals}\n`);

    // Get user shares before action (for reference)
    if (args.marketId) {
      await getUserShares(contract, tokenInfo, args.marketId, signer.address);
      console.log('---\n');
    }

    // Execute the requested action
    let receipt: ContractTransactionReceipt;
    switch (args.action) {
      case 'buy':
        receipt = await executeBuy(contract, tokenContract, tokenInfo, args.marketId!, args.outcomeId!, args.value!, args.minShares!, signer.address);
        break;

      case 'sell':
        receipt = await executeSell(contract, tokenInfo, args.marketId!, args.outcomeId!, args.value!, args.maxShares!);
        break;

      case 'claimWinnings':
        receipt = await executeClaimWinnings(contract, args.marketId!);
        break;

      default:
        throw new Error(`Unknown action: ${args.action}`);
    }

    console.log('\n---\n');

    // Get user shares after action
    if (args.marketId) {
      await getUserShares(contract, tokenInfo, args.marketId, signer.address);
    }

    console.log('\nAction completed successfully! ✅');

  } catch (error: any) {
    console.error('\nAction failed! ❌');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
