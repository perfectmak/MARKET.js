import BigNumber from 'bignumber.js';
import Web3 from 'web3';

// Types
import { Provider } from '@0xproject/types';
import { ECSignature, Order, OrderLib, SignedOrder } from '@marketprotocol/types';

import { Utils } from './Utils';
import { assert } from '../assert';

let ethUtil = require('ethereumjs-util');

/**
 * Computes the orderHash for a supplied order.
 * @param   provider   Web3 provider instance.
 * @param   orderLibAddress address of the deployed OrderLib.sol
 * @param   order      An object that confirms to the Order interface definitions.
 * @return  The resulting orderHash from hashing the supplied order.
 */
export async function createOrderHashAsync(
  provider: Provider,
  orderLibAddress: string,
  order: Order | SignedOrder
): Promise<string> {
  // below assert statement fails due to issues with BigNumber vs Number.
  // assert.isSchemaValid('Order', order, schemas.OrderSchema);
  assert.isETHAddressHex('orderLibAddress', orderLibAddress);

  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  const orderLib: OrderLib = await OrderLib.createAndValidate(web3, orderLibAddress);

  return orderLib
    .createOrderHash(
      order.contractAddress,
      // orderAddresses
      [order.maker, order.taker, order.feeRecipient],
      // unsignedOrderValues
      [order.makerFee, order.takerFee, order.price, order.expirationTimestamp, order.salt],
      order.orderQty
    )
    .then(data => data)
    .catch((err: Error) => {
      const error = 'Error while creating order hash';
      console.error(err);
      return error;
    });
}

/***
 * Creates and signs a new order given the arguments provided
 * @param {Provider} provider               Web3 provider instance.
 * @param {string} orderLibAddress          address of the deployed OrderLib.sol
 * @param {string} contractAddress          address of the deployed MarketContract.sol
 * @param {BigNumber} expirationTimestamp   unix timestamp
 * @param {string} feeRecipient             address of account to receive fees
 * @param {string} maker                    address of maker account
 * @param {BigNumber} makerFee              fee amount for maker to pay
 * @param {string} taker                    address of taker account
 * @param {BigNumber} takerFee              fee amount for taker to pay
 * @param {BigNumber} orderQty              qty of Order
 * @param {BigNumber} price                 price of Order
 * @param {BigNumber} remainingQty          qty remaining
 * @param {BigNumber} salt                  used to ensure unique order hashes
 * @param {boolean}  shouldAddPersonalMessagePrefix  Some signers add the personal message prefix
 * `\x19Ethereum Signed Message`themselves (e.g Parity Signer, Ledger, TestRPC) and others expect
 * it to already be done by the client (e.g Metamask). Depending on which signer this request is
 * going to, decide on whether to add the prefix before sending the request.
 *
 * @return {Promise<SignedOrder>}
 */
export async function createSignedOrderAsync(
  provider: Provider,
  orderLibAddress: string,
  contractAddress: string,
  expirationTimestamp: BigNumber,
  feeRecipient: string,
  maker: string,
  makerFee: BigNumber,
  taker: string,
  takerFee: BigNumber,
  orderQty: BigNumber,
  price: BigNumber,
  remainingQty: BigNumber,
  salt: BigNumber,
  shouldAddPersonalMessagePrefix: boolean
): Promise<SignedOrder> {
  assert.isETHAddressHex('orderLibAddress', orderLibAddress);
  assert.isETHAddressHex('contractAddress', contractAddress);

  const order: Order = {
    contractAddress: contractAddress,
    expirationTimestamp: expirationTimestamp, // '', makerAccount, 0, 1, 100000, 1, '', 0
    feeRecipient: feeRecipient,
    maker: maker,
    makerFee: makerFee,
    orderQty: orderQty,
    price: price,
    remainingQty: remainingQty,
    salt: salt,
    taker: taker,
    takerFee: takerFee
  };

  const orderHash: string | BigNumber = await createOrderHashAsync(
    provider,
    orderLibAddress,
    order
  );

  const signedOrder: SignedOrder = {
    ...order,
    ecSignature: await signOrderHashAsync(
      provider,
      String(orderHash),
      maker,
      shouldAddPersonalMessagePrefix
    )
  };

  return signedOrder;
}

/**
 * Confirms a signed order is validly signed
 * @param provider
 * @param orderLibAddress
 * @param signedOrder
 * @param orderHash
 * @return boolean if order hash and signature resolve to maker address (signer)
 */
export async function isValidSignatureAsync(
  provider: Provider,
  orderLibAddress: string,
  signedOrder: SignedOrder,
  orderHash: string
): Promise<boolean> {
  assert.isETHAddressHex('orderLibAddress', orderLibAddress);

  const web3: Web3 = new Web3();
  web3.setProvider(provider);
  const orderLib: OrderLib = await OrderLib.createAndValidate(web3, orderLibAddress);
  return orderLib.isValidSignature(
    signedOrder.maker,
    orderHash,
    signedOrder.ecSignature.v,
    signedOrder.ecSignature.r,
    signedOrder.ecSignature.s
  );
}

/**
 * Signs an orderHash and returns it's elliptic curve signature.
 * @param   provider        Web3 provider instance.
 * @param   orderHash       Hex encoded orderHash to sign.
 * @param   signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
 *          must be available via the Provider supplied to MARKET.js.
 * @param   shouldAddPersonalMessagePrefix  Some signers add the personal message prefix `\x19Ethereum Signed Message`
 *          themselves (e.g Parity Signer, Ledger, TestRPC) and others expect it to already be done by the client
 *          (e.g Metamask). Depending on which signer this request is going to, decide on whether to add the prefix
 *          before sending the request.
 * @return  An object containing the Elliptic curve signature parameters generated by signing the orderHash.
 */
export async function signOrderHashAsync(
  provider: Provider,
  orderHash: string,
  signerAddress: string,
  shouldAddPersonalMessagePrefix: boolean
): Promise<ECSignature> {
  assert.isETHAddressHex('signerAddress', signerAddress);

  const web3: Web3 = new Web3();
  web3.setProvider(provider);

  let msgHashHex = orderHash;
  if (shouldAddPersonalMessagePrefix) {
    const orderHashBuff = ethUtil.toBuffer(orderHash);
    const msgHashBuff = ethUtil.hashPersonalMessage(orderHashBuff);
    msgHashHex = ethUtil.bufferToHex(msgHashBuff);
  }

  return Utils.signMessage(web3, signerAddress, msgHashHex);
}
