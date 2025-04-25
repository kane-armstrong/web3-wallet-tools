import { NetworkTypes, Config } from '../../config/index.js';
import { ChainProvider, ChainProviderFactory } from '../models.js';
import { EVMChainProvider } from './evm.js';
import { SolanaChainProvider } from './solana.js';

export class Factory implements ChainProviderFactory {
  constructor(private readonly config: Config) {}

  async forChain(chain: string): Promise<ChainProvider> {
    const config = await this.config.getNetworkConfig(chain);

    switch (config.type) {
      case NetworkTypes.EVM:
        return new EVMChainProvider({
          // typical gas limit for a simple transfer
          estimatedTransferGasLimit: BigInt(21000),
          rpc: config.rpc,
          funderKey: this.config.evmFunderPrivateKey(),
        });
      case NetworkTypes.SOLANA:
        return new SolanaChainProvider({
          // solana has a minimum fee of 5000 lamports
          estimatedMinimumFee: 5000,
          endpoint: config.rpc,
          funderKey: this.config.solanaFunderPrivateKey(),
        });
      default:
        throw new Error(`unsupported chain type '${config.type}' for chain '${chain}'`);
    }
  }
}
