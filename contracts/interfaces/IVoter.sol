// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IVoter {

  function ve() external view returns (address);

  function attachTokenToGauge(address stakingToken, uint _tokenId, address account) external;

  function detachTokenFromGauge(address stakingToken, uint _tokenId, address account) external;

  function emitDeposit(uint _tokenId, address account, uint amount) external;

  function emitWithdraw(uint _tokenId, address account, uint amount) external;

  function distribute(address stakingToken, address _gauge) external;

  function notifyRewardAmount(uint amount) external;

  function detachTokenFromAll(uint tokenId, address account) external;

}
