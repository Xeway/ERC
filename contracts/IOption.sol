// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './Option.sol';

interface IOption {
    function buy() external returns (bool);

    function exercise() external returns (bool);

    function retrieveExpiredTokens() external returns (bool);

    function cancel() external returns (bool);
}
