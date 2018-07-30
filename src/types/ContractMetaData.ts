import BigNumber from 'bignumber.js';

export interface ContractMetaData {
  contractName: string;
  contractAddress: string;
  creator: string;
  collateralPoolAddress: string;
  collateralTokenAddress: string;
  collateralPoolBalance: BigNumber;
  contractCreator: string;
  expirationTimeStamp: BigNumber;
  isSettled: boolean;
  settlementPrice: BigNumber;
  lastPrice: BigNumber;
  priceCap: BigNumber;
  priceFloor: BigNumber;
  priceDecimalPlaces: BigNumber;
  qtyMultiplier: BigNumber;
}

export interface OraclizeContractMetaData extends ContractMetaData {
  lastPriceQueryResult: string;
  oracleDataSource: string;
  oracleQuery: string;
}
