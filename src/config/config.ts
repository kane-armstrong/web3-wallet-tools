import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { NetworkConfig, ChainInfoNotFoundError } from './models.js';

export class Config {
  constructor(private readonly configPath: string) {
    dotenv.config();
  }

  public async getNetworkConfigs(): Promise<NetworkConfig[]> {
    const environment = this.getCurrentEnvironment();
    const filePath = path.join(this.configPath, `${environment}.json`);
    const exists = await this.checkIfFileExists(filePath);

    if (!exists) {
      throw new Error(`configuration file not found: ${filePath}`);
    }

    const fileData = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileData) as NetworkConfig[];
  }

  public async getNetworkConfig(chain: string): Promise<NetworkConfig> {
    const networkConfigs = await this.getNetworkConfigs();
    const res = networkConfigs.find((p) => p.name === chain);
    if (res === undefined) {
      throw new ChainInfoNotFoundError(chain);
    }
    return res;
  }

  public getCurrentEnvironment(): string {
    const environment = process.env.ENVIRONMENT;
    if (!environment) {
      throw new Error('unable to load environment: ENVIRONMENT env var not set');
    }
    return environment;
  }

  public solanaFunderPrivateKey(): string {
    const pk = process.env.SOLANA_FUNDER_PRIVATE_KEY;
    if (!pk) {
      throw new Error('unable to load Solana funder: SOLANA_FUNDER_PRIVATE_KEY env var not set');
    }
    return pk;
  }

  public evmFunderPrivateKey(): string {
    const pk = process.env.EVM_FUNDER_PRIVATE_KEY;
    if (!pk) {
      throw new Error('unable to load EVM funder: EVM_FUNDER_PRIVATE_KEY env var not set');
    }
    return pk;
  }

  private async checkIfFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}
