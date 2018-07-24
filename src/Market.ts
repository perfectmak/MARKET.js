import BigNumber from 'bignumber.js';
import Web3 from 'web3';

// Types
import { Provider } from '@0xproject/types';
import {
  ECSignature,
  ITxParams,
  MarketCollateralPoolFactory,
  MarketContractFactoryOraclize,
  MarketContractRegistry,
  MarketToken,
  Order,
  OrderLib,
  SignedOrder
} from '@marketprotocol/types';
import { MARKETProtocolConfig } from './types';

import { assert } from './assert';
import { ERC20TokenContractWrapper } from './contract_wrappers/ERC20TokenContractWrapper';

import {
  CollateralEvent,
  depositCollateralAsync,
  getCollateralEventsAsync,
  getUserAccountBalanceAsync,
  settleAndCloseAsync,
  withdrawCollateralAsync
} from './lib/Collateral';

import {
  deployMarketCollateralPoolAsync,
  deployMarketContractOraclizeAsync
} from './lib/Deployment';

import {
  createOrderHashAsync,
  createSignedOrderAsync,
  isValidSignatureAsync,
  signOrderHashAsync
} from './lib/Order';
import { OrderTransactionInfo } from './lib/OrderTransactionInfo';
import { MARKETProtocolArtifacts } from './MARKETProtocolArtifacts';
import { MarketProtocolOraclizeContractWrapper } from './contract_wrappers/MarketProtocolOraclizeContractWrapper';

/**
 * The `Market` class is the single entry-point into the MARKET.js library.
 * It contains all of the library's functionality and all calls to the library
 * should be made through a `Market` instance.
 */
export class Market {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  public marketContractRegistry: MarketContractRegistry;
  public mktTokenContract: MarketToken;
  public marketCollateralPoolFactory: MarketCollateralPoolFactory;
  public marketContractFactory: MarketContractFactoryOraclize; // todo: create interface.
  public orderLib: OrderLib;

  // wrappers
  public marketContractWrapper: MarketProtocolOraclizeContractWrapper;
  public erc20TokenContractWrapper: ERC20TokenContractWrapper;

  // Config
  public readonly config: MARKETProtocolConfig;

  private readonly _web3: Web3;
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  /**
   * Instantiates a new Market instance that provides the public interface to the Market library.
   * @param {Provider} provider    The Provider instance you would like the Market library to use
   *                               for interacting with the Ethereum network.
   * @param {MARKETProtocolConfig} config object for addresses and other vars
   * @return {Market}              An instance of the Market class.
   */
  constructor(provider: Provider, config: MARKETProtocolConfig) {
    assert.isWeb3Provider('provider', provider);
    // TODO: add check for config to conform to schema.

    this._web3 = new Web3();
    this._web3.setProvider(provider);

    if (
      !config.marketContractRegistryAddress &&
      !config.marketTokenAddress &&
      !config.marketContractFactoryAddress &&
      !config.marketCollateralPoolFactoryAddress &&
      !config.mathLibAddress &&
      !config.orderLibAddress
    ) {
      this._updateConfigFromArtifacts(config);
    }

    // Set updated config with artifacts addresses
    this.config = config;

    // Disabled TSLint and added @ts-ignore to suppress the undefined error for optional config param
    /* tslint:disable */
    // prettier-ignore
    // @ts-ignore
    this.marketContractRegistry = new MarketContractRegistry(this._web3, config.marketContractRegistryAddress);

    // prettier-ignore
    // @ts-ignore
    this.mktTokenContract = new MarketToken(this._web3, config.marketTokenAddress);

    // prettier-ignore
    // @ts-ignore
    this.marketContractFactory = new MarketContractFactoryOraclize(this._web3, config.marketContractFactoryAddress);

    // prettier-ignore
    // @ts-ignore
    this.marketCollateralPoolFactory = new MarketCollateralPoolFactory(this._web3, config.marketCollateralPoolFactoryAddress);

    // @ts-ignore prettier-ignore
    this.orderLib = new OrderLib(this._web3, config.orderLibAddress);
    /* tslint:enable */

    this.erc20TokenContractWrapper = new ERC20TokenContractWrapper(this._web3);
    this.marketContractWrapper = new MarketProtocolOraclizeContractWrapper(this._web3, this.erc20TokenContractWrapper);
  }
  // endregion//Constructors

  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************

  // PROVIDER METHODS
  /**
   * Sets a new web3 provider for MARKET.js. Updating the provider will stop all
   * subscriptions so you will need to re-subscribe to all events relevant to your app after this call.
   * @param {Provider} provider    The Web3Provider you would like the MARKET.js library to use from now on.
   * @returns {void}
   */
  public setProvider(provider: Provider): void {
    this._web3.setProvider(provider);
  }

  /**
   * Get the provider instance currently used by MARKET.js
   * @return {Provider}    Web3 provider instance
   */
  public getProvider(): Provider {
    return this._web3.currentProvider;
  }

  // COLLATERAL METHODS

  /**
   * Deposits collateral to a traders account for a given contract address.
   * @param {string} collateralPoolContractAddress    Address of the MarketCollateralPool
   * @param {string} collateralTokenAddress           Address of the CollateralToken
   * @param {BigNumber | number} depositAmount        Amount of ERC20 collateral to deposit
   * @param {ITxParams} txParams                      Transaction parameters
   * @returns {Promise<string>}                       The transaction hash.
   */
  public async depositCollateralAsync(
    collateralPoolContractAddress: string,
    collateralTokenAddress: string,
    depositAmount: BigNumber | number,
    txParams: ITxParams = {}
  ): Promise<string> {
    return depositCollateralAsync(
      this._web3.currentProvider,
      this.mktTokenContract,
      collateralPoolContractAddress,
      collateralTokenAddress,
      depositAmount,
      txParams
    );
  }

  /**
   * Gets the user's currently unallocated token balance
   * @param {string} collateralPoolContractAddress    Address of the MarketCollateralPool
   * @param {BigNumber | string} userAddress          Address of user
   * @returns {Promise<BigNumber|null>}               The user's currently unallocated token balance
   */
  public async getUserAccountBalanceAsync(
    collateralPoolContractAddress: string,
    userAddress: string
  ): Promise<BigNumber | null> {
    return getUserAccountBalanceAsync(
      this._web3.currentProvider,
      collateralPoolContractAddress,
      userAddress
    );
  }

  /**
   * Close all open positions post settlement and withdraws all collateral from a expired contract
   * @param {string} collateralPoolContractAddress    Address of the MarketCollateralPool
   * @param {ITxParams} txParams                      Transaction parameters
   * @returns {Promise<string>}                       The transaction hash.
   */
  public async settleAndCloseAsync(
    collateralPoolContractAddress: string,
    txParams: ITxParams = {}
  ): Promise<string> {
    return settleAndCloseAsync(this._web3.currentProvider, collateralPoolContractAddress, txParams);
  }

  /**
   * Withdraws collateral from a traders account back to their own address.
   * @param {string} collateralPoolContractAddress    Address of the MarketCollateralPool
   * @param {BigNumber | number} withdrawAmount       Amount of ERC20 collateral to withdraw
   * @param {ITxParams} txParams                      Transaction parameters
   * @returns {Promise<string>}                      The transaction hash.
   */
  public async withdrawCollateralAsync(
    collateralPoolContractAddress: string,
    withdrawAmount: BigNumber | number,
    txParams: ITxParams = {}
  ): Promise<string> {
    return withdrawCollateralAsync(
      this._web3.currentProvider,
      collateralPoolContractAddress,
      withdrawAmount,
      txParams
    );
  }

  /**
   * Gets the history of deposits and withdrawals for a given collateral pool address.
   * @param {string} collateralPoolContractAddress    address of the MarketCollateralPool
   * @param {string | number} fromBlock               from block #
   * @param {string | number} toBlock                 to block #
   * @param {string} userAddress                      only search for deposits/withdrawals to/from a specified address
   * @returns {Promise<CollateralEvent[]>}
   */
  public async getCollateralEventsAsync(
    collateralPoolContractAddress: string,
    fromBlock: number | string = '0x0',
    toBlock: number | string = 'latest',
    userAddress: string | null = null
  ): Promise<CollateralEvent[]> {
    return getCollateralEventsAsync(
      this._web3.currentProvider,
      collateralPoolContractAddress,
      fromBlock,
      toBlock,
      userAddress
    );
  }

  // CONTRACT METHODS

  /**
   * Gets the collateral pool contract address
   * @param {string} marketContractAddress    Address of the Market contract
   * @returns {Promise<string>}               The contract's collateral pool address
   */
  public async getCollateralPoolContractAddressAsync(
    marketContractAddress: string
  ): Promise<string> {
    return this.marketContractWrapper.getCollateralPoolContractAddressAsync(marketContractAddress);
  }

  /**
   * Gets the market contract name
   * @param {string} marketContractAddress    Address of the Market contract
   * @returns {Promise<string>}               The contract's name
   */
  public async getMarketContractNameAsync(marketContractAddress: string): Promise<string> {
    return this.marketContractWrapper.getMarketContractNameAsync(marketContractAddress);
  }

  /**
   * Gets the market contract price decimal places
   * @param {string} marketContractAddress    Address of the Market contract
   * @returns {Promise<BigNumber>}            The contract's name
   */
  public async getMarketContractPriceDecimalPlacesAsync(
    marketContractAddress: string
  ): Promise<BigNumber> {
    return this.marketContractWrapper.getMarketContractPriceDecimalPlacesAsync(
      marketContractAddress
    );
  }

  /**
   * Get all whilelisted contracts
   * @returns {Promise<string>}               The user's currently unallocated token balance
   */
  public async getAddressWhiteListAsync(): Promise<string[]> {
    return this.marketContractRegistry.getAddressWhiteList;
  }

  /**
   * Get the oracle query for the MarketContract
   * @param marketContractAddress   MarketContract address
   * @returns {Promise<string>}     The oracle query
   */
  public async getOracleQueryAsync(marketContractAddress: string): Promise<string> {
    return this.marketContractWrapper.getOracleQueryAsync(marketContractAddress);
  }

  /**
   * Gets the contract expiration timestamp
   * @param {string} marketContractAddress   MarketContract address
   * @returns {Promise<BigNumber>}           Expiration timestamp
   */
  public async getContractExpirationAsync(marketContractAddress: string): Promise<BigNumber> {
    return this.marketContractWrapper.getContractExpirationAsync(marketContractAddress);
  }

  /**
   * Gets the settlement status of the contract
   * @param {string} marketContractAddress    MarketContract address
   * @returns {Promise<boolean>}              True/false
   */
  public async isContractSettledAsync(marketContractAddress: string): Promise<boolean> {
    return this.marketContractWrapper.isContractSettledAsync(marketContractAddress);
  }

  // DEPLOYMENT METHODS

  /**
   * Calls our factory to create a new MarketCollateralPool that is then linked to the supplied
   * marketContractAddress.
   * @param {string} marketContractAddress
   * @param {ITxParams} txParams
   * @returns {Promise<string>}                   Transaction of successful deployment.
   */
  public async deployMarketCollateralPoolAsync(
    marketContractAddress: string,
    txParams: ITxParams = {}
  ): Promise<string> {
    return deployMarketCollateralPoolAsync(
      this._web3.currentProvider,
      this.marketCollateralPoolFactory,
      marketContractAddress,
      txParams
    );
  }

  /**
   * calls our factory that deploys a MarketContractOraclize and then adds it to
   * the MarketContractRegistry.
   * @param {string} contractName
   * @param {string} collateralTokenAddress
   * @param {BigNumber[]} contractSpecs
   * @param {string} oracleDataSource
   * @param {string} oracleQuery
   * @param {ITxParams} txParams
   * @returns {Promise<string | BigNumber>}         Deployed address of the new Market Contract.
   */
  public async deployMarketContractOraclizeAsync(
    contractName: string,
    collateralTokenAddress: string,
    contractSpecs: BigNumber[], // not sure why this is a big number from the typedefs?
    oracleDataSource: string,
    oracleQuery: string,
    txParams: ITxParams = {}
  ): Promise<string | BigNumber> {
    return deployMarketContractOraclizeAsync(
      this._web3.currentProvider,
      this.marketContractFactory,
      contractName,
      collateralTokenAddress,
      contractSpecs,
      oracleDataSource,
      oracleQuery,
      txParams
    );
  }

  // ORDER METHODS

  /**
   * Computes the orderHash for a supplied order.
   * @param {string} orderLibAddress       Address of the deployed OrderLib.
   * @param {Order | SignedOrder} order    An object that conforms to the Order or SignedOrder interface definitions.
   * @return {Promise<string>}             The resulting orderHash from hashing the supplied order.
   */
  public async createOrderHashAsync(
    orderLibAddress: string,
    order: Order | SignedOrder
  ): Promise<string> {
    return createOrderHashAsync(this._web3.currentProvider, orderLibAddress, order);
  }

  /**
   * Confirms a signed order is validly signed
   * @param signedOrder
   * @param orderHash
   * @return boolean if order hash and signature resolve to maker address (signer)
   */
  public async isValidSignatureAsync(
    signedOrder: SignedOrder,
    orderHash: string
  ): Promise<boolean> {
    return isValidSignatureAsync(
      this._web3.currentProvider,
      this.orderLib.address,
      signedOrder,
      orderHash
    );
  }

  /**
   * Signs an orderHash and returns it's elliptic curve signature.
   * @param {string} orderHash       Hex encoded orderHash to sign.
   * @param {string} signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
   *                                 must be available via the Provider supplied to MARKET.js.
   * @return {Promise<ECSignature>}  An object containing the Elliptic curve signature parameters generated
   *                                 by signing the orderHash.
   */
  public async signOrderHashAsync(orderHash: string, signerAddress: string): Promise<ECSignature> {
    return signOrderHashAsync(this._web3.currentProvider, orderHash, signerAddress);
  }

  /***
   * Creates and signs a new order given the arguments provided
   * @param {string} orderLibAddress          address of the deployed OrderLib.sol
   * @param {string} contractAddress          address of the deployed MarketContract.sol
   * @param {BigNumber} expirationTimestamp   unix timestamp
   * @param {string} feeRecipient             address of account to receive fees
   * @param {string} maker                    address of maker account
   * @param {BigNumber} makerFee              fee amount for maker to pay
   * @param {string} taker                    address of taker account
   * @param {BigNumber} takerFee              fee amount for taker to pay
   * @param {BigNumber} orderQty              qty of Order
   * @param {BigNumber} price                 price of Order
   * @param {BigNumber} remainingQty          qty remaining
   * @param {BigNumber} salt                  used to ensure unique order hashes
   * @return {Promise<SignedOrder>}
   */
  public async createSignedOrderAsync(
    orderLibAddress: string,
    contractAddress: string,
    expirationTimestamp: BigNumber,
    feeRecipient: string,
    maker: string,
    makerFee: BigNumber,
    taker: string,
    takerFee: BigNumber,
    orderQty: BigNumber,
    price: BigNumber,
    remainingQty: BigNumber,
    salt: BigNumber
  ): Promise<SignedOrder> {
    return createSignedOrderAsync(
      this._web3.currentProvider,
      orderLibAddress,
      contractAddress,
      expirationTimestamp,
      feeRecipient,
      maker,
      makerFee,
      taker,
      takerFee,
      orderQty,
      price,
      remainingQty,
      salt
    );
  }

  /**
   * Trades an order and returns success or error.
   * The returned OrderTransactionInfo can be used to get the actual filled quantity
   *
   * @param {SignedOrder} signedOrder        An object that conforms to the SignedOrder interface. The
   *                                         signedOrder you wish to validate.
   * @param {BigNumber} fillQty              The amount of the order that you wish to fill.
   * @param {ITxParams} txParams             Transaction params of web3.
   * @return {Promise<OrderTransactionInfo>} The information about this order transaction
   */
  public async tradeOrderAsync(
    signedOrder: SignedOrder,
    fillQty: BigNumber,
    txParams: ITxParams = {}
  ): Promise<OrderTransactionInfo> {
    return this.marketContractWrapper.tradeOrderAsync(
      this.mktTokenContract,
      this.orderLib.address,
      signedOrder,
      fillQty,
      txParams
    );
  }

  /**
   * Returns the qty that is no longer available to trade for a given order/
   * @param {string} orderHash                Hash of order to find filled and cancelled qty.
   * @param {string} marketContractAddress    Address of the Market contract
   * @return {Promise<BigNumber>}             The filled or cancelled quantity.
   */
  public async getQtyFilledOrCancelledFromOrderAsync(
    marketContractAddress: string,
    orderHash: string
  ): Promise<BigNumber> {
    return this.marketContractWrapper.getQtyFilledOrCancelledFromOrderAsync(
      marketContractAddress,
      orderHash
    );
  }

  /**
   * Cancels an order in the given quantity.
   * The returned OrderTransactionInfo can be used to get the actual cancelled quantity
   *
   * @param {Order} order                     Order object.
   * @param {BigNumber} cancelQty             The amount of the order that you wish to cancel.
   * @param {ITxParams} txParams              Transaction params of web3.
   * @return {Promise<OrderTransactionInfo>}  The information about this Order Transaction.
   */
  public async cancelOrderAsync(
    order: Order,
    cancelQty: BigNumber,
    txParams: ITxParams = {}
  ): Promise<OrderTransactionInfo> {
    return this.marketContractWrapper.cancelOrderAsync(order, cancelQty, txParams);
  }

  /**
   * Calculates the required collateral amount in base units of a token.  This amount represents
   * a trader's maximum loss and therefore the amount of collateral that becomes locked into
   * the smart contracts upon execution of a trade.
   * @param {string} marketContractAddress
   * @param {BigNumber} qty             desired qty to trade (+ for buy / - for sell)
   * @param {BigNumber} price           execution price
   * @return {Promise<BigNumber>}       amount of needed collateral to become locked.
   */
  public async calculateNeededCollateralAsync(
    marketContractAddress: string,
    qty: BigNumber,
    price: BigNumber
  ): Promise<BigNumber> {
    return this.marketContractWrapper.calculateNeededCollateralAsync(
      marketContractAddress,
      qty,
      price
    );
  }
  // endregion //Public Methods

  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************
  /**
   * Attempts to update a config with all the needed addresses from artifacts if available.
   * @param {MARKETProtocolConfig} config
   * @returns {MARKETProtocolConfig}
   * @private
   */
  private _updateConfigFromArtifacts(config: MARKETProtocolConfig): MARKETProtocolConfig {
    const artifacts = new MARKETProtocolArtifacts(config.networkId);

    config.marketContractRegistryAddress =
      artifacts.marketContractRegistryArtifact.networks[config.networkId].address;

    config.marketTokenAddress = artifacts.marketTokenArtifact.networks[config.networkId].address;

    config.marketContractFactoryAddress =
      artifacts.marketContractFactoryOraclizeArtifact.networks[config.networkId].address;

    config.marketCollateralPoolFactoryAddress =
      artifacts.marketCollateralPoolFactoryArtifact.networks[config.networkId].address;

    config.mathLibAddress = artifacts.mathLibArtifact.networks[config.networkId].address;

    config.orderLibAddress = artifacts.orderLibArtifact.networks[config.networkId].address;

    return config;
  }
  // endregion //Private Methods
}
