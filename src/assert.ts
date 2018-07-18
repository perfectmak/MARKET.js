import { Schema } from 'jsonschema';
import * as _ from 'lodash';
import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import util from 'util';

import { Provider } from '@0xproject/types';

import { SchemaValidator } from './SchemaValidator';

export const assert = {
  assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(message);
    }
  },
  isBoolean(variableName: string, value: boolean): void {
    this.assert(_.isBoolean(value), this.typeAssertionMessage(variableName, 'boolean', value));
  },
  isFunction(variableName: string, value: Function): void {
    this.assert(_.isFunction(value), this.typeAssertionMessage(variableName, 'function', value));
  },
  isNumber(variableName: string, value: number): void {
    this.assert(_.isFinite(value), this.typeAssertionMessage(variableName, 'number', value));
  },
  isBigNumber(variableName: string, value: BigNumber): void {
    this.assert(
      BigNumber.isBigNumber(value),
      this.typeAssertionMessage(variableName, 'BigNumber', value)
    );
  },
  isSchemaValid(variableName: string, value: {}, schema: Schema, subSchemas?: Schema[]): void {
    const schemaValidator = new SchemaValidator();
    if (!_.isUndefined(subSchemas)) {
      _.map(subSchemas, schemaValidator.addSchema.bind(schemaValidator));
    }
    const validationResult = schemaValidator.validate(value, schema);
    const hasValidationErrors = validationResult.errors.length > 0;
    const msg = `Expected ${variableName} to confirm to schema ${schema.id}
      Encountered: ${JSON.stringify(value, null, '\t')}
      Validation errors: ${validationResult.errors.join(', ')}`;
    this.assert(!hasValidationErrors, msg);
  },
  isString(variableName: string, value: string): void {
    this.assert(_.isString(value), this.typeAssertionMessage(variableName, 'string', value));
  },
  isWeb3Provider(variableName: string, value: Provider): void {
    const isWeb3Provider = _.isFunction(value.sendAsync);
    this.assert(isWeb3Provider, this.typeAssertionMessage(variableName, 'Provider', value));
  },
  typeAssertionMessage(variableName: string, type: string, value: {}): string {
    return `Expected ${variableName} to be of type ${type}, encountered: ${value}`;
  },
  isETHAddressHex(variableName: string, address: string): void {
    const isValidAddress = /^(0x){1}[0-9a-fA-F]{40}$/i.test(address);
    const message = `Expected ${variableName} to be an ETHAddressHex, encountered ${address}`;
    this.assert(isValidAddress, message);
  },
  isValidBaseUnitAmount(variableName: string, value: BigNumber) {
    const isNotNegative = !value.isNegative();
    this.assert(
      isNotNegative,
      `${variableName} cannot be a negative number, found value: ${value.toNumber()}`
    );

    const notHaveDecimal = value.decimalPlaces() === 0;
    this.assert(
      notHaveDecimal,
      `${variableName} should be in baseUnits (no decimals), found value: ${value.toNumber()}`
    );
  },
  /**
   * Ensures that the senderAddress is valid and reachable Account
   *
   * @param {string} variableName
   * @param {string} senderAddress
   * @param {Provider} provider
   */
  async isSenderAddressAsync(variableName: string, senderAddress: string, web3: Web3) {
    this.isETHAddressHex(variableName, senderAddress);

    const accounts = await util.promisify(web3.eth.getAccounts)();
    const isSenderAddressAvailable = _.includes(accounts, senderAddress);
    this.assert(
      isSenderAddressAvailable,
      `Specified ${variableName} ${senderAddress} isn't available through the supplied web3 provider`
    );
  }
};
