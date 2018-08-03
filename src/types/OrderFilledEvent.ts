import BigNumber from 'bignumber.js';

export interface OrderFilledEvent {
  maker: string | BigNumber;
  taker: string | BigNumber;
  feeRecipient: string | BigNumber;
  filledQty: number | BigNumber;
  paidMakerFee: number | BigNumber;
  paidTakerFee: number | BigNumber;
  price: number | BigNumber;
  orderHash: string;
  txHash: string;
  blockNumber: number | null;
}
