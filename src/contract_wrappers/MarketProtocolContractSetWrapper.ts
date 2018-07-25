import { ERC20, MarketCollateralPool, MarketContract } from '@marketprotocol/types';

/**
 * Wrapper for all contracts that make up a given set of Market Protocol smart contracts
 */
export class MarketProtocolContractSetWrapper {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  public readonly marketContract: MarketContract;
  public readonly marketCollateralPool: MarketCollateralPool;
  public readonly collateralToken: ERC20;
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  constructor(
    marketContract: MarketContract,
    marketCollateralPool: MarketCollateralPool,
    erc20: ERC20
  ) {
    this.marketContract = marketContract;
    this.marketCollateralPool = marketCollateralPool;
    this.collateralToken = erc20;
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
