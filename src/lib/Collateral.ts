import BigNumber from 'bignumber.js';
import Web3 from 'web3';

// Types
import { Provider, Transaction } from '@0xproject/types';
import {
  CollateralToken,
  ITxParams,
  MarketCollateralPool,
  MarketToken
} from '@marketprotocol/types';
import { MarketError } from '../types';
import { ERC20TokenContractWrapper } from '../contract_wrappers/ERC20TokenContractWrapper';

const Decoder = require('ethereum-input-data-decoder');

/**
 * deposits collateral to a traders account for a given contract address.
 * @param {Provider} provider                       Web3 provider instance.
 * @param {MarketToken} mktTokenContract            MarketToken contract
 * @param {string} collateralPoolContractAddress    address of the MarketCollateralPool
 * @param {string} collateralTokenAddress           Address of the CollateralToken
 * @param {BigNumber | number} depositAmount        amount of ERC20 collateral to deposit
 * @param {ITxParams} txParams                      transaction parameters
 * @returns {Promise<string>}                      The transaction hash
 */
export async function depositCollateralAsync(
  provider: Provider,
  mktTokenContract: MarketToken,
  collateralPoolContractAddress: string,
  collateralTokenAddress: string,
  depositAmount: BigNumber | number,
  txParams: ITxParams = {}
): Promise<string> {
  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const collateralPool: MarketCollateralPool = new MarketCollateralPool(
    web3,
    collateralPoolContractAddress
  );

  const collateralToken: CollateralToken = new CollateralToken(web3, collateralTokenAddress);

  // Ensure caller is enabled for contract
  const caller: string = String(txParams.from);
  const isUserEnabled = await mktTokenContract.isUserEnabledForContract(
    mktTokenContract.address,
    caller
  );
  if (!isUserEnabled) {
    return Promise.reject<string>(new Error(MarketError.UserNotEnabledForContract));
  }

  // Ensure caller has sufficient collateral token balance
  const erc20ContractWrapper: ERC20TokenContractWrapper = new ERC20TokenContractWrapper(web3);
  const callerCollateralTokenBalance: BigNumber = new BigNumber(
    await erc20ContractWrapper.getBalanceAsync(collateralToken.address, caller)
  );
  if (callerCollateralTokenBalance.isLessThan(depositAmount)) {
    return Promise.reject<string>(new Error(MarketError.InsufficientBalanceForTransfer));
  }

  // Ensure caller has approved sufficient amount
  const callerAllowance: BigNumber = new BigNumber(
    await erc20ContractWrapper.getAllowanceAsync(
      collateralToken.address,
      caller,
      collateralPool.address
    )
  );
  if (callerAllowance.isLessThan(depositAmount)) {
    return Promise.reject<string>(new Error(MarketError.InsufficientAllowanceForTransfer));
  }

  return collateralPool.depositTokensForTradingTx(depositAmount).send(txParams);
}

/**
 * Gets the user's currently unallocated token balance
 * @param {Provider} provider                       Web3 provider instance.
 * @param {string} collateralPoolContractAddress    address of the MarketCollateralPool
 * @param {BigNumber | string} userAddress          address of user
 * @returns {Promise<BigNumber>}               the user's currently unallocated token balance
 */
export async function getUserAccountBalanceAsync(
  provider: Provider,
  collateralPoolContractAddress: string,
  userAddress: string
): Promise<BigNumber> {
  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  // Get the MarketCollateralPool contract
  const collateralPool: MarketCollateralPool = new MarketCollateralPool(
    web3,
    collateralPoolContractAddress
  );

  try {
    // Retrieve the user's unallocated token balance
    const userUnallocatedTokenBalance = await collateralPool.getUserAccountBalance(userAddress);
    console.log(`${userAddress} unallocated token balance is ${userUnallocatedTokenBalance}`);
    return userUnallocatedTokenBalance;
  } catch (error) {
    console.log(error);
    return new BigNumber(NaN);
  }
}

/**
 * close all open positions post settlement and withdraws all collateral from a expired contract
 * @param {Provider} provider                       Web3 provider instance.
 * @param {string} collateralPoolContractAddress    address of the MarketCollateralPool
 * @param {ITxParams} txParams                      transaction parameters
 * @returns {Promise<string>}                       The transaction hash
 */
export async function settleAndCloseAsync(
  provider: Provider,
  collateralPoolContractAddress: string,
  txParams: ITxParams = {}
): Promise<string> {
  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const collateralPool: MarketCollateralPool = new MarketCollateralPool(
    web3,
    collateralPoolContractAddress
  );
  return collateralPool.settleAndCloseTx().send(txParams);
}

/**
 * withdraws collateral from a traders account back to their own address.
 * @param {Provider} provider                       Web3 provider instance.
 * @param {string} collateralPoolContractAddress    address of the MarketCollateralPool
 * @param {BigNumber | number} withdrawAmount        amount of ERC20 collateral to withdraw
 * @param {ITxParams} txParams                      transaction parameters
 * @returns {Promise<string>}                       The transaction hash.
 */
export async function withdrawCollateralAsync(
  provider: Provider,
  collateralPoolContractAddress: string,
  withdrawAmount: BigNumber | number,
  txParams: ITxParams = {}
): Promise<string> {
  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const collateralPool: MarketCollateralPool = new MarketCollateralPool(
    web3,
    collateralPoolContractAddress
  );

  // Ensure caller has sufficient collateral pool balance
  const caller: string = String(txParams.from);
  const balance = new BigNumber(await collateralPool.getUserAccountBalance(caller));
  if (balance.isLessThan(withdrawAmount)) {
    return Promise.reject<string>(new Error(MarketError.InsufficientBalanceForTransfer));
  }
  return collateralPool.withdrawTokensTx(withdrawAmount).send(txParams);
}

export interface CollateralEvent {
  type: string;
  from: string | null;
  to: string | null;
  amount: BigNumber;
  blockNumber: number | null;
  txHash: string;
}

/**
 * Gets the history of deposits and withdrawals for a given collateral pool address.
 * @param {Provider} provider                       Web3 provider instance.
 * @param {string} collateralPoolContractAddress    address of the MarketCollateralPool
 * @param {string} fromBlock                        from block #
 * @param {string} toBlock                          to block #
 * @param {string} userAddress                      only search for deposits/withdrawals to/from a specified address
 * @returns {Promise<CollateralEvent[]>}
 */
export async function getCollateralEventsAsync(
  provider: Provider,
  collateralPoolContractAddress: string,
  fromBlock: number | string = '0x0',
  toBlock: number | string = 'latest',
  userAddress: string | null = null
): Promise<CollateralEvent[]> {
  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const collateralPool: MarketCollateralPool = new MarketCollateralPool(
    web3,
    collateralPoolContractAddress
  );

  let collateralEvents: CollateralEvent[] = [];

  const logs = await collateralPool.UpdatedUserBalanceEvent({}).get({
    fromBlock: fromBlock,
    toBlock: toBlock
  });
  for (let e of logs) {
    const transaction = await new Promise<Transaction>((resolve, reject) => {
      web3.eth.getTransaction(e.transactionHash, (err: Error, tx: Transaction) => {
        if (err) {
          reject(err);
        }
        resolve(tx);
      });
    });
    const decoder = new Decoder(collateralPool.contractAbi);
    const input = decoder.decodeData(transaction.input);
    const event: CollateralEvent = {
      type: input.name === 'depositTokensForTrading' ? 'deposit' : 'withdrawal',
      from: input.name === 'depositTokensForTrading' ? transaction.from : transaction.to,
      to: input.name === 'depositTokensForTrading' ? transaction.to : transaction.from,
      amount: input.inputs[0],
      blockNumber: transaction.blockNumber,
      txHash: transaction.hash
    };
    if (!userAddress) {
      collateralEvents.push(event);
    }
    if (userAddress === transaction.from || userAddress === transaction.to) {
      collateralEvents.push(event);
    }
  }
  return collateralEvents;
}
