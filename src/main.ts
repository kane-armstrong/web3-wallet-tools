import path from 'path';
import os from 'os';
import { Config } from './config/index.js';
import {
  CreateWalletsHandler,
  DrainWalletsHandler,
  FundWalletsHandler,
  GetBalancesHandler,
  JsonStore,
  Factory,
} from './wallets/index.js';
import { logger } from './utils/index.js';

type CommandHandler = (args: string[]) => Promise<void>;

// Common data paths
const DATA_DIR = path.join(os.homedir(), '.data/web3/wallets');
const CONFIG_PATH = 'config';

// Helper to create providers and stores consistently
function createProviderAndStore() {
  logger.debug('Initializing config, provider factory, and store', 'setup');
  const config = new Config(CONFIG_PATH);
  const providerFactory = new Factory(config);
  const store = new JsonStore({ dataDir: DATA_DIR });

  return { config, providerFactory, store };
}

const commands: Record<string, CommandHandler> = {
  create: async (args) => {
    if (args.length != 2) {
      logger.error('Expected exactly two args: <chain> <count>', 'cli');
      process.exit(1);
    }
    const chain = args[0];

    const count = parseInt(args[1], 10);
    if (isNaN(count) || count <= 0) {
      logger.error('Please provide a valid positive number of wallets', 'cli');
      logger.info('Usage: npm run create <chain> <number_of_wallets>', 'cli');
      process.exit(1);
    }

    logger.info(`Creating ${count} wallets for chain: ${chain}`, 'create');
    const { providerFactory, store } = createProviderAndStore();
    const handler = new CreateWalletsHandler(providerFactory, store);

    await handler.handle({
      chain: chain,
      count: count,
    });
    logger.info(`Successfully created ${count} wallets for chain: ${chain}`, 'create');
  },

  fund: async (args) => {
    if (args.length != 2) {
      logger.error('Expected exactly two args: <chain> <amount per wallet>', 'cli');
      process.exit(1);
    }

    const chain = args[0];
    const amount = parseFloat(args[1]);
    if (amount <= 0) {
      logger.error('Please provide a valid funding amount', 'cli');
      logger.info('Usage: npm run fund <chain> <amount per wallet>', 'cli');
      process.exit(1);
    }

    logger.info(`Funding wallets for chain: ${chain} with amount: ${amount}`, 'fund');
    const { providerFactory, store } = createProviderAndStore();
    const handler = new FundWalletsHandler(providerFactory, store);

    await handler.handle({
      chain: chain,
      amount: amount,
      minBalance: amount,
    });
    logger.info(`Completed funding operation for chain: ${chain}`, 'fund');
  },

  balances: async (args) => {
    if (args.length != 1) {
      logger.error('Expected exactly one arg: <chain>', 'cli');
      process.exit(1);
    }

    const chain = args[0];
    logger.info(`Checking balances for chain: ${chain}`, 'balances');
    const { providerFactory, store } = createProviderAndStore();
    const handler = new GetBalancesHandler(providerFactory, store);

    await handler.handle({
      chain: chain,
    });
    logger.debug(`Completed balance check for chain: ${chain}`, 'balances');
  },

  drain: async (args) => {
    if (args.length != 1) {
      logger.error('Expected exactly one arg: <chain>', 'cli');
      process.exit(1);
    }

    const chain = args[0];
    logger.info(`Draining wallets for chain: ${chain}`, 'drain');
    const { providerFactory, store } = createProviderAndStore();
    const handler = new DrainWalletsHandler(providerFactory, store);

    await handler.handle({
      chain: chain,
    });
    logger.info(`Completed drain operation for chain: ${chain}`, 'drain');
  },
};

// Main CLI entry point
async function main() {
  try {
    const [command, ...args] = process.argv.slice(2);

    if (!command || !commands[command]) {
      logger.error('Please provide a valid command', 'cli');
      logger.info('Available commands: create, fund, drain, balances', 'cli');
      process.exit(1);
    }

    logger.info(`Executing command: ${command}`, 'cli');
    await commands[command](args);
  } catch (error) {
    logger.error(
      `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
      'cli',
      error
    );
    process.exit(1);
  }
}

main();
