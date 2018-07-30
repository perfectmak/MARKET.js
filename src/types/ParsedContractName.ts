import BigNumber from 'bignumber.js';

export interface ParsedContractName {
  referenceAsset: string;
  collateralToken: string;
  dataProvider: string;
  expirationTimeStamp: BigNumber;
  userText: string;
}
