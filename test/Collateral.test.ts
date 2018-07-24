import { BigNumber } from 'bignumber.js';
import Web3 from 'web3';
// Types
import { ERC20, MarketContract, MathLib } from '@marketprotocol/types';

import { Market } from '../src';
import { constants } from '../src/constants';

import { MarketError, MARKETProtocolConfig } from '../src/types';
import { createEVMSnapshot, restoreEVMSnapshot } from './utils';

/**
 * Collateral
 */
describe('Collateral', () => {
  const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
  let maker: string;
  let deploymentAddress: string;
  let contractAddresses: string[];
  let marketContractAddress: string;
  let deployedMarketContract: MarketContract;
  let collateralPoolAddress: string;
  let collateralTokenAddress: string;
  let market: Market;

  beforeAll(async () => {
    maker = deploymentAddress = web3.eth.accounts[0];
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
      market.depositCollateralAsync(marketContractAddress, depositAmount, {
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

    await market.depositCollateralAsync(
      marketContractAddress,
      depositAmount,
      { from: maker }
    );

    const newBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      collateralPoolAddress
    );

    expect(newBalance.minus(oldBalance)).toEqual(depositAmount);
  });

  it('getUserAccountBalanceAsync returns correct user balance', async () => {
    const oldUserBalance: BigNumber = await market.getUserAccountBalanceAsync(
      marketContractAddress,
      maker
    );

    const depositAmount: BigNumber = new BigNumber(100);
    await market.depositCollateralAsync(
      marketContractAddress,
      depositAmount,
      { from: maker }
    );
    const newUserBalance: BigNumber = await market.getUserAccountBalanceAsync(
      marketContractAddress,
      maker
    );
    expect(newUserBalance.minus(oldUserBalance)).toEqual(depositAmount);
  });

  it('withdrawCollateralAsync should withdraw correct amount', async () => {
    const withdrawAmount: BigNumber = new BigNumber(10);
    const depositAmount: BigNumber = new BigNumber(100);
    await market.depositCollateralAsync(
      marketContractAddress,
      depositAmount,
      { from: maker }
    );

    const oldBalance: BigNumber = await market.erc20TokenContractWrapper.getBalanceAsync(
      collateralTokenAddress,
      maker
    );

    await market.withdrawCollateralAsync(marketContractAddress, withdrawAmount, {
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
      await market.settleAndCloseAsync(marketContractAddress, { from: maker });
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

  it('Ensure user is enabled for contract', async () => {
    // Not currently possible until there's a lock required for trading.
    // Todo: add user (which by default won't have any market tokens locked)
    // and attempt to deposit collateral.
  });

  it('Ensure caller has sufficient ERC20 token balance to deposit', async () => {
    // Create mock account (which by default won't have any balance),
    // then attempt to make a deposit which should throw InsufficientBalanceForTransfer.
    const mockAccountAddress: string = web3.personal.newAccount('mockAccount');
    const depositAmount: BigNumber = new BigNumber(100);
    expect(
      market.depositCollateralAsync(marketContractAddress, depositAmount, {
        from: mockAccountAddress
      })
    ).rejects.toThrow(new Error(MarketError.InsufficientBalanceForTransfer));
  });

  it('Ensure caller has approved deposit for sufficient amount', async () => {
    // Use user account (which by default won't have any balance or allowance),
    // send the user a balance but don't approve the transaction,
    // then try to make a deposit which should throw InsufficientAllowanceForTransfer.

    const user = web3.eth.accounts[1];
    const collateralToken: ERC20 = await ERC20.createAndValidate(web3, collateralTokenAddress);
    const initialCredit: BigNumber = new BigNumber(1e23);

    await collateralToken.transferTx(user, initialCredit).send({ from: deploymentAddress });

    expect(
      market.depositCollateralAsync(marketContractAddress, initialCredit, {
        from: user
      })
    ).rejects.toThrow(new Error(MarketError.InsufficientAllowanceForTransfer));
  });

  it('Ensure user has sufficient balance in the pool to withdraw', async () => {
    // Create mock account (which by default won't have any balance),
    // then attempt to make a withdraw which should throw InsufficientBalanceForTransfer.
    const mockAccountAddress: string = web3.personal.newAccount('mockAccount');
    const withdrawAmount: BigNumber = new BigNumber(100);
    expect(
      market.withdrawCollateralAsync(marketContractAddress, withdrawAmount, {
        from: mockAccountAddress
      })
    ).rejects.toThrow(new Error(MarketError.InsufficientBalanceForTransfer));
  });

  describe('getCollateralEventsAsync', () => {
    const depositAmount: BigNumber = new BigNumber(100);
    let snapshotId: string;

    beforeAll(async () => {
      snapshotId = await createEVMSnapshot(web3);
      await market.depositCollateralAsync(
        marketContractAddress,
        depositAmount,
        { from: maker }
      );
    });

    afterAll(async () => {
      await restoreEVMSnapshot(web3, snapshotId);
    });

    it('returns the deposit', async () => {
      const events = await market.getCollateralEventsAsync(marketContractAddress);
      const includes: boolean = events.some((e): boolean => {
        if (
          depositAmount.isEqualTo(e.amount) &&
          e.to === collateralPoolAddress &&
          e.type === 'deposit' &&
          e.from === maker
        ) {
          return true;
        }
        return false;
      });
      expect(includes).toBe(true);
    });

    it('does not returns the deposit if not in the given block range', async () => {
      const events = await market.getCollateralEventsAsync(marketContractAddress, 0, 1);
      const includes: boolean = events.some((e): boolean => {
        if (
          depositAmount.isEqualTo(e.amount) &&
          e.to === collateralPoolAddress &&
          e.type === 'deposit' &&
          e.from === maker
        ) {
          return true;
        }
        return false;
      });
      expect(includes).toBe(false);
    });

    it('returns the deposit matching userAddress', async () => {
      const events = await market.getCollateralEventsAsync(marketContractAddress, 0, 'latest', maker);
      const includes: boolean = events.some((e): boolean => {
        if (
          depositAmount.isEqualTo(e.amount) &&
          e.to === collateralPoolAddress &&
          e.type === 'deposit' &&
          e.from === maker
        ) {
          return true;
        }
        return false;
      });
      expect(includes).toBe(true);
    });

    it('does not returns the deposit if it does not match userAddress', async () => {
      const events = await market.getCollateralEventsAsync(marketContractAddress, 0, 'latest', '0x0');
      const includes: boolean = events.some((e): boolean => {
        if (
          depositAmount.isEqualTo(e.amount) &&
          e.to === collateralPoolAddress &&
          e.type === 'deposit' &&
          e.from === maker
        ) {
          return true;
        }
        return false;
      });
      expect(includes).toBe(false);
    });

    it('returns a withdrawal', async () => {
      await market.withdrawCollateralAsync(marketContractAddress, depositAmount, {
        from: maker
      });
      const events = await market.getCollateralEventsAsync(marketContractAddress);
      const includes: boolean = events.some((e): boolean => {
        if (
          depositAmount.isEqualTo(e.amount) &&
          e.to === maker &&
          e.type === 'withdrawal' &&
          e.from === collateralPoolAddress
        ) {
          return true;
        }
        return false;
      });
      expect(includes).toBe(true);
    });
  });
});
