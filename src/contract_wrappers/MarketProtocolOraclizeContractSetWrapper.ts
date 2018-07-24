/**
 * Wrapper for all contracts that make up a given set of Market Protocol smart contracts
 */
import {
  ERC20,
  MarketCollateralPool,
  MarketContract,
  MarketContractOraclize
} from '@marketprotocol/types';
import { MarketProtocolContractSetWrapper } from './MarketProtocolContractSetWrapper';

export class MarketProtocolOraclizeContractSetWrapper extends MarketProtocolContractSetWrapper {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  public readonly marketContractOraclize: MarketContractOraclize;
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  constructor(
    marketContractOraclize: MarketContractOraclize,
    marketCollateralPool: MarketCollateralPool,
    erc20: ERC20
  ) {
    super(marketContractOraclize, marketCollateralPool, erc20);
    this.marketContractOraclize = marketContractOraclize;
  }
  // endregion//Constructors

  // region Properties
  // *****************************************************************
  // ****                     Properties                          ****
  // *****************************************************************
  // endregion //Properties

  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************
  // endregion //Public Methods

  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************
  // endregion //Private Methods

  // region Event Handlers
  // *****************************************************************
  // ****                     Event Handlers                     ****
  // *****************************************************************
  // endregion //Event Handlers
}
