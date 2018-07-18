import BigNumber from 'bignumber.js';
import { RBTree } from 'bintrees';
import * as _ from 'lodash';

// Types
import { MarketError } from '../types';

import { IntervalUtils, Utils } from '../lib/Utils';

const DEFAULT_EXPIRATION_MARGIN_MS = 0;
const DEFAULT_ORDER_EXPIRATION_CHECKING_INTERVAL_MS = 50;

/**
 * This class includes the functionality to detect expired orders.
 * It stores them in a min heap by expiration time and checks for expired ones every `orderExpirationCheckingIntervalMs`
 */
export class ExpirationWatcher {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  //
  private _orderHashByExpirationRBTree: RBTree<string>;
  private _expiration: { [orderHash: string]: BigNumber } = {};
  private _orderExpirationCheckingIntervalMs: number;
  private _expirationMarginMs: number;
  private _orderExpirationCheckingIntervalIdIfExists?: NodeJS.Timer;
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  //
  constructor(
    expirationMarginIfExistsMs?: number,
    orderExpirationCheckingIntervalIfExistsMs?: number
  ) {
    this._expirationMarginMs = expirationMarginIfExistsMs || DEFAULT_EXPIRATION_MARGIN_MS;
    this._orderExpirationCheckingIntervalMs =
      expirationMarginIfExistsMs || DEFAULT_ORDER_EXPIRATION_CHECKING_INTERVAL_MS;
    const scoreFunction = (orderHash: string) => this._expiration[orderHash].toNumber();
    const comparator = (lhs: string, rhs: string) => scoreFunction(lhs) - scoreFunction(rhs);
    this._orderHashByExpirationRBTree = new RBTree(comparator);
  }
  //
  //
  // endregion//Constructors

  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************

  /**
   * allows caller to recieve call backs in regards to state of order expiration
   * @param {(orderHash: string) => void} callback  callback function
   */
  public subscribe(callback: (orderHash: string) => void): void {
    if (!_.isUndefined(this._orderExpirationCheckingIntervalIdIfExists)) {
      throw new Error(MarketError.SubscriptionAlreadyPresent);
    }
    this._orderExpirationCheckingIntervalIdIfExists = IntervalUtils.setInterval(
      this._pruneExpiredOrders.bind(this, callback),
      this._orderExpirationCheckingIntervalMs,
      _.noop // _pruneExpiredOrders never throws
    );
  }

  /**
   * Allows caller to stop receiving callbacks.
   */
  public unsubscribe(): void {
    if (_.isUndefined(this._orderExpirationCheckingIntervalIdIfExists)) {
      throw new Error(MarketError.SubscriptionNotFound);
    }
    IntervalUtils.clearInterval(this._orderExpirationCheckingIntervalIdIfExists);
    delete this._orderExpirationCheckingIntervalIdIfExists;
  }

  /**
   * Adds an order hash to our collection to monitor for expiration
   * @param {string} orderHash
   * @param {BigNumber} expirationUnixTimestampMs
   */
  public addOrder(orderHash: string, expirationUnixTimestampMs: BigNumber): void {
    this._expiration[orderHash] = expirationUnixTimestampMs;
    this._orderHashByExpirationRBTree.insert(orderHash);
  }

  /**
   * Removes an order hash to our collection to monitor for expiration
   * @param {string} orderHash
   */
  public removeOrder(orderHash: string): void {
    this._orderHashByExpirationRBTree.remove(orderHash);
    delete this._expiration[orderHash];
  }

  // endregion //Public Methods

  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************

  /**
   * Main routine for checking order state and firing callbacks.
   * @param {(orderHash: string) => void} callback
   * @private
   */
  private _pruneExpiredOrders(callback: (orderHash: string) => void): void {
    const currentUnixTimestampMs = Utils.getCurrentUnixTimestampMs();
    while (true) {
      const isEmpty = this._orderHashByExpirationRBTree.size === 0;
      if (isEmpty) {
        break;
      }

      const nextOrderHashToExpire = this._orderHashByExpirationRBTree.min();
      const hasNoExpiredOrders = this._expiration[nextOrderHashToExpire].isGreaterThan(
        currentUnixTimestampMs.plus(this._expirationMarginMs)
      );

      const isSubscriptionActive = _.isUndefined(this._orderExpirationCheckingIntervalIdIfExists);
      if (hasNoExpiredOrders || isSubscriptionActive) {
        break;
      }
      const orderHash = this._orderHashByExpirationRBTree.min();
      this._orderHashByExpirationRBTree.remove(orderHash);
      delete this._expiration[orderHash];
      callback(orderHash);
    }
  }

  // endregion //Private Methods
}
