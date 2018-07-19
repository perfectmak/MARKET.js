import BigNumber from 'bignumber.js';
import * as _ from 'lodash';
import Web3 from 'web3';

// Types
import { ITxParams, MarketContract, MarketToken, Order, SignedOrder } from '@marketprotocol/types';
import { MarketError } from '../types';
import { ERC20TokenContractWrapper } from './ERC20TokenContractWrapper';
import { getUserAccountBalanceAsync } from '../lib/Collateral';
import { Utils } from '../lib/Utils';
import { constants } from '../constants';
import { createOrderHashAsync, isValidSignatureAsync } from '../lib/Order';
import { assert } from '../assert';

/**
 * Wrapper for our MarketContract objects.  This wrapper exposes all needed functionality of the
 * MarketContract itself and stores the created MarketContract objects in a mapping for easy reuse.
 */
export class MarketContractWrapper {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  static readonly ORDER_EXPIRED_CODE = '0';
  static readonly ORDER_DEAD_CODE = '1';

  protected readonly _web3: Web3;
  private readonly _marketContractsByAddress: { [address: string]: MarketContract };

  // endregion // members
  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor(web3: Web3) {
    this._web3 = web3;
    this._marketContractsByAddress = {};
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
   * Cancels an order in the given quantity.
   * @param   order                          The order you wish to cancel.
   * @param   cancelQty                      The amount of the order that you wish to fill.
   * @param   txParams                       Transaction params of web3.
   * @returns {Promise<BigNumber | number>}  The quantity cancelled.
   */
  public async cancelOrderAsync(
    order: Order,
    cancelQty: BigNumber,
    txParams: ITxParams = {}
  ): Promise<BigNumber | number> {
    const marketContract: MarketContract = await this._getMarketContractAsync(
      order.contractAddress
    );
    const txHash: string = await marketContract
      .cancelOrderTx(
        [order.maker, order.taker, order.feeRecipient],
        [order.makerFee, order.takerFee, order.price, order.expirationTimestamp, order.salt],
        order.orderQty,
        cancelQty
      )
      .send(txParams);

    const blockNumber: number = Number(this._web3.eth.getTransaction(txHash).blockNumber);
    return new Promise<BigNumber | number>((resolve, reject) => {
      const stopEventWatcher = marketContract
        .OrderCancelledEvent({ maker: order.maker })
        .watch({ fromBlock: blockNumber, toBlock: blockNumber }, (err, eventLog) => {
          if (err) {
            console.log(err);
          }
          if (eventLog.transactionHash === txHash) {
            stopEventWatcher()
              .then(function() {
                return resolve(eventLog.args.cancelledQty);
              })
              .catch(reject);
          }
        });
    });
  }

  /**
   * Trades an order and returns success or error.
   * @param {MarketToken} mktTokenContract
   * @param {string} orderLibAddress       Address of the deployed OrderLib.
   * @param   signedOrder                     An object that conforms to the SignedOrder interface. The
   *                                          signedOrder you wish to validate.
   * @param   fillQty                         The amount of the order that you wish to fill.
   * @param   txParams                        Transaction params of web3.
   * @returns {Promise<BigNumber | number>}   The filled quantity.
   */
  public async tradeOrderAsync(
    mktTokenContract: MarketToken,
    orderLibAddress: string,
    signedOrder: SignedOrder,
    fillQty: BigNumber,
    txParams: ITxParams = {}
  ): Promise<BigNumber | number> {
    assert.isETHAddressHex('orderLibAddress', orderLibAddress);
    // assert.isSchemaValid('SignedOrder', signedOrder, schemas.SignedOrderSchema);

    const marketContract: MarketContract = await this._getMarketContractAsync(
      signedOrder.contractAddress
    );

    const isContractSettled = await marketContract.isSettled;
    if (isContractSettled) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.ContractAlreadySettled));
    }

    const maker = signedOrder.maker;
    const taker = txParams.from ? txParams.from : constants.NULL_ADDRESS;

    if (signedOrder.taker !== constants.NULL_ADDRESS && signedOrder.taker !== taker) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.InvalidTaker));
    }

    if (signedOrder.expirationTimestamp.isLessThan(Utils.getCurrentUnixTimestampSec())) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.OrderExpired));
    }

    if (signedOrder.remainingQty.isEqualTo(new BigNumber(0))) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.OrderFilledOrCancelled));
    }

    if (signedOrder.orderQty.isPositive() !== fillQty.isPositive()) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.BuySellMismatch));
    }

    const orderHash = await createOrderHashAsync(
      this._web3.currentProvider,
      orderLibAddress,
      signedOrder
    );

    const validSignature = await isValidSignatureAsync(
      this._web3.currentProvider,
      orderLibAddress,
      signedOrder,
      orderHash
    );

    if (!validSignature) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.InvalidSignature));
    }

    const collateralPoolContractAddress = await marketContract.MARKET_COLLATERAL_POOL_ADDRESS;
    const isMakerEnabled = await mktTokenContract.isUserEnabledForContract(
      signedOrder.contractAddress,
      maker
    );
    const isTakerEnabled = await mktTokenContract.isUserEnabledForContract(
      signedOrder.contractAddress,
      taker
    );

    if (!isMakerEnabled || !isTakerEnabled) {
      return Promise.reject<BigNumber | number>(new Error(MarketError.UserNotEnabledForContract));
    }

    const erc20ContractWrapper: ERC20TokenContractWrapper = new ERC20TokenContractWrapper(
      this._web3
    );

    const makerMktBalance: BigNumber = new BigNumber(
      await erc20ContractWrapper.getBalanceAsync(mktTokenContract.address, maker)
    );

    if (makerMktBalance.isLessThan(signedOrder.makerFee)) {
      return Promise.reject<BigNumber | number>(
        new Error(MarketError.InsufficientBalanceForTransfer)
      );
    }

    const makersMktAllowance = new BigNumber(
      await erc20ContractWrapper.getAllowanceAsync(
        mktTokenContract.address,
        maker,
        signedOrder.feeRecipient
      )
    );

    if (makersMktAllowance.isLessThan(signedOrder.makerFee)) {
      return Promise.reject<BigNumber | number>(
        new Error(MarketError.InsufficientAllowanceForTransfer)
      );
    }

    const takerMktBalance: BigNumber = new BigNumber(
      await erc20ContractWrapper.getBalanceAsync(mktTokenContract.address, taker)
    );

    if (takerMktBalance.isLessThan(signedOrder.takerFee)) {
      return Promise.reject<BigNumber | number>(
        new Error(MarketError.InsufficientBalanceForTransfer)
      );
    }

    const takersMktAllowance = new BigNumber(
      await erc20ContractWrapper.getAllowanceAsync(
        mktTokenContract.address,
        taker,
        signedOrder.feeRecipient
      )
    );

    if (takersMktAllowance.isLessThan(signedOrder.takerFee)) {
      return Promise.reject<BigNumber | number>(
        new Error(MarketError.InsufficientAllowanceForTransfer)
      );
    }

    const makerCollateralBalance: BigNumber = new BigNumber(
      await getUserAccountBalanceAsync(
        this._web3.currentProvider,
        collateralPoolContractAddress,
        maker
      )
    );
    const takerCollateralBalance: BigNumber = new BigNumber(
      await getUserAccountBalanceAsync(
        this._web3.currentProvider,
        collateralPoolContractAddress,
        taker
      )
    );

    const neededCollateralMaker: BigNumber = await this.calculateNeededCollateralAsync(
      signedOrder.contractAddress,
      fillQty,
      signedOrder.price
    );

    const neededCollateralTaker: BigNumber = await this.calculateNeededCollateralAsync(
      signedOrder.contractAddress,
      fillQty.times(-1), // opposite direction of the order sign! If i fill a buy order, I am selling / short.
      signedOrder.price
    );

    if (makerCollateralBalance.isLessThan(neededCollateralMaker)) {
      return Promise.reject<BigNumber | number>(
        new Error(MarketError.InsufficientCollateralBalance)
      );
    }

    if (takerCollateralBalance.isLessThan(neededCollateralTaker)) {
      return Promise.reject<BigNumber | number>(
        new Error(MarketError.InsufficientCollateralBalance)
      );
    }

    const txHash: string = await marketContract
      .tradeOrderTx(
        // orderAddresses
        [signedOrder.maker, signedOrder.taker, signedOrder.feeRecipient],
        // unsignedOrderValues
        [
          signedOrder.makerFee,
          signedOrder.takerFee,
          signedOrder.price,
          signedOrder.expirationTimestamp,
          signedOrder.salt
        ],
        signedOrder.orderQty,
        fillQty,
        signedOrder.ecSignature.v,
        signedOrder.ecSignature.r,
        signedOrder.ecSignature.s
      )
      .send(txParams);

    const blockNumber: number = Number(this._web3.eth.getTransaction(txHash).blockNumber);

    return new Promise<BigNumber | number>((resolve, reject) => {
      const stopEventWatcher = marketContract
        .OrderFilledEvent({ maker: signedOrder.maker })
        .watch({ fromBlock: blockNumber, toBlock: blockNumber }, (err, eventLog) => {
          // Validate this tx hash matches the tx we just created above.
          if (err) {
            console.log(err);
          }

          if (eventLog.transactionHash === txHash) {
            stopEventWatcher()
              .then(function() {
                return resolve(eventLog.args.filledQty);
              })
              .catch(reject);
          }
        });

      const stopErrorEventWatcher = marketContract
        .ErrorEvent({})
        .watch({ fromBlock: blockNumber, toBlock: blockNumber }, (err, eventLog) => {
          if (err) {
            console.log(err);
            reject(err);
            return;
          }

          if (eventLog.transactionHash === txHash) {
            stopErrorEventWatcher()
              .then(stopEventWatcher)
              .then(() => {
                switch (eventLog.args.errorCode.toString()) {
                  case MarketContractWrapper.ORDER_EXPIRED_CODE:
                    return reject(new Error(MarketError.OrderExpired));
                  case MarketContractWrapper.ORDER_DEAD_CODE:
                    return reject(new Error(MarketError.OrderDead));
                  default:
                    return reject(new Error(MarketError.UnknownOrderError));
                }
              })
              .catch(reject);
          }
        });
    });
    // TODO: listen for error events marketContract.ErrorEvent()
  }

  /**
   * Returns the qty that is no longer available to trade for a given order/
   * @param   marketContractAddress   The address of the Market contract.
   * @param   orderHash               Hash of order to find filled and cancelled qty.
   * @returns {Promise<BigNumber>}    A BigNumber of the filled or cancelled quantity.
   */
  public async getQtyFilledOrCancelledFromOrderAsync(
    marketContractAddress: string,
    orderHash: string
  ): Promise<BigNumber> {
    const marketContract: MarketContract = await this._getMarketContractAsync(
      marketContractAddress
    );
    return marketContract.getQtyFilledOrCancelledFromOrder(orderHash);
  }

  /**
   * Gets the collateral pool contract address
   * @param {string} marketContractAddress    Address of the Market contract.
   * @returns {Promise<string>}               The contract's name
   */
  public async getMarketContractNameAsync(marketContractAddress: string): Promise<string> {
    const marketContract: MarketContract = await this._getMarketContractAsync(
      marketContractAddress
    );
    return marketContract.CONTRACT_NAME;
  }

  /**
   * Gets the market contract price decimal places
   * @param {string} marketContractAddress    Address of the Market contract
   * @returns {Promise<BigNumber>}            The contract's price decimal places
   */
  public async getMarketContractPriceDecimalPlacesAsync(
    marketContractAddress: string
  ): Promise<BigNumber> {
    const marketContract: MarketContract = await this._getMarketContractAsync(
      marketContractAddress
    );
    return marketContract.PRICE_DECIMAL_PLACES;
  }

  /**
   * Gets the contract name
   * @param {string} marketContractAddress    Address of the Market contract.
   * @returns {Promise<string>}               The collateral pool contract address.
   */
  public async getCollateralPoolContractAddressAsync(
    marketContractAddress: string
  ): Promise<string> {
    const marketContract: MarketContract = await this._getMarketContractAsync(
      marketContractAddress
    );
    return marketContract.MARKET_COLLATERAL_POOL_ADDRESS;
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
    const marketContract: MarketContract = await this._getMarketContractAsync(
      marketContractAddress
    );

    return Utils.calculateNeededCollateral(
      await marketContract.PRICE_FLOOR,
      await marketContract.PRICE_CAP,
      await marketContract.QTY_MULTIPLIER,
      qty,
      price
    );
  }
  // endregion //Public Methods

  // region Protected Methods
  // *****************************************************************
  // ****                    Protected Methods                    ****
  // *****************************************************************
  /**
   * Allow for retrieval or creation of a given MarketContract
   * @param {string} marketAddress        address of MarketContract
   * @returns {Promise<MarketContract>}   MarketContract object
   * @private
   */
  protected async _getMarketContractAsync(marketAddress: string): Promise<MarketContract> {
    const normalizedMarketAddress = marketAddress.toLowerCase();
    let tokenContract = this._marketContractsByAddress[normalizedMarketAddress];
    if (!_.isUndefined(tokenContract)) {
      return tokenContract;
    }
    tokenContract = new MarketContract(this._web3, marketAddress);
    this._marketContractsByAddress[normalizedMarketAddress] = tokenContract;
    return tokenContract;
  }
  // endregion //Protected Methods

  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************
  // endregion //Private Methods
}
