import { ChainProviderFactory, WalletStore } from '../models.js';
import { logger } from '../../utils/index.js';

export interface GetBalancesRequest {
  chain: string;
}

export class GetBalancesHandler {
  constructor(
    private readonly chainProviderFactory: ChainProviderFactory,
    private readonly walletStore: WalletStore
  ) {}

  async handle(request: GetBalancesRequest): Promise<void> {
    logger.debug(`Initializing provider for chain: ${request.chain}`, 'balances');
    const provider = await this.chainProviderFactory.forChain(request.chain);

    logger.debug(`Fetching wallets for chain: ${request.chain}`, 'balances');
    const wallets = await this.walletStore.getWallets(request.chain);
    logger.info(`Found ${wallets.length} wallets for chain: ${request.chain}`, 'balances');

    let totalBalance = BigInt(0);
    let zeroBalanceCount = 0;

    logger.debug(`Starting balance check for ${wallets.length} wallets`, 'balances');
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      logger.debug(`Checking balance of wallet: ${wallet.publicKey}`, 'balances');

      try {
        const balance = await provider.getBalance(wallet.publicKey);
        totalBalance += balance;

        if (balance === BigInt(0)) {
          zeroBalanceCount++;
        }

        // Format balance for readability
        const formattedBalance = this.formatBalance(balance, request.chain);
        logger.info(
          `Balance of wallet ${wallet.publicKey} on chain ${request.chain} is: ${formattedBalance}`,
          'balances'
        );
      } catch (error) {
        logger.error(
          `Error checking balance for wallet ${wallet.publicKey}: ${error instanceof Error ? error.message : String(error)}`,
          'balances',
          error
        );
      }
    }

    const formattedTotal = this.formatBalance(totalBalance, request.chain);
    logger.info(
      `Total balance across all ${wallets.length} wallets: ${formattedTotal}`,
      'balances'
    );
    logger.info(`Wallets with zero balance: ${zeroBalanceCount}`, 'balances');
  }

  private formatBalance(balance: bigint, chain: string): string {
    if (chain.toLowerCase().includes('solana')) {
      return `${(Number(balance) / 1e9).toFixed(6)} SOL`;
    }

    return `${(Number(balance) / 1e18).toFixed(6)} ETH`;
  }
}
