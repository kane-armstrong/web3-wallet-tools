export interface NetworkConfig {
  name: string;
  rpc: string;
  explorer: string;
  estimatedTransferFee: number;
  type: NetworkType;
}

export const NetworkTypes = {
  EVM: 'evm',
  SOLANA: 'solana',
} as const;

export type NetworkType = (typeof NetworkTypes)[keyof typeof NetworkTypes];

export class ChainInfoNotFoundError extends Error {
  constructor(chainName: string) {
    super(`no entry found in config for chain: ${chainName}`);
    this.name = 'ChainInfoNotFoundError';
  }
}
