import { ChainProviderFactory, WalletStore } from '../models.js';
import { logger } from '../../utils/index.js';

export interface CreateWalletsRequest {
  chain: string;
  count: number;
}

export class CreateWalletsHandler {
  constructor(
    private readonly chainProviderFactory: ChainProviderFactory,
    private readonly walletStore: WalletStore
  ) {}

  async handle(request: CreateWalletsRequest): Promise<void> {
    logger.debug(`Fetching current wallet count for chain: ${request.chain}`, 'create');
    const walletCount = await this.walletStore.count(request.chain);

    logger.debug(`Initializing provider for chain: ${request.chain}`, 'create');
    const provider = await this.chainProviderFactory.forChain(request.chain);
    const wallets = [];

    logger.info(`Creating ${request.count} new wallets for chain: ${request.chain}`, 'create');
    for (let i = 0; i < request.count; i++) {
      const walletAlias = `wallet-${walletCount + i}`;
      logger.debug(`Creating wallet with alias: ${walletAlias}`, 'create');

      const wallet = provider.createWallet(walletAlias);
      wallets.push(wallet);
      logger.info(`Created wallet: ${wallet.alias} with address: ${wallet.publicKey}`, 'create');
    }

    // Add all wallets in a single operation
    logger.debug(`Storing ${wallets.length} wallets to chain: ${request.chain}`, 'create');
    await this.walletStore.add(request.chain, wallets);
    logger.info(
      `Successfully stored ${wallets.length} wallets for chain: ${request.chain}`,
      'create'
    );
  }
}
