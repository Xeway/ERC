// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IOption} from "./IOption.sol";
import {Option} from  "../Option.sol";

interface IOptionMetadata is IOption {
    function side() external view returns (Option.Side);

    function underlyingToken() external view returns (address);

    function amount() external view returns (uint256);

    function strikeToken() external view returns (address);

    function strike() external view returns (uint256);

    function expiration() external view returns (uint256);

    function exerciseDuration() external view returns (uint256);

    function premiumToken() external view returns (address);

    function premium() external view returns (uint256);

    function getType() external view returns (Option.Type);

    function writer() external view returns (address);

    function buyer() external view returns (address);

    function state() external view returns (Option.State);
}
