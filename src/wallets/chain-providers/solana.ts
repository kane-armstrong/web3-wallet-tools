import { ChainProvider, Wallet, TransactionResult } from '../index.js';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  ConfirmOptions,
  Commitment,
} from '@solana/web3.js';
import { logger } from '../../utils/index.js';

export interface SolanaChainProviderOptions {
  endpoint: string;
  estimatedMinimumFee: number;
  funderKey: string;
}

export class SolanaChainProvider implements ChainProvider {
  private readonly funder: Wallet;
  private readonly estimatedMinimumFee: number;
  private readonly connection: Connection;

  constructor(options: SolanaChainProviderOptions) {
    logger.debug(`Initializing Solana provider with endpoint: ${options.endpoint}`, 'solana');
    this.connection = new Connection(options.endpoint);
    this.estimatedMinimumFee = options.estimatedMinimumFee;

    try {
      const secretKey = Uint8Array.from(JSON.parse(options.funderKey));
      const funder = Keypair.fromSecretKey(secretKey);
      this.funder = {
        privateKey: options.funderKey,
        publicKey: funder.publicKey.toBase58(),
        alias: 'solana-funder',
      };
      logger.debug(
        `Solana funder wallet initialized with address: ${this.funder.publicKey}`,
        'solana'
      );
    } catch (error) {
      logger.error(
        `Failed to initialize Solana funder wallet: ${error instanceof Error ? error.message : String(error)}`,
        'solana',
        error
      );
      throw error;
    }
  }

  createWallet(alias: string): Wallet {
    logger.debug(`Creating new Solana wallet with alias: ${alias}`, 'solana');
    try {
      const keypair = Keypair.generate();
      const result = {
        privateKey: `[${Array.from(keypair.secretKey)}]`,
        publicKey: keypair.publicKey.toBase58(),
        alias: alias,
      };
      logger.debug(`Created Solana wallet: ${result.publicKey}`, 'solana');
      return result;
    } catch (error) {
      logger.error(
        `Failed to create Solana wallet: ${error instanceof Error ? error.message : String(error)}`,
        'solana',
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
    logger.debug(`Funding Solana wallet ${recipientAddress} with ${amount} SOL`, 'solana');
    try {
      const connection = this.connection;

      logger.debug(`Preparing funder wallet from private key`, 'solana');
      const funderWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(funder.privateKey)));

      const lamports = amount * LAMPORTS_PER_SOL;
      logger.debug(
        `Creating transfer transaction of ${lamports} lamports from ${funderWallet.publicKey} to ${recipientAddress}`,
        'solana'
      );

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: funderWallet.publicKey,
          toPubkey: new PublicKey(recipientAddress),
          lamports: lamports,
        })
      );

      const signers = [funderWallet];
      const options = {
        skipPreflight: false,
        commitment: 'confirmed' as Commitment,
      };

      logger.debug(`Sending and confirming Solana transaction`, 'solana');
      const signature = await sendAndConfirmTransaction(connection, tx, signers, options);

      logger.info(
        `Successfully funded Solana wallet ${recipientAddress} with ${amount} SOL (tx: ${signature})`,
        'solana'
      );
      return {
        hash: signature,
        successful: true,
      };
    } catch (error) {
      logger.error(
        `Error funding Solana wallet ${recipientAddress}: ${error instanceof Error ? error.message : String(error)}`,
        'solana',
        error
      );
      throw error;
    }
  }

  async drainWallet(recipientAddress: string, wallet: Wallet): Promise<TransactionResult> {
    logger.debug(`Draining Solana wallet ${wallet.publicKey} to ${recipientAddress}`, 'solana');
    try {
      const connection = this.connection;

      logger.debug(`Preparing sender wallet from private key`, 'solana');
      const senderWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(wallet.privateKey)));

      logger.debug(`Checking balance of wallet ${senderWallet.publicKey.toBase58()}`, 'solana');
      const balance = await connection.getBalance(senderWallet.publicKey);
      logger.debug(
        `Wallet ${senderWallet.publicKey.toBase58()} has balance: ${balance} lamports`,
        'solana'
      );

      if (balance <= 0) {
        logger.debug(
          `Wallet ${senderWallet.publicKey.toBase58()} has zero balance, skipping drain`,
          'solana'
        );
        return {
          successful: false,
          reason: 'wallet balance is 0',
        };
      }

      const minimumFee = this.estimatedMinimumFee;
      logger.debug(`Estimated minimum fee: ${minimumFee} lamports`, 'solana');

      if (balance <= minimumFee) {
        logger.debug(
          `Wallet ${senderWallet.publicKey.toBase58()} has insufficient balance (${balance}) to cover fee (${minimumFee})`,
          'solana'
        );
        return {
          successful: false,
          reason: 'wallet has insufficient balance to cover the transfer fee',
        };
      }

      const amountToSend = balance - minimumFee;
      logger.debug(
        `Sending ${amountToSend} lamports from ${senderWallet.publicKey.toBase58()} to ${recipientAddress}`,
        'solana'
      );

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderWallet.publicKey,
          toPubkey: new PublicKey(recipientAddress),
          lamports: amountToSend,
        })
      );

      const signers = [senderWallet];
      const options: ConfirmOptions = {
        skipPreflight: false,
        commitment: 'confirmed' as Commitment,
      };

      logger.debug(`Sending and confirming Solana transaction`, 'solana');
      const signature = await sendAndConfirmTransaction(connection, tx, signers, options);

      const successful = !!signature;
      if (successful) {
        logger.info(
          `Successfully drained ${amountToSend} lamports from wallet ${senderWallet.publicKey.toBase58()} to ${recipientAddress} (tx: ${signature})`,
          'solana'
        );
      } else {
        logger.error(
          `Failed to drain wallet ${senderWallet.publicKey.toBase58()}, transaction failed`,
          'solana'
        );
      }

      return {
        hash: signature,
        successful: successful,
      };
    } catch (error) {
      logger.error(
        `Error draining Solana wallet ${wallet.publicKey}: ${error instanceof Error ? error.message : String(error)}`,
        'solana',
        error
      );
      throw error;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      logger.debug(`Getting balance for Solana address: ${address}`, 'solana');
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      logger.debug(`Balance for ${address}: ${balance} lamports`, 'solana');
      return BigInt(balance);
    } catch (error) {
      logger.error(
        `Error getting balance for Solana address ${address}: ${error instanceof Error ? error.message : String(error)}`,
        'solana',
        error
      );
      throw error;
    }
  }

  getFunderWallet(): Wallet {
    logger.debug(`Retrieving Solana funder wallet: ${this.funder.publicKey}`, 'solana');
    return this.funder;
  }
}
