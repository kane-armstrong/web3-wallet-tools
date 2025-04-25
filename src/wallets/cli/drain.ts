import { ChainProviderFactory, WalletStore } from '../models.js';
import { logger } from '../../utils/index.js';

export interface DrainWalletsRequest {
  chain: string;
}

export class DrainWalletsHandler {
  constructor(
    private readonly chainProviderFactory: ChainProviderFactory,
    private readonly walletStore: WalletStore
  ) {}

  async handle(request: DrainWalletsRequest): Promise<void> {
    logger.debug(`Initializing provider for chain: ${request.chain}`, 'drain');
    const provider = await this.chainProviderFactory.forChain(request.chain);

    logger.debug(`Fetching wallets for chain: ${request.chain}`, 'drain');
    const wallets = await this.walletStore.getWallets(request.chain);
    logger.info(`Found ${wallets.length} wallets for chain: ${request.chain}`, 'drain');

    logger.debug(`Getting funder wallet for chain: ${request.chain}`, 'drain');
    const funder = provider.getFunderWallet();
    logger.info(`Using funder wallet: ${funder.publicKey} as drain destination`, 'drain');

    // Process wallets in batches
    const concurrencyLimit = 20;
    logger.info(
      `Draining ${wallets.length} wallets with a concurrency of ${concurrencyLimit}`,
      'drain'
    );

    // Track success and failure counts
    let successCount = 0;
    let failureCount = 0;
    let zeroBalanceCount = 0;
    let insufficientBalanceCount = 0;

    for (let i = 0; i < wallets.length; i += concurrencyLimit) {
      const batch = wallets.slice(i, i + concurrencyLimit);
      const batchNumber = Math.floor(i / concurrencyLimit) + 1;
      const totalBatches = Math.ceil(wallets.length / concurrencyLimit);

      logger.info(
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} wallets)`,
        'drain'
      );

      const drainPromises = batch.map((wallet) => {
        logger.debug(`Draining wallet ${wallet.publicKey}`, 'drain');
        return provider
          .drainWallet(funder.publicKey, wallet)
          .then((result) => {
            if (result.successful) {
              successCount++;
              logger.info(
                `Successfully drained wallet ${wallet.publicKey}, funds sent to ${funder.publicKey}${result.hash ? ` (tx: ${result.hash})` : ''}`,
                'drain'
              );
            } else {
              failureCount++;

              // Track specific failure reasons
              if (result.reason?.includes('balance is 0')) {
                zeroBalanceCount++;
                logger.debug(`Wallet ${wallet.publicKey} has zero balance, skipping`, 'drain');
              } else if (result.reason?.includes('insufficient balance')) {
                insufficientBalanceCount++;
                logger.debug(
                  `Wallet ${wallet.publicKey} has insufficient balance to cover fees`,
                  'drain'
                );
              } else {
                logger.warn(
                  `Failed to drain wallet ${wallet.publicKey}: ${result.reason || 'unknown error'}`,
                  'drain'
                );
              }
            }
            return result;
          })
          .catch((error) => {
            failureCount++;
            logger.error(
              `Error draining wallet ${wallet.publicKey}: ${error instanceof Error ? error.message : String(error)}`,
              'drain',
              error
            );
            return {
              successful: false,
              reason: error instanceof Error ? error.message : String(error),
            };
          });
      });

      await Promise.all(drainPromises);
      logger.debug(`Completed batch ${batchNumber}/${totalBatches}`, 'drain');
    }

    // Summary
    logger.info(`Drain operation complete for chain: ${request.chain}`, 'drain');
    logger.info(`Results: ${successCount} successful, ${failureCount} failed`, 'drain');

    if (zeroBalanceCount > 0 || insufficientBalanceCount > 0) {
      logger.info(
        `Zero balance wallets: ${zeroBalanceCount}, Insufficient balance for fees: ${insufficientBalanceCount}`,
        'drain'
      );
    }

    if (failureCount > zeroBalanceCount + insufficientBalanceCount) {
      logger.warn(
        `${failureCount - zeroBalanceCount - insufficientBalanceCount} wallets failed to drain due to errors. Check the logs for details.`,
        'drain'
      );
    }
  }
}
