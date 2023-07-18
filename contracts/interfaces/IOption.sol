// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOption {
    event Created(uint256 timestamp);
    event Bought(address indexed buyer, uint256 timestamp);
    event Exercised(uint256 timestamp);
    event Expired(uint256 timestamp);
    event Canceled(uint256 timestamp);

    function create() external returns (bool);
    function buy() external returns (bool);
    function exercise() external returns (bool);
    function retrieveExpiredTokens() external returns (bool);
    function cancel() external returns (bool);
}
