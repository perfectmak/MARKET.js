import { BigNumber } from 'bignumber.js';
import * as Sinon from 'sinon';
import Web3 from 'web3';
import DoneCallback = jest.DoneCallback;

// Types
import { MARKETProtocolConfig } from '@marketprotocol/types';

import { Market, Utils } from '../src';
import { constants } from '../src/constants';
import { getContractAddress } from './utils';
import { ExpirationWatcher } from '../src/order_watcher/ExpirationWatcher';

describe('ExpirationWatcher', () => {
  const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
  const fees: BigNumber = new BigNumber(0);
  const config: MARKETProtocolConfig = {
    networkId: constants.NETWORK_ID_TRUFFLE
  };

  let market: Market = new Market(web3.currentProvider, config);
  let currentUnixTimestampSec: BigNumber;
  let timer: Sinon.SinonFakeTimers;
  let expirationWatcher: ExpirationWatcher;
  let orderLibAddress: string;
  let marketContractAddress: string;
  let makerAccount: string;

  beforeAll(async () => {
    orderLibAddress = getContractAddress('OrderLib', constants.NETWORK_ID_TRUFFLE);
    marketContractAddress = (await market.marketContractRegistry.getAddressWhiteList)[0];
    currentUnixTimestampSec = Utils.getCurrentUnixTimestampSec();
    makerAccount = web3.eth.accounts[1];
    jest.setTimeout(30 * 1000); // increase timeout to 30 seconds
  });

  beforeEach(async () => {
    timer = Sinon.useFakeTimers({ shouldAdvanceTime: true });
    currentUnixTimestampSec = Utils.getCurrentUnixTimestampSec();
    expirationWatcher = new ExpirationWatcher();
  });

  afterEach(async () => {
    timer.restore();
    expirationWatcher.unsubscribe();
  });

  it('correctly emits events when order expires', (done: DoneCallback) => {
    (async () => {
      const orderLifetimeSec = 60;
      const expirationUnixTimestampSec = currentUnixTimestampSec.plus(orderLifetimeSec);
      const signedOrder = await market.createSignedOrderAsync(
        orderLibAddress,
        marketContractAddress,
        expirationUnixTimestampSec,
        constants.NULL_ADDRESS,
        makerAccount,
        fees,
        constants.NULL_ADDRESS,
        fees,
        new BigNumber(100),
        new BigNumber(5000),
        new BigNumber(100),
        Utils.generatePseudoRandomSalt(),
        false
      );
      const orderHash = await market.createOrderHashAsync(orderLibAddress, signedOrder);
      expirationWatcher.addOrder(orderHash, signedOrder.expirationTimestamp.times(1000));

      const callbackAsync = (hash: string) => {
        expect(hash).toEqual(orderHash);
        expect(
          Utils.getCurrentUnixTimestampSec().isGreaterThan(expirationUnixTimestampSec)
        ).toEqual(true);
        done();
      };

      expirationWatcher.subscribe(callbackAsync);
      timer.tick(orderLifetimeSec * 1000);
    })().catch(done);
  });

  it('does not emit events before order expires', (done: DoneCallback) => {
    (async () => {
      const orderLifetimeSec = 60;
      const expirationUnixTimestampSec = currentUnixTimestampSec.plus(orderLifetimeSec);
      const signedOrder = await market.createSignedOrderAsync(
        orderLibAddress,
        marketContractAddress,
        expirationUnixTimestampSec,
        constants.NULL_ADDRESS,
        makerAccount,
        fees,
        constants.NULL_ADDRESS,
        fees,
        new BigNumber(100),
        new BigNumber(5000),
        new BigNumber(100),
        Utils.generatePseudoRandomSalt(),
        false
      );
      const orderHash = await market.createOrderHashAsync(orderLibAddress, signedOrder);
      expirationWatcher.addOrder(orderHash, signedOrder.expirationTimestamp.times(1000));

      const callbackAsync = (hash: string) => {
        done(new Error('Emitted expiration went before the order actually expired'));
      };

      expirationWatcher.subscribe(callbackAsync);
      const notEnoughTime = orderLifetimeSec - 1;
      timer.tick(notEnoughTime * 1000);
      done();
    })().catch(done);
  });

  it('emits events in correct order', (done: DoneCallback) => {
    (async () => {
      const order1Lifetime = 60;
      const order2Lifetime = 120;
      const order1ExpirationUnixTimestampSec = currentUnixTimestampSec.plus(order1Lifetime);
      const order2ExpirationUnixTimestampSec = currentUnixTimestampSec.plus(order2Lifetime);

      const signedOrder1 = await market.createSignedOrderAsync(
        orderLibAddress,
        marketContractAddress,
        order1ExpirationUnixTimestampSec,
        constants.NULL_ADDRESS,
        makerAccount,
        fees,
        constants.NULL_ADDRESS,
        fees,
        new BigNumber(100),
        new BigNumber(5000),
        new BigNumber(100),
        Utils.generatePseudoRandomSalt(),
        false
      );

      const signedOrder2 = await market.createSignedOrderAsync(
        orderLibAddress,
        marketContractAddress,
        order2ExpirationUnixTimestampSec,
        constants.NULL_ADDRESS,
        makerAccount,
        fees,
        constants.NULL_ADDRESS,
        fees,
        new BigNumber(100),
        new BigNumber(5000),
        new BigNumber(100),
        Utils.generatePseudoRandomSalt(),
        false
      );

      const orderHash1 = await market.createOrderHashAsync(orderLibAddress, signedOrder1);
      const orderHash2 = await market.createOrderHashAsync(orderLibAddress, signedOrder2);

      expirationWatcher.addOrder(orderHash2, signedOrder2.expirationTimestamp.times(1000));
      expirationWatcher.addOrder(orderHash1, signedOrder1.expirationTimestamp.times(1000));

      const expirationOrder = [orderHash1, orderHash2];
      const callbackAsync = (hash: string) => {
        const orderHash = expirationOrder.shift();
        expect(hash).toEqual(orderHash);
        if (expirationOrder.length === 0) {
          done();
        }
      };
      expirationWatcher.subscribe(callbackAsync);
      timer.tick(order2Lifetime * 1000);
    })().catch(done);
  });
});
