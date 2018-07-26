import BigNumber from 'bignumber.js';

export interface CollateralEvent {
  type: string;
  from: string | null;
  to: string | null;
  amount: BigNumber;
  blockNumber: number | null;
  txHash: string;
}
