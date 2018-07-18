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
  marketContractRegistryAddress: '0x4bc60737323fd065d99c726ca2c0fad0d1077a60',
  marketContractFactoryAddress: '0x9d904712cf622d3bfeacb5282a51a0ad1418f9a3',
  marketCollateralPoolFactoryAddress: '0x011176b12c962b3d65049b0b8358d8e9132223f1',
  marketTokenAddress: '0xffa7d6c01f8b40eb26a5ffbde9d6b5daeebb980e',
  mathLibAddress: '0xb81be132a7e73814958e7acae89bff7b7249e910',
  orderLibAddress: '0xc54c646d3dd0b78b45c4bbb8834e3fbf2d28b820'
};
