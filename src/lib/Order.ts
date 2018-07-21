import BigNumber from 'bignumber.js';
import Web3 from 'web3';

// Types
import { Provider } from '@0xproject/types';
import { ECSignature, MarketContract, Order, OrderLib, SignedOrder } from '@marketprotocol/types';

import { MarketError } from '../types';
import { Utils } from './Utils';
import { assert } from '../assert';

/**
 * Computes the orderHash for a supplied order.
 * @param   provider   Web3 provider instance.
 * @param   orderLibAddress address of the deployed OrderLib.sol
 * @param   order      An object that confirms to the Order interface definitions.
 * @return  The resulting orderHash from hashing the supplied order.
 */
export async function createOrderHashAsync(
  provider: Provider,
  orderLibAddress: string,
  order: Order | SignedOrder
): Promise<string> {
  // below assert statement fails due to issues with BigNumber vs Number.
  // assert.isSchemaValid('Order', order, schemas.OrderSchema);
  assert.isETHAddressHex('orderLibAddress', orderLibAddress);

  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const orderLib: OrderLib = await OrderLib.createAndValidate(web3, orderLibAddress);

  return orderLib
    .createOrderHash(
      order.contractAddress,
      // orderAddresses
      [order.maker, order.taker, order.feeRecipient],
      // unsignedOrderValues
      [order.makerFee, order.takerFee, order.price, order.expirationTimestamp, order.salt],
      order.orderQty
    )
    .then(data => data)
    .catch((err: Error) => {
      const error = 'Error while creating order hash';
      console.error(err);
      return error;
    });
}

/***
 * Creates and signs a new order given the arguments provided
 * @param {Provider} provider               Web3 provider instance.
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
export async function createSignedOrderAsync(
  provider: Provider,
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
  assert.isETHAddressHex('orderLibAddress', orderLibAddress);
  assert.isETHAddressHex('contractAddress', contractAddress);

  const order: Order = {
    contractAddress: contractAddress,
    expirationTimestamp: expirationTimestamp, // '', makerAccount, 0, 1, 100000, 1, '', 0
    feeRecipient: feeRecipient,
    maker: maker,
    makerFee: makerFee,
    orderQty: orderQty,
    price: price,
    remainingQty: remainingQty,
    salt: salt,
    taker: taker,
    takerFee: takerFee
  };

  const orderHash: string | BigNumber = await createOrderHashAsync(
    provider,
    orderLibAddress,
    order
  );

  const signedOrder: SignedOrder = {
    contractAddress: contractAddress,
    expirationTimestamp: expirationTimestamp,
    feeRecipient: feeRecipient,
    maker: maker,
    makerFee: makerFee,
    orderQty: orderQty,
    price: price,
    remainingQty: remainingQty,
    salt: salt,
    taker: taker,
    takerFee: takerFee,
    ecSignature: await signOrderHashAsync(provider, String(orderHash), maker)
  };

  return signedOrder;
}

/**
 * Confirms a signed order is validly signed
 * @param provider
 * @param orderLibAddress
 * @param signedOrder
 * @param orderHash
 * @return boolean if order hash and signature resolve to maker address (signer)
 */
export async function isValidSignatureAsync(
  provider: Provider,
  orderLibAddress: string,
  signedOrder: SignedOrder,
  orderHash: string
): Promise<boolean> {
  assert.isETHAddressHex('orderLibAddress', orderLibAddress);

  const web3: Web3 = new Web3();
  web3.setProvider(provider);
  const orderLib: OrderLib = await OrderLib.createAndValidate(web3, orderLibAddress);
  return orderLib.isValidSignature(
    signedOrder.maker,
    orderHash,
    signedOrder.ecSignature.v,
    signedOrder.ecSignature.r,
    signedOrder.ecSignature.s
  );
}

/**
 * Signs an orderHash and returns it's elliptic curve signature.
 * @param   provider        Web3 provider instance.
 * @param   orderHash       Hex encoded orderHash to sign.
 * @param   signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
 *          must be available via the Provider supplied to MARKET.js.
 * @return  An object containing the Elliptic curve signature parameters generated by signing the orderHash.
 */
export async function signOrderHashAsync(
  provider: Provider,
  orderHash: string,
  signerAddress: string
): Promise<ECSignature> {
  assert.isETHAddressHex('signerAddress', signerAddress);

  const web3: Web3 = new Web3();
  web3.setProvider(provider);
  return Utils.signMessage(web3, signerAddress, orderHash);
}

/**
 * Parameters to initialize OrderInfo
 *
 */
export interface OrderInfoParams {
  txHash: string;
  blockNumber?: number;
}

/**
 * OrderInfo fetches and hold all the necessary information about an order
 * that has been posted through a market contract.
 *
 */
export class OrderInfo {
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
   * @param {OrderInfoParams} txParams transaction parameters
   */
  static create(
    marketContract: MarketContract,
    order: Order,
    txParams: OrderInfoParams
  ): OrderInfo {
    const orderInfo = new OrderInfo(marketContract, order, txParams.txHash);
    orderInfo._fromBlockNumber = txParams.blockNumber ? txParams.blockNumber : 0;
    orderInfo._toBlockNumber = txParams.blockNumber;
    return orderInfo;
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

  // endregion // Public Methods
  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************

  /**
   * Tries to fetch filledQty for this Order.
   * If nothing founds, watches for when it is found.
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
                  case OrderInfo.ORDER_EXPIRED_CODE:
                    return reject(new Error(MarketError.OrderExpired));
                  case OrderInfo.ORDER_DEAD_CODE:
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
