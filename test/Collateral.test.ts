import { BigNumber } from 'bignumber.js';
import Web3 from 'web3';

// Types
import { MarketContract, MathLib } from '@marketprotocol/types';

import { Market } from '../src';
import { constants } from '../src/constants';

import {
  depositCollateralAsync,
  getUserAccountBalanceAsync,
  settleAndCloseAsync,
  withdrawCollateralAsync
} from '../src/lib/Collateral';
import { MARKETProtocolConfig } from '../src/types';

/**
 * Collateral
 */
describe('Collateral', () => {
  const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
  let maker: string;
  let contractAddresses: string[];
  let marketContractAddress: string;
  let deployedMarketContract: MarketContract;
  let collateralPoolAddress: string;
  let collateralTokenAddress: string;
  let market: Market;

  beforeAll(async () => {
    maker = web3.eth.accounts[0];
    const config: MARKETProtocolConfig = {
      networkId: constants.NETWORK_ID_TRUFFLE
    };
    market = new Market(web3.currentProvider, config);
    contractAddresses = await market.marketContractRegistry.getAddressWhiteList;
    marketContractAddress = contractAddresses[0];
    deployedMarketContract = await MarketContract.createAndValidate(web3, marketContractAddress);
    collateralPoolAddress = await deployedMarketContract.MARKET_COLLATERAL_POOL_ADDRESS;
    collateralTokenAddress = await deployedMarketContract.COLLATERAL_TOKEN_ADDRESS;

    const tokenBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      maker
    );

    await market.erc20TokenContractWrapper.setAllowanceAsync(
      collateralTokenAddress,
      collateralPoolAddress,
      tokenBalance,
      { from: maker }
    );
  });

  it('depositCollateralAsync should fail for deposits above approved amount', async () => {
    const approvedAmount: BigNumber = await market.erc20TokenContractWrapper.getAllowanceAsync(
      collateralTokenAddress,
      maker,
      collateralPoolAddress
    );
    const depositAmount = approvedAmount.plus(10); // aboue approved amount

    const oldBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      collateralPoolAddress
    );

    await expect(
      depositCollateralAsync(web3.currentProvider, collateralPoolAddress, depositAmount, {
        from: maker
      })
    ).rejects.toThrow();

    const newBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      collateralPoolAddress
    );

    expect(newBalance).toEqual(oldBalance);
  });

  it('Balance after depositCollateralAsync call is correct', async () => {
    const depositAmount: BigNumber = new BigNumber(10);
    const oldBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      collateralPoolAddress
    );

    await depositCollateralAsync(web3.currentProvider, collateralPoolAddress, depositAmount, {
      from: maker
    });

    const newBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      collateralPoolAddress
    );

    expect(newBalance.minus(oldBalance)).toEqual(depositAmount);
  });

  it('getUserAccountBalanceAsync returns correct user balance', async () => {
    const oldUserBalance: BigNumber = await getUserAccountBalanceAsync(
      web3.currentProvider,
      collateralPoolAddress,
      maker
    );

    const depositAmount: BigNumber = new BigNumber(100);
    await depositCollateralAsync(web3.currentProvider, collateralPoolAddress, depositAmount, {
      from: maker
    });
    const newUserBalance: BigNumber = await getUserAccountBalanceAsync(
      web3.currentProvider,
      collateralPoolAddress,
      maker
    );
    expect(newUserBalance.minus(oldUserBalance)).toEqual(depositAmount);
  });

  it('withdrawCollateralAsync should withdraw correct amount', async () => {
    const withdrawAmount: BigNumber = new BigNumber(10);
    const depositAmount: BigNumber = new BigNumber(100);
    await depositCollateralAsync(web3.currentProvider, collateralPoolAddress, depositAmount, {
      from: maker
    });

    const oldBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      maker
    );

    await withdrawCollateralAsync(web3.currentProvider, collateralPoolAddress, withdrawAmount, {
      from: maker
    });
    const newBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      maker
    );

    expect(oldBalance.plus(withdrawAmount)).toEqual(newBalance);
  });

  it('Settle and Close should fail', async () => {
    try {
      await settleAndCloseAsync(web3.currentProvider, collateralPoolAddress, { from: maker });
    } catch (e) {
      expect(e.toString()).toMatch('revert');
    }
  });

  it('Calculates needed collateral correctly', async () => {
    expect(market.config.mathLibAddress).toBeDefined();
    if (!market.config.mathLibAddress) {
      return new Error('Expected mathLibAddress to be defined!');
    }
    const mathLib: MathLib = await MathLib.createAndValidate(web3, market.config.mathLibAddress);

    // in these tests we can compare the calculated amounts in MARKET.js with the calculated
    // amounts from the MathLib solidity contract.

    let longQtyToExecute = new BigNumber(5);
    let shortQtyToExecute = new BigNumber(-5);
    let priceToExecute = (await deployedMarketContract.PRICE_FLOOR).plus(5000);

    let longCalculatedCollateral = await market.calculateNeededCollateralAsync(
      marketContractAddress,
      longQtyToExecute,
      priceToExecute
    );

    let solidityLongCalculatedCollateral = await mathLib.calculateNeededCollateral(
      await deployedMarketContract.PRICE_FLOOR,
      await deployedMarketContract.PRICE_CAP,
      await deployedMarketContract.QTY_MULTIPLIER,
      longQtyToExecute,
      priceToExecute
    );

    expect(longCalculatedCollateral).toEqual(solidityLongCalculatedCollateral);

    let shortCalculatedCollateral = await market.calculateNeededCollateralAsync(
      marketContractAddress,
      shortQtyToExecute,
      priceToExecute
    );

    let solidityShortCalculatedCollateral = await mathLib.calculateNeededCollateral(
      await deployedMarketContract.PRICE_FLOOR,
      await deployedMarketContract.PRICE_CAP,
      await deployedMarketContract.QTY_MULTIPLIER,
      shortQtyToExecute,
      priceToExecute
    );

    expect(shortCalculatedCollateral).toEqual(solidityShortCalculatedCollateral);
  });
});
