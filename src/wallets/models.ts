export interface Wallet {
  privateKey: string;
  publicKey: string;
  alias: string;
}

export interface TransactionResult {
  hash?: string | undefined;
  successful: boolean;
  reason?: string | undefined;
}

export interface GetBalancesResult {
  balances: {
    [chain: string]: GetBalancesResultEntry[];
  };
}

export interface GetBalancesResultEntry {
  publicKey: string;
  balance: bigint;
}

export interface ChainProvider {
  createWallet(alias: string): Wallet;
  fundWallet(amount: number, funder: Wallet, recipientAddress: string): Promise<TransactionResult>;
  drainWallet(recipientAddress: string, wallet: Wallet): Promise<TransactionResult>;
  getBalance(address: string): Promise<bigint>;
  getFunderWallet(): Wallet;
}

export interface ChainProviderFactory {
  forChain(chain: string): Promise<ChainProvider>;
}

export interface WalletStore {
  getWallets(chain: string): Promise<Wallet[]>;
  add(chain: string, wallet: Wallet | Wallet[]): Promise<void>;
  count(chain: string): Promise<number>;
}
