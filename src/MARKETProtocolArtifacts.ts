import { join } from 'path';
import { Artifact } from '@marketprotocol/types';
import { constants } from './constants';
import { Utils } from './lib/Utils';

/* tslint:disable */
const MarketCollateralPoolFactory = require("@marketprotocol/abis/build/contracts/MarketCollateralPoolFactory.json");
const MarketContractFactoryOraclize = require("@marketprotocol/abis/build/contracts/MarketContractFactoryOraclize.json");
const MarketContractRegistry = require("@marketprotocol/abis/build/contracts/MarketContractRegistry.json");
const MarketToken = require("@marketprotocol/abis/build/contracts/MarketToken.json");
const MathLib = require("@marketprotocol/abis/build/contracts/MathLib.json");
const OrderLib = require("@marketprotocol/abis/build/contracts/OrderLib.json");
/* tslint:enable */

/**
 * Contains artifacts from solidity deployments
 */
export class MARKETProtocolArtifacts {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  public orderLibArtifact: Artifact;
  public mathLibArtifact: Artifact;
  public marketTokenArtifact: Artifact;
  public marketContractRegistryArtifact: Artifact;
  public marketContractFactoryOraclizeArtifact: Artifact;
  public marketCollateralPoolFactoryArtifact: Artifact;
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  constructor(networkId: number) {
    if (networkId === constants.NETWORK_ID_TRUFFLE) {
      const trufflePath: string = './build/contracts/';

      this.orderLibArtifact = Utils.loadArtifact(join(trufflePath, 'OrderLib.json'));
      this.mathLibArtifact = Utils.loadArtifact(join(trufflePath, 'MathLib.json'));
      this.marketTokenArtifact = Utils.loadArtifact(join(trufflePath, 'MarketToken.json'));
      this.marketContractRegistryArtifact = Utils.loadArtifact(
        join(trufflePath, 'MarketContractRegistry.json')
      );
      this.marketContractFactoryOraclizeArtifact = Utils.loadArtifact(
        join(trufflePath, 'MarketContractFactoryOraclize.json')
      );
      this.marketCollateralPoolFactoryArtifact = Utils.loadArtifact(
        join(trufflePath, 'MarketCollateralPoolFactory.json')
      );
    } else {
      this.orderLibArtifact = OrderLib;
      this.mathLibArtifact = MathLib;
      this.marketTokenArtifact = MarketToken;
      this.marketContractRegistryArtifact = MarketContractRegistry;
      this.marketContractFactoryOraclizeArtifact = MarketContractFactoryOraclize;
      this.marketCollateralPoolFactoryArtifact = MarketCollateralPoolFactory;
    }
  }
}
