import { ChainProvider, Wallet, TransactionResult } from '../index.js';
import { Wallet as ethersWallet, JsonRpcProvider } from 'ethers';
import { logger } from '../../utils/index.js';

export interface EVMChainProviderOptions {
  rpc: string;
  estimatedTransferGasLimit: bigint;
  funderKey: string;
}

export class EVMChainProvider implements ChainProvider {
  private readonly funder: Wallet;
  private readonly estimatedTransferGasLimit: bigint;
  private readonly provider: JsonRpcProvider;

  constructor(options: EVMChainProviderOptions) {
    logger.debug(`Initializing EVM provider with RPC: ${options.rpc}`, 'evm');
    this.provider = new JsonRpcProvider(options.rpc);
    this.estimatedTransferGasLimit = options.estimatedTransferGasLimit;

    try {
      const funder = new ethersWallet(options.funderKey, this.provider);
      this.funder = {
        privateKey: funder.privateKey,
        publicKey: funder.address,
        alias: 'evm-funder',
      };
      logger.debug(`EVM funder wallet initialized with address: ${this.funder.publicKey}`, 'evm');
    } catch (error) {
      logger.error(
        `Failed to initialize EVM funder wallet: ${error instanceof Error ? error.message : String(error)}`,
        'evm',
        error
      );
      throw error;
    }
  }

  createWallet(alias: string): Wallet {
    logger.debug(`Creating new EVM wallet with alias: ${alias}`, 'evm');
    try {
      const wallet = ethersWallet.createRandom();
      const result = {
        privateKey: wallet.privateKey,
        publicKey: wallet.address,
        alias: alias,
      };
      logger.debug(`Created EVM wallet: ${result.publicKey}`, 'evm');
      return result;
    } catch (error) {
      logger.error(
        `Failed to create EVM wallet: ${error instanceof Error ? error.message : String(error)}`,
        'evm',
        error
      );
      throw error;
    }
  }

  async fundWallet(
    amount: number,
    funder: Wallet,
    recipientAddress: string
  ): Promise<TransactionResult> {
    logger.debug(`Funding EVM wallet ${recipientAddress} with ${amount} ETH`, 'evm');
    try {
      const fundFrom = new ethersWallet(funder.privateKey, this.provider);
      const weiAmount = BigInt(Math.floor(amount * 1e18)); // Convert to wei (10^18)

      logger.debug(
        `Sending ${weiAmount} wei from ${fundFrom.address} to ${recipientAddress}`,
        'evm'
      );
      const tx = await fundFrom.sendTransaction({
        to: recipientAddress,
        value: weiAmount,
      });

      logger.debug(`Transaction sent, hash: ${tx.hash}, waiting for confirmation`, 'evm');
      const receipt = await tx.wait();

      const successful = receipt?.status === 1;
      if (successful) {
        logger.info(
          `Successfully funded EVM wallet ${recipientAddress} with ${amount} ETH (tx: ${tx.hash})`,
          'evm'
        );
      } else {
        logger.error(`Failed to fund EVM wallet ${recipientAddress}, transaction failed`, 'evm');
      }

      return {
        hash: tx.hash,
        successful: successful,
      };
    } catch (error) {
      logger.error(
        `Error funding EVM wallet ${recipientAddress}: ${error instanceof Error ? error.message : String(error)}`,
        'evm',
        error
      );
      throw error;
    }
  }

  async drainWallet(recipientAddress: string, wallet: Wallet): Promise<TransactionResult> {
    logger.debug(`Draining EVM wallet ${wallet.publicKey} to ${recipientAddress}`, 'evm');
    try {
      const provider = this.provider;
      const senderWallet = new ethersWallet(wallet.privateKey, provider);

      logger.debug(`Checking balance of wallet ${senderWallet.address}`, 'evm');
      const balance = await provider.getBalance(senderWallet.address);
      logger.debug(`Wallet ${senderWallet.address} has balance: ${balance} wei`, 'evm');

      if (balance <= BigInt(0)) {
        logger.debug(`Wallet ${senderWallet.address} has zero balance, skipping drain`, 'evm');
        return {
          successful: false,
          reason: 'wallet balance is 0',
        };
      }

      logger.debug(`Getting fee data for transaction`, 'evm');
      const gasPrice = await provider.getFeeData();
      const gasLimit = this.estimatedTransferGasLimit;

      const maxFeePerGas = gasPrice.maxFeePerGas || gasPrice.gasPrice;
      const maxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas || BigInt(0);

      if (!maxFeePerGas) {
        const error = 'Could not determine gas price';
        logger.error(error, 'evm');
        throw new Error(error);
      }

      const gasCost = gasLimit * maxFeePerGas;
      logger.debug(`Estimated gas cost: ${gasCost} wei`, 'evm');

      const amountToSend = balance - gasCost;

      if (amountToSend <= BigInt(0)) {
        logger.debug(
          `Wallet ${senderWallet.address} has insufficient balance (${balance}) to cover gas costs (${gasCost})`,
          'evm'
        );
        return {
          successful: false,
          reason: 'wallet has insufficient balance to cover the transfer fee',
        };
      }

      logger.debug(
        `Sending ${amountToSend} wei from ${senderWallet.address} to ${recipientAddress}`,
        'evm'
      );
      const tx = await senderWallet.sendTransaction({
        to: recipientAddress,
        value: amountToSend,
        gasLimit: gasLimit,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
      });

      logger.debug(`Transaction sent, hash: ${tx.hash}, waiting for confirmation`, 'evm');
      const receipt = await tx.wait();

      const successful = receipt?.status === 1;
      if (successful) {
        logger.info(
          `Successfully drained ${amountToSend} wei from wallet ${senderWallet.address} to ${recipientAddress} (tx: ${tx.hash})`,
          'evm'
        );
      } else {
        logger.error(`Failed to drain wallet ${senderWallet.address}, transaction failed`, 'evm');
      }

      return {
        hash: tx.hash,
        successful: successful,
      };
    } catch (error) {
      logger.error(
        `Error draining EVM wallet ${wallet.publicKey}: ${error instanceof Error ? error.message : String(error)}`,
        'evm',
        error
      );
      throw error;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      logger.debug(`Getting balance for EVM address: ${address}`, 'evm');
      const balance = await this.provider.getBalance(address);
      logger.debug(`Balance for ${address}: ${balance} wei`, 'evm');
      return balance;
    } catch (error) {
      logger.error(
        `Error getting balance for EVM address ${address}: ${error instanceof Error ? error.message : String(error)}`,
        'evm',
        error
      );
      throw error;
    }
  }

  getFunderWallet(): Wallet {
    logger.debug(`Retrieving EVM funder wallet: ${this.funder.publicKey}`, 'evm');
    return this.funder;
  }
}
