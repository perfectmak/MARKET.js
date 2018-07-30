import BigNumber from 'bignumber.js';
import Web3 from 'web3';

// Types
import { Provider } from '@0xproject/types';
import {
  ITxParams,
  MarketCollateralPoolFactory,
  MarketContractFactoryOraclize
} from '@marketprotocol/types';

/**
 * Calls our factory to create a new MarketCollateralPool that is then linked to the supplied
 * marketContractAddress.
 * @param {Provider} provider
 * @param {MarketCollateralPoolFactory} marketCollateralPoolFactory
 * @param {string} marketContractAddress
 * @param {ITxParams} txParams
 * @returns {Promise<string>}                   transaction has of pending deployment.
 */
export async function deployMarketCollateralPoolAsync(
  provider: Provider,
  marketCollateralPoolFactory: MarketCollateralPoolFactory,
  marketContractAddress: string,
  txParams: ITxParams = {}
): Promise<string> {
  return marketCollateralPoolFactory
    .deployMarketCollateralPoolTx(marketContractAddress)
    .send(txParams);
}

/**
 * calls our factory that deploys a MarketContractOraclize and then adds it to
 * the MarketContractRegistry.
 * @param {MarketContractFactoryOraclize} marketContractFactory
 * @param {string} contractName
 * @param {string} collateralTokenAddress
 * @param {BigNumber[]} contractSpecs
 * @param {string} oracleDataSource
 * @param {string} oracleQuery
 * @param {ITxParams} txParams
 * @returns {Promise<string>}         transaction hash of pending transaction.
 */
export async function deployMarketContractOraclizeAsync(
  marketContractFactory: MarketContractFactoryOraclize,
  contractName: string,
  collateralTokenAddress: string,
  contractSpecs: BigNumber[], // not sure why this is a big number from the typedefs?
  oracleDataSource: string,
  oracleQuery: string,
  txParams: ITxParams = {}
): Promise<string> {
  return marketContractFactory
    .deployMarketContractOraclizeTx(
      contractName,
      collateralTokenAddress,
      contractSpecs,
      oracleDataSource,
      oracleQuery
    )
    .send(txParams);
}

/**
 * Watches for the MarketContractCreatedEvent and attempts to return the new address of the
 * market contract created in the supplied tx Hash.
 * @param marketContractFactory
 * @param from
 * @param txHash
 * @param fromBlock
 */
export async function getDeployedMarketContractAddressFromTxHash(
  marketContractFactory: MarketContractFactoryOraclize,
  from: string,
  txHash: string,
  fromBlock: number
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stopEventWatcher = marketContractFactory
      .MarketContractCreatedEvent({ creator: from }) // filter based on creator
      .watch({ fromBlock: fromBlock }, (err, eventLog) => {
        // Validate this tx hash matches the tx we just created above.
        if (err) {
          console.log(err);
          return Promise.reject(err);
        }

        if (eventLog.transactionHash === txHash) {
          stopEventWatcher()
            .then(function() {
              return resolve(String(eventLog.args.contractAddress));
            })
            .catch(reject);
        }
      });
  });
}
