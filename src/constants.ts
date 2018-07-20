import { MARKETProtocolConfig } from './types';

export const constants = {
  MAX_DIGITS_IN_UNSIGNED_256_INT: 78,
  NETWORK_ID_RINKEBY: 4,
  NETWORK_ID_TRUFFLE: 4447,
  PROVIDER_URL_TRUFFLE: 'http://localhost:9545',
  PROVIDER_URL_RINKEBY: 'https://rinkeby.infura.io/cbHh1p8RT4Q6E97F4gVi',
  NULL_ADDRESS: '0x0000000000000000000000000000000000000000'
};

export const configTruffle = {
  networkId: constants.NETWORK_ID_TRUFFLE
};

export const configRinkeby: MARKETProtocolConfig = {
  networkId: constants.NETWORK_ID_RINKEBY,
  marketContractRegistryAddress: '0x7d395038802ae4b7a4c502ce3dfe1f26867b3391',
  marketContractFactoryAddress: '0x361741692e3ce0209924fb4c882321ab852dd5d4',
  marketCollateralPoolFactoryAddress: '0x3e69935694cdb936bf0b281e62b4087cfcb063bb',
  marketTokenAddress: '0x38c0388e9a93bc3d3e793116d0d2793e4388311d',
  mathLibAddress: '0xb81be132a7e73814958e7acae89bff7b7249e910',
  orderLibAddress: '0xc54c646d3dd0b78b45c4bbb8834e3fbf2d28b820'
};
