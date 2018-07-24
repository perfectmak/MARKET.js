import { ERC20, ITxParams } from '@marketprotocol/types';
import * as _ from 'lodash';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import { assert } from '../assert';
/**
 * Wrapper for ERC20 token contracts and functionality
 */
export class ERC20TokenContractWrapper {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  private readonly _tokenContractsByAddress: { [address: string]: ERC20 };
  private readonly _web3: Web3;

  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor(web3: Web3) {
    this._web3 = web3;
    this._tokenContractsByAddress = {};
  }

  // endregion//Constructors

  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************
  /**
   * Retrieves an owner's ERC20 token balance.
   * @param {string} tokenAddress   The hex encoded contract Ethereum address where the ERC20 token is deployed.
   * @param {string} ownerAddress   The hex encoded user Ethereum address whose balance you would like to check.
   * @return {Promise<BigNumber>}   The owner's ERC20 token balance in base units.
   */
  public async getBalanceAsync(tokenAddress: string, ownerAddress: string): Promise<BigNumber> {
    assert.isETHAddressHex('ownerAddress', ownerAddress);
    assert.isETHAddressHex('tokenAddress', tokenAddress);
    const normalizedTokenAddress = tokenAddress.toLowerCase();

    const tokenContract: ERC20 = await this.getERC20TokenContractAsync(normalizedTokenAddress);
    return tokenContract.balanceOf(ownerAddress);
  }

  /**
   * Sets the spender's allowance to a specified number of baseUnits on behalf of the owner address.
   * Equivalent to the ERC20 spec method `approve`.
   * @param {string} tokenAddress           The hex encoded contract Ethereum address where the ERC20 token is deployed.
   * @param {string} spenderAddress         The hex encoded user Ethereum address who will be able
   *                                        to spend the set allowance.
   * @param {BigNumber} amountInBaseUnits   The allowance amount you would like to set.
   * @param {ITxParams} txParams            Transaction parameters.
   * @return {Promise<string>}              Transaction hash.
   */
  public async setAllowanceAsync(
    tokenAddress: string,
    spenderAddress: string,
    amountInBaseUnits: BigNumber,
    txParams: ITxParams = {}
  ): Promise<string> {
    assert.isETHAddressHex('spenderAddress', spenderAddress);
    assert.isETHAddressHex('tokenAddress', tokenAddress);
    await assert.isSenderAddressAsync('txParams.from', txParams.from || '', this._web3);
    assert.isValidBaseUnitAmount('amountInBaseUnits', amountInBaseUnits);

    const tokenContract = await this.getERC20TokenContractAsync(tokenAddress);
    return tokenContract.approveTx(spenderAddress, amountInBaseUnits).send(txParams);
  }

  /**
   * Retrieves the owners allowance in baseUnits set to the spender's address.
   * @param {string} tokenAddress     The hex encoded contract Ethereum address where the ERC20 token is deployed.
   * @param {string} ownerAddress     The hex encoded user Ethereum address whose allowance to spenderAddress
   *                                  you would like to retrieve.
   * @param {string} spenderAddress   The hex encoded user Ethereum address who can spend the allowance
   *                                  you are fetching.
   * @return {Promise<BigNumber>}
   */
  public async getAllowanceAsync(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<BigNumber> {
    assert.isETHAddressHex('ownerAddress', ownerAddress);
    assert.isETHAddressHex('tokenAddress', tokenAddress);
    assert.isETHAddressHex('spenderAddress', spenderAddress);
    await assert.isSenderAddressAsync('ownerAddress', ownerAddress, this._web3);

    const tokenContract = await this.getERC20TokenContractAsync(tokenAddress);
    return tokenContract.allowance(ownerAddress, spenderAddress);
  }

  /**
   * Allow for retrieval or creation of a given ERC20 Token
   * @param {string} tokenAddress         address of ERC20
   * @returns {Promise<MarketContract>}   ERC20 object
   */
  public async getERC20TokenContractAsync(tokenAddress: string): Promise<ERC20> {
    const normalizedTokenAddress = tokenAddress.toLowerCase();
    let tokenContract = this._tokenContractsByAddress[normalizedTokenAddress];
    if (!_.isUndefined(tokenContract)) {
      return tokenContract;
    }

    tokenContract = new ERC20(this._web3, tokenAddress);
    this._tokenContractsByAddress[normalizedTokenAddress] = tokenContract;
    return tokenContract;
  }
  // endregion //Public Methods

  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************

  // endregion //Private Methods
}
