import fs from 'fs/promises';
import path from 'path';
import { Wallet, WalletStore } from '../models';
import { logger } from '../../utils/index.js';

interface WalletsData {
  [chain: string]: Wallet[];
}

export interface JsonStoreOptions {
  dataDir: string;
}

export class JsonStore implements WalletStore {
  private dataFile: string;
  private initialized = false;

  constructor(private options: JsonStoreOptions) {
    this.options = options || {};
    this.dataFile = this.options.dataDir?.endsWith('wallets.json')
      ? this.options.dataDir
      : path.join(this.options.dataDir || '.', 'wallets.json');

    logger.debug(`JsonStore initialized with data file: ${this.dataFile}`, 'store');
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const dataDir = path.dirname(this.dataFile);
    logger.debug(`Ensuring data directory exists: ${dataDir}`, 'store');
    await fs.mkdir(dataDir, { recursive: true });

    try {
      await fs.access(this.dataFile);
      logger.debug(`Data file already exists: ${this.dataFile}`, 'store');
    } catch (error) {
      logger.info(`Creating new data file: ${this.dataFile}`, 'store');
      await fs.writeFile(this.dataFile, JSON.stringify({} as WalletsData));
    }

    this.initialized = true;
  }

  private async readData(): Promise<WalletsData> {
    await this.initialize();

    try {
      logger.debug(`Reading wallet data from: ${this.dataFile}`, 'store');
      const data = await fs.readFile(this.dataFile, 'utf-8');
      const parsedData = JSON.parse(data) as WalletsData;
      return parsedData || {};
    } catch (error) {
      if (error instanceof SyntaxError) {
        // JSON parsing error - file is corrupt
        logger.error(
          `Error parsing wallet data file: ${this.dataFile}, resetting to empty data`,
          'store',
          error
        );
        // Reset the file with empty data
        await fs.writeFile(this.dataFile, JSON.stringify({} as WalletsData));
        return {};
      }

      logger.error(`Error reading wallet data file: ${this.dataFile}`, 'store', error);
      throw error;
    }
  }

  private async writeData(data: WalletsData): Promise<void> {
    await this.initialize();

    const safeData = data || {};
    try {
      logger.debug(`Writing wallet data to: ${this.dataFile}`, 'store');
      await fs.writeFile(this.dataFile, JSON.stringify(safeData, null, 2));
    } catch (error) {
      logger.error(`Error writing wallet data to: ${this.dataFile}`, 'store', error);
      throw error;
    }
  }

  async getWallets(chain: string): Promise<Wallet[]> {
    if (!chain) {
      logger.warn('getWallets called without chain specified', 'store');
      return [];
    }

    logger.debug(`Fetching wallets for chain: ${chain}`, 'store');
    const data = await this.readData();
    const wallets = Array.isArray(data[chain]) ? data[chain] : [];
    logger.debug(`Found ${wallets.length} wallets for chain: ${chain}`, 'store');
    return wallets;
  }

  async add(chain: string, walletInput: Wallet | Wallet[]): Promise<void> {
    if (!chain) {
      logger.warn('Cannot add wallet: chain not specified', 'store');
      return;
    }
    if (!walletInput) {
      logger.warn('Cannot add wallet: wallet not provided', 'store');
      return;
    }

    const data = await this.readData();

    if (!data[chain]) {
      logger.debug(`Initializing empty wallet array for chain: ${chain}`, 'store');
      data[chain] = [];
    }

    const wallets = Array.isArray(walletInput) ? walletInput : [walletInput];
    logger.info(`Adding ${wallets.length} wallets to chain: ${chain}`, 'store');

    let updatedCount = 0;
    let newCount = 0;
    let skippedCount = 0;

    for (const wallet of wallets) {
      const publicKey = wallet.publicKey;
      if (!publicKey) {
        logger.error('Cannot add wallet without a public key', 'store');
        skippedCount++;
        continue;
      }

      const existingIndex = data[chain].findIndex((w) => w && w.publicKey === publicKey);
      if (existingIndex >= 0) {
        logger.debug(`Updating existing wallet with address: ${publicKey}`, 'store');
        data[chain][existingIndex] = wallet;
        updatedCount++;
      } else {
        logger.debug(`Adding new wallet with address: ${publicKey}`, 'store');
        data[chain].push(wallet);
        newCount++;
      }
    }

    logger.info(
      `Wallet update summary - Added: ${newCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
      'store'
    );
    await this.writeData(data);
  }

  async count(chain: string): Promise<number> {
    if (!chain) {
      logger.warn('count called without chain specified', 'store');
      return 0;
    }

    logger.debug(`Counting wallets for chain: ${chain}`, 'store');
    const wallets = await this.getWallets(chain);
    return wallets.length;
  }
}
