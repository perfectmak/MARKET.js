import Web3 from 'web3';
import BigNumber from 'bignumber.js';
// Types
import { ERC20, MarketCollateralPool, MarketContract, SignedOrder } from '@marketprotocol/types';

import { Market, Utils } from '../src';
import { constants } from '../src/constants';

import { createOrderHashAsync, createSignedOrderAsync } from '../src/lib/Order';

import { OrderFilledCancelledLazyStore } from '../src/OrderFilledCancelledLazyStore';
import { JSONRPCResponsePayload } from '@0xproject/types';
import { MARKETProtocolConfig } from '../src/types';
import { createEVMSnapshot, restoreEVMSnapshot } from './utils';

describe('Order filled/cancelled store', async () => {
  let web3: Web3;
  let config: MARKETProtocolConfig;
  let market: Market;
  let orderLibAddress: string;
  let contractAddresses: string[];
  let contractAddress: string;
  let deploymentAddress: string;
  let maker: string;
  let taker: string;
  let deployedMarketContract: MarketContract;
  let collateralTokenAddress: string;
  let collateralToken: ERC20;
  let collateralPoolAddress: string;
  let collateralPool;
  let initialCredit: BigNumber;
  let fees: BigNumber;
  let orderQty: BigNumber;
  let price: BigNumber;
  let snapshotId: string;
  let signedOrder: SignedOrder;

  beforeAll(async () => {
    jest.setTimeout(30000);
    web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
    config = { networkId: constants.NETWORK_ID_TRUFFLE };
    market = new Market(web3.currentProvider, config);
    orderLibAddress = market.orderLib.address;
    contractAddresses = await market.marketContractRegistry.getAddressWhiteList;
    contractAddress = contractAddresses[0];
    deploymentAddress = web3.eth.accounts[0];
    maker = web3.eth.accounts[3];
    taker = web3.eth.accounts[4];
    deployedMarketContract = await MarketContract.createAndValidate(web3, contractAddress);
    collateralTokenAddress = await deployedMarketContract.COLLATERAL_TOKEN_ADDRESS;
    collateralToken = await ERC20.createAndValidate(web3, collateralTokenAddress);
    collateralPoolAddress = await deployedMarketContract.MARKET_COLLATERAL_POOL_ADDRESS;
    collateralPool = await MarketCollateralPool.createAndValidate(web3, collateralPoolAddress);
    initialCredit = new BigNumber(1e23);
    orderQty = new BigNumber(100);
    price = new BigNumber(100000);
    fees = new BigNumber(0);
    let makerCollateral = await market.getUserAccountBalanceAsync(contractAddress, maker);
    let takerCollateral = await market.getUserAccountBalanceAsync(contractAddress, taker);
    await market.withdrawCollateralAsync(contractAddress, makerCollateral, {
      from: maker
    });
    await market.withdrawCollateralAsync(contractAddress, takerCollateral, {
      from: taker
    });
    signedOrder = await market.createSignedOrderAsync(
      orderLibAddress,
      contractAddress,
      new BigNumber(Math.floor(Date.now() / 1000) + 60 * 60),
      constants.NULL_ADDRESS,
      maker,
      fees,
      constants.NULL_ADDRESS,
      fees,
      orderQty,
      price,
      orderQty,
      Utils.generatePseudoRandomSalt()
    );
  });

  beforeEach(async () => {
    // get a snapshot of the current state of the local blockchain
    snapshotId = await createEVMSnapshot(web3);
    await collateralToken.transferTx(maker, initialCredit).send({ from: deploymentAddress });
    await collateralToken.approveTx(collateralPoolAddress, initialCredit).send({ from: maker });
    await market.depositCollateralAsync(
      contractAddress,
      initialCredit,
      {
        from: maker
      }
    );
    await collateralToken.transferTx(taker, initialCredit).send({ from: deploymentAddress });
    await collateralToken.approveTx(collateralPoolAddress, initialCredit).send({ from: taker });
    await market.depositCollateralAsync(
      contractAddress,
      initialCredit,
      {
        from: taker
      }
    );
  });

  afterEach(async () => {
    // revert the local blockchain to the state before the test occurred in order to clean up
    // the environment for further testing.
    await restoreEVMSnapshot(web3, snapshotId);
  });

  it('Returns the uncached quantity', async () => {
    const tradeQty = new BigNumber(2);
    await market.tradeOrderAsync(signedOrder, new BigNumber(tradeQty), {
      from: taker,
      gas: 400000
    });

    const orderHash = await createOrderHashAsync(
      web3.currentProvider,
      orderLibAddress,
      signedOrder
    );
    const store = new OrderFilledCancelledLazyStore(market.marketContractWrapper);

    const qty = await store.getQtyFilledOrCancelledAsync(deployedMarketContract.address, orderHash);

    expect(qty).toEqual(tradeQty);
  });

  it('Returns the cached quantity', async () => {
    const tradeQty = new BigNumber(2);
    await market.tradeOrderAsync(signedOrder, new BigNumber(tradeQty), {
      from: taker,
      gas: 400000
    });

    const orderHash = await createOrderHashAsync(
      web3.currentProvider,
      orderLibAddress,
      signedOrder
    );
    const store = new OrderFilledCancelledLazyStore(market.marketContractWrapper);

    await store.getQtyFilledOrCancelledAsync(deployedMarketContract.address, orderHash);
    const qty = await store.getQtyFilledOrCancelledAsync(deployedMarketContract.address, orderHash);

    expect(qty).toEqual(tradeQty);
  });
});
