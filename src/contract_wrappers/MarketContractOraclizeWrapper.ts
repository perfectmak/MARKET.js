import * as _ from 'lodash';
import Web3 from 'web3';

// Types
import { MarketContractOraclize } from '@marketprotocol/types';
import { MarketContractWrapper } from './MarketContractWrapper';
import BigNumber from 'bignumber.js';

/**
 * Wrapper for our MarketContractOraclize objects.  This wrapper exposes all needed functionality of the
 * MarketContractOraclize itself and stores the created MarketContractOraclize objects in a mapping for easy reuse.
 */
export class MarketContractOraclizeWrapper extends MarketContractWrapper {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  private readonly _marketContractOraclizeByAddress: { [address: string]: MarketContractOraclize };
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  constructor(web3: Web3) {
    super(web3);
    this._marketContractOraclizeByAddress = {};
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
  /**
   * Gets the MarketContract oracle query.
   * @param {string} marketContractOraclizeAddress   Address of the contract
   * @returns {Promise<string>}                      The oracle query
   */
  public async getOracleQueryAsync(marketContractOraclizeAddress: string): Promise<string> {
    const marketContractOraclize: MarketContractOraclize = await this._getMarketContractAsync(
      marketContractOraclizeAddress
    );
    return marketContractOraclize.ORACLE_QUERY;
  }

  /**
   * Gets the MarketContract expiration.
   * @param {string} marketContractOraclizeAddress   Address of the contract
   * @returns {Promise<BigNumber>}                   Expiration timestamp
   */
  public async getContractExpirationAsync(
    marketContractOraclizeAddress: string
  ): Promise<BigNumber> {
    const marketContractOraclize: MarketContractOraclize = await this._getMarketContractAsync(
      marketContractOraclizeAddress
    );
    return marketContractOraclize.EXPIRATION;
  }

  /**
   * Gets the MarketContract expiration.
   * @param {string} marketContractOraclizeAddress   Address of the contract
   * @returns {Promise<boolean>}                     Is this contract settled?
   */
  public async isContractSettledAsync(marketContractOraclizeAddress: string): Promise<boolean> {
    const marketContractOraclize: MarketContractOraclize = await this._getMarketContractAsync(
      marketContractOraclizeAddress
    );
    return marketContractOraclize.isSettled;
  }

  // endregion //Public Methods

  // region Protected Methods
  // *****************************************************************
  // ****                    Protected Methods                    ****
  // *****************************************************************
  /**
   * Allow for retrieval or creation of a given MarketContractOraclize
   * @param {string} marketContractOraclizeAddress    Address of MarketContractOraclize
   * @returns {Promise<MarketContractOraclize>}       MarketContractOraclize object
   * @private
   */
  protected async _getMarketContractAsync(
    marketContractOraclizeAddress: string
  ): Promise<MarketContractOraclize> {
    const normalizedMarketAddress = marketContractOraclizeAddress.toLowerCase();
    let marketContractOraclize = this._marketContractOraclizeByAddress[normalizedMarketAddress];
    if (!_.isUndefined(marketContractOraclize)) {
      return marketContractOraclize;
    }
    marketContractOraclize = new MarketContractOraclize(this._web3, marketContractOraclizeAddress);
    this._marketContractOraclizeByAddress[normalizedMarketAddress] = marketContractOraclize;
    return marketContractOraclize;
  }
  // endregion //Protected Methods

  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************
  // endregion //Private Methods
}
