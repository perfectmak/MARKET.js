import { createStubInstance, stub } from 'sinon';
import { IWatchFilter, MarketContract, Order } from '@marketprotocol/types';
import BigNumber from 'bignumber.js';

import { OrderTransactionInfo } from '../src/lib/OrderTransactionInfo';
import { MarketError } from '../src/types';

/**
 * Test OrderTransactionInfo
 */
describe('OrderTransactionInfo', () => {
  let mockContract: MarketContract;
  let stubOrder: Order;
  let orderFilledGetResult;
  let orderFilledWatchResult;
  let orderCancelledGetResult;
  let orderCancelledWatchResult;
  let errorEventResult;

  function stubMarketContractEvents() {
    mockContract.ErrorEvent = stub().returns({
      watch(_: IWatchFilter, cb: (err: Error, event: {}) => void): () => Promise<void> {
        setTimeout(() => {
          if (errorEventResult) {
            cb(null, errorEventResult);
          }
        }, 100);

        return () => Promise.resolve();
      }
    });

    mockContract.OrderFilledEvent = stub().returns({
      get() {
        return orderFilledGetResult;
      },

      watch(_: IWatchFilter, cb: (err: Error, event: {}) => void): () => Promise<void> {
        setTimeout(() => {
          if (orderFilledWatchResult) {
            cb(null, orderFilledWatchResult);
          }
        }, 100);

        return () => Promise.resolve();
      }
    });

    mockContract.OrderCancelledEvent = stub().returns({
      get() {
        return orderCancelledGetResult;
      },

      watch(_: IWatchFilter, cb: (err: Error, event: {}) => void): () => Promise<void> {
        setTimeout(() => {
          if (orderCancelledWatchResult) {
            cb(null, orderCancelledWatchResult);
          }
        }, 100);

        return () => Promise.resolve();
      }
    });
  }

  beforeEach(() => {
    mockContract = createStubInstance(MarketContract);
    stubOrder = {
      maker: ''
    } as Order;
    orderFilledGetResult = Promise.resolve([]);
    orderFilledWatchResult = {};
    orderCancelledGetResult = Promise.resolve([]);
    orderCancelledWatchResult = {};
    errorEventResult = null;

    // setup contract mocks
    stubMarketContractEvents();
  });

  describe('get filledQty', () => {
    it('should watch for event if not already broadcasted', async () => {
      const txHash = '0x0000000';
      const expectedFilledQty = new BigNumber(2);
      orderFilledWatchResult = {
        transactionHash: txHash,
        args: {
          filledQty: expectedFilledQty
        }
      };

      const orderTxInfo = OrderTransactionInfo.create(mockContract, stubOrder, { txHash });
      const actualFilledQty = await orderTxInfo.filledQty;

      expect(actualFilledQty.toString()).toEqual(expectedFilledQty.toString());
    });

    // test error events
    it.each`
      errorCode                                  | expectedError
      ${OrderTransactionInfo.ORDER_EXPIRED_CODE} | ${MarketError.OrderExpired}
      ${OrderTransactionInfo.ORDER_DEAD_CODE}    | ${MarketError.OrderDead}
      ${100}                                     | ${MarketError.UnknownOrderError}
    `(
      'should throw $expectedError for a $errorCode ErrorEvent',
      async ({ errorCode, expectedError }) => {
        const txHash = '0x0000000';
        orderFilledWatchResult = null;
        errorEventResult = {
          transactionHash: txHash,
          args: {
            errorCode: parseInt(errorCode, 10)
          }
        };

        const orderTxInfo = OrderTransactionInfo.create(mockContract, stubOrder, { txHash });

        await expect(orderTxInfo.filledQty).rejects.toThrow(expectedError);
      }
    );
  });

  describe('get cancelledQty', () => {
    it('should watch for event if not already broadcasted', async () => {
      const txHash = '0x0000000';
      const expectedCancelledQty = new BigNumber(2);
      orderCancelledWatchResult = {
        transactionHash: txHash,
        args: {
          cancelledQty: expectedCancelledQty
        }
      };

      const orderTxInfo = OrderTransactionInfo.create(mockContract, stubOrder, { txHash });
      const actualCancelledQty = await orderTxInfo.cancelledQty;

      expect(actualCancelledQty.toString()).toEqual(expectedCancelledQty.toString());
    });

    // test error events
    it.each`
      errorCode                                  | expectedError
      ${OrderTransactionInfo.ORDER_EXPIRED_CODE} | ${MarketError.OrderExpired}
      ${OrderTransactionInfo.ORDER_DEAD_CODE}    | ${MarketError.OrderDead}
      ${100}                                     | ${MarketError.UnknownOrderError}
    `(
      'should throw $expectedError for a $errorCode ErrorEvent',
      async ({ errorCode, expectedError }) => {
        const txHash = '0x0000000';
        orderFilledWatchResult = null;
        errorEventResult = {
          transactionHash: txHash,
          args: {
            errorCode: parseInt(errorCode, 10)
          }
        };

        const orderTxInfo = OrderTransactionInfo.create(mockContract, stubOrder, { txHash });

        await expect(orderTxInfo.cancelledQty).rejects.toThrow(expectedError);
      }
    );
  });
});
