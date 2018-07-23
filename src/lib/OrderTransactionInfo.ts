import BigNumber from 'bignumber.js';

import { MarketContract, Order } from '@marketprotocol/types';
import { MarketError } from '../types';

/**
 * Parameters to initialize OrderTransactionInfo
 *
 */
export interface OrderTransactionInfoParams {
  txHash: string;
  blockNumber?: number;
}

/**
 * OrderTransactionInfo fetches and hold all the necessary information about
 * a transaction and its order that has been posted through a market contract.
 *
 */
export class OrderTransactionInfo {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  static readonly ORDER_EXPIRED_CODE = '0';
  static readonly ORDER_DEAD_CODE = '1';

  readonly txHash: string;

  private readonly _marketContract: MarketContract;
  private readonly _order: Order;
  private _fromBlockNumber: number = 0;
  private _toBlockNumber?: number;

  // endregion // Members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  private constructor(marketContract: MarketContract, order: Order, txHash: string) {
    this._marketContract = marketContract;
    this._order = order;
    this.txHash = txHash;
  }

  // endregion // Constructors
  // region Properties
  // *****************************************************************
  // ****                     Properties                          ****
  // *****************************************************************

  /**
   * Factory function to create all relevant order information
   *
   * @param {MarketContract} marketContract MarketContract for order
   * @param {Order} order Order with info to be tracked
   * @param {OrderTransactionInfoParams} txParams transaction parameters
   */
  static create(
    marketContract: MarketContract,
    order: Order,
    txParams: OrderTransactionInfoParams
  ): OrderTransactionInfo {
    const orderTxInfo = new OrderTransactionInfo(marketContract, order, txParams.txHash);
    orderTxInfo._fromBlockNumber = txParams.blockNumber ? txParams.blockNumber : 0;
    orderTxInfo._toBlockNumber = txParams.blockNumber;
    return orderTxInfo;
  }

  // endregion //Properties

  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************

  /**
   * Fetches filled quantity for this order.
   *
   *
   */
  get filledQty(): Promise<BigNumber | number> {
    return (async () => {
      let stopEventWatcher = async () => {
        return;
      }; // pre-initialized to prevent NPE checks :)

      try {
        const fillQty = await Promise.race([
          this._fetchOrWatchForFilledQty(stopEventWatcher),
          this._watchForError()
        ]);
        return fillQty;
      } catch (err) {
        await stopEventWatcher(); // cleanup, prevent further watching
        return Promise.reject(err);
      }
    })();
  }

  /**
   * Fetches cancelled quantity for this order
   *
   */
  get cancelledQty(): Promise<BigNumber | number> {
    return (async () => {
      let stopEventWatcher = async () => {
        return;
      }; // pre-initialized to prevent NPE checks :)

      try {
        const cancelledQty = await Promise.race([
          this._fetchOrWatchForCancelledQty(stopEventWatcher),
          this._watchForError()
        ]);
        return cancelledQty;
      } catch (err) {
        await stopEventWatcher(); // cleanup, prevent further watching
        return Promise.reject(err);
      }
    })();
  }

  // endregion // Public Methods
  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************

  /**
   * Tries to fetch filledQty for this Order.
   * If nothing found, watches for when it is found.
   *
   * @param {() => Promise<void>} stopWatcher stop watching for filled Qty
   */
  private _fetchOrWatchForFilledQty(stopWatcher: () => Promise<void>): Promise<BigNumber | number> {
    return new Promise<BigNumber | number>(async (resolve, reject) => {
      const watchFilter = { fromBlock: this._fromBlockNumber, toBlock: this._toBlockNumber };
      const orderEvent = this._marketContract.OrderFilledEvent({ maker: this._order.maker });

      // try fetching event
      const eventLogs = await orderEvent.get(watchFilter);
      let foundEvent = eventLogs.find(eventLog => eventLog.transactionHash === this.txHash);
      if (foundEvent) {
        resolve(foundEvent.args.filledQty);
        return;
      }

      // watch for event
      stopWatcher = orderEvent.watch(watchFilter, (err, eventLog) => {
        if (err) {
          console.log(err);
        }

        if (eventLog.transactionHash === this.txHash) {
          stopWatcher()
            .then(function() {
              return resolve(eventLog.args.filledQty);
            })
            .catch(reject);
        }
      });
    });
  }

  /**
   * Tries to fetch cancelled for this Order.
   * If nothing found, watches for when it is found.
   *
   * @param {() => Promise<void>} stopWatcher stop watching for cancelled Qty
   */
  private _fetchOrWatchForCancelledQty(
    stopWatcher: () => Promise<void>
  ): Promise<BigNumber | number> {
    return new Promise<BigNumber | number>(async (resolve, reject) => {
      const watchFilter = { fromBlock: this._fromBlockNumber, toBlock: this._toBlockNumber };
      const orderEvent = this._marketContract.OrderCancelledEvent({ maker: this._order.maker });

      // try fetching event
      const eventLogs = await orderEvent.get(watchFilter);
      let foundEvent = eventLogs.find(eventLog => eventLog.transactionHash === this.txHash);
      if (foundEvent) {
        resolve(foundEvent.args.cancelledQty);
        return;
      }

      // watch for event
      stopWatcher = orderEvent.watch(watchFilter, (err, eventLog) => {
        if (err) {
          console.log(err);
        }

        if (eventLog.transactionHash === this.txHash) {
          stopWatcher()
            .then(function() {
              return resolve(eventLog.args.cancelledQty);
            })
            .catch(reject);
        }
      });
    });
  }

  private _watchForError(): Promise<BigNumber | number> {
    return new Promise((_, reject) => {
      const errorEvent = this._marketContract.ErrorEvent({});

      const stopErrorEventWatcher = errorEvent.watch(
        { fromBlock: this._fromBlockNumber, toBlock: this._toBlockNumber },
        (err, eventLog) => {
          if (err) {
            console.log(err);
          }

          if (eventLog.transactionHash === this.txHash) {
            stopErrorEventWatcher()
              .then(() => {
                switch (eventLog.args.errorCode.toString()) {
                  case OrderTransactionInfo.ORDER_EXPIRED_CODE:
                    return reject(new Error(MarketError.OrderExpired));
                  case OrderTransactionInfo.ORDER_DEAD_CODE:
                    return reject(new Error(MarketError.OrderDead));
                  default:
                    return reject(new Error(MarketError.UnknownOrderError));
                }
              })
              .catch(reject);
          }
        }
      );
    });
  }
}
