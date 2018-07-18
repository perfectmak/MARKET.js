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
 * @returns {Promise<string>}                   transaction has of successful deployment.
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
 * @param {Provider} provider                     Web3 provider instance.
 * @param {MarketContractFactoryOraclize} marketContractFactory
 * @param {string} contractName
 * @param {string} collateralTokenAddress
 * @param {BigNumber[]} contractSpecs
 * @param {string} oracleDataSource
 * @param {string} oracleQuery
 * @param {ITxParams} txParams
 * @returns {Promise<string | BigNumber>}         deployed address of the new Market Contract.
 */
export async function deployMarketContractOraclizeAsync(
  provider: Provider,
  marketContractFactory: MarketContractFactoryOraclize,
  contractName: string,
  collateralTokenAddress: string,
  contractSpecs: BigNumber[], // not sure why this is a big number from the typedefs?
  oracleDataSource: string,
  oracleQuery: string,
  txParams: ITxParams = {}
): Promise<string | BigNumber> {
  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const txHash = await marketContractFactory
    .deployMarketContractOraclizeTx(
      contractName,
      collateralTokenAddress,
      contractSpecs,
      oracleDataSource,
      oracleQuery
    )
    .send(txParams);

  const blockNumber: number = Number(web3.eth.getTransaction(txHash).blockNumber);

  return new Promise<string | BigNumber>((resolve, reject) => {
    const stopEventWatcher = marketContractFactory
      .MarketContractCreatedEvent({ creator: txParams.from }) // filter based on creator
      .watch({ fromBlock: blockNumber, toBlock: blockNumber }, (err, eventLog) => {
        // Validate this tx hash matches the tx we just created above.
        if (err) {
          console.log(err);
        }

        if (eventLog.transactionHash === txHash) {
          stopEventWatcher()
            .then(function() {
              return resolve(eventLog.args.contractAddress);
            })
            .catch(reject);
        }
      });
  });
}
