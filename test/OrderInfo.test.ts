import { createStubInstance, stub } from 'sinon';
import { DecodedLogEntry, IWatchFilter, MarketContract, Order } from '@marketprotocol/types';
import BigNumber from 'bignumber.js';

import { OrderInfo } from '../src/lib/Order';
import { MarketError } from '../src/types';

/**
 * OrderInfo
 */
describe('OrderInfo', () => {
  let mockContract: MarketContract;
  let stubOrder: Order;
  let orderFilledGetResult;
  let orderFilledWatchResult;
  let errorEventResult;

  beforeEach(() => {
    mockContract = createStubInstance(MarketContract);
    stubOrder = {
      maker: ''
    } as Order;
    orderFilledGetResult = Promise.resolve([]);
    orderFilledWatchResult = {};
    errorEventResult = null;

    // setup contract mocks
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

      const orderInfo = OrderInfo.create(mockContract, stubOrder, { txHash });
      const actualFilledQty = await orderInfo.filledQty;

      expect(actualFilledQty.toString()).toEqual(expectedFilledQty.toString());
    });

    // test error events
    it.each`
      errorCode                       | expectedError
      ${OrderInfo.ORDER_EXPIRED_CODE} | ${MarketError.OrderExpired}
      ${OrderInfo.ORDER_DEAD_CODE}    | ${MarketError.OrderDead}
      ${100}                          | ${MarketError.UnknownOrderError}
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

        const orderInfo = OrderInfo.create(mockContract, stubOrder, { txHash });

        await expect(orderInfo.filledQty).rejects.toThrow(expectedError);
      }
    );
  });
});
