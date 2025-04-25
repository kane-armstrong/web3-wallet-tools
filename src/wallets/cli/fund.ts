import { ChainProviderFactory, Wallet, WalletStore } from '../models.js';
import { logger } from '../../utils/index.js';

export interface FundWalletsRequest {
  chain: string;
  amount: number;
  minBalance: number;
}

export class FundWalletsHandler {
  constructor(
    private readonly chainProviderFactory: ChainProviderFactory,
    private readonly walletStore: WalletStore
  ) {}

  async handle(request: FundWalletsRequest): Promise<void> {
    logger.debug(`Initializing provider for chain: ${request.chain}`, 'fund');
    const provider = await this.chainProviderFactory.forChain(request.chain);

    logger.debug(`Fetching wallets for chain: ${request.chain}`, 'fund');
    const wallets = await this.walletStore.getWallets(request.chain);
    logger.info(`Found ${wallets.length} wallets for chain: ${request.chain}`, 'fund');

    logger.debug(`Getting funder wallet for chain: ${request.chain}`, 'fund');
    const funder = provider.getFunderWallet();
    logger.info(`Using funder wallet: ${funder.publicKey}`, 'fund');

    // Calculate total amount needed
    const total =
      request.chain === 'solana'
        ? BigInt(Math.floor(request.amount * 1e9)) * BigInt(wallets.length) // LAMPORTS_PER_SOL is 10^9
        : BigInt(Math.floor(request.amount * 1e18)) * BigInt(wallets.length); // wei is 10^18

    logger.debug(`Checking funder balance`, 'fund');
    const balance = await provider.getBalance(funder.publicKey);
    logger.info(`Funder balance: ${balance}, required: ${total}`, 'fund');

    if (total > balance) {
      const error = `Funder ${funder.publicKey} balance of ${balance} is less than the required funding amount of ${total}`;
      logger.error(error, 'fund');
      throw new Error(error);
    }

    logger.info(`Funding ${wallets.length} ${request.chain} wallets`, 'fund');

    let fundedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      logger.debug(`Checking balance of wallet: ${wallet.publicKey}`, 'fund');
      const walletBalance = await provider.getBalance(wallet.publicKey);

      // Convert minBalance from float to chain-appropriate format (lamports or wei)
      const minBalanceInChainUnits =
        request.chain === 'solana'
          ? BigInt(Math.floor(request.minBalance * 1e9)) // Convert to lamports
          : BigInt(Math.floor(request.minBalance * 1e18)); // Convert to wei

      if (walletBalance >= minBalanceInChainUnits) {
        logger.info(
          `Skipping wallet ${wallet.publicKey}: balance of ${walletBalance} exceeds minimum requested balance of ${minBalanceInChainUnits}`,
          'fund'
        );
        skippedCount++;
        continue;
      }

      logger.info(`Funding wallet ${wallet.publicKey}`, 'fund');
      try {
        const result = await provider.fundWallet(request.amount, funder, wallets[i].publicKey);
        if (result.successful) {
          logger.info(
            `Successfully funded wallet ${wallet.publicKey}${result.hash ? ` (tx: ${result.hash})` : ''}`,
            'fund'
          );
          fundedCount++;
        } else {
          logger.error(
            `Failed to fund wallet ${wallet.publicKey}: ${result.reason || 'unknown error'}`,
            'fund'
          );
        }
      } catch (error) {
        logger.error(
          `Error funding wallet ${wallet.publicKey}: ${error instanceof Error ? error.message : String(error)}`,
          'fund',
          error
        );
      }
    }

    logger.info(`Funding complete: ${fundedCount} funded, ${skippedCount} skipped`, 'fund');
  }
}
