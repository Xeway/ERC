// SPDX-License-Identifier: MIT
/* pragma solidity ^0.8.0;

import "../Option.sol";

contract VanillaOption is Option {
    constructor(
        Side side_,
        address underlyingToken_,
        uint256 amount_,
        address strikeToken_,
        uint256 strike_,
        uint256 expiration_,
        uint256 exerciseDuration_,
        address premiumToken_,
        uint256 premium_,
        Type type_
    ) Option(
        side_,
        underlyingToken_,
        amount_,
        strikeToken_,
        strike_,
        expiration_,
        exerciseDuration_,
        premiumToken_,
        premium_,
        type_
    ) {}
}

contract Straddle {
    VanillaOption _call;
    VanillaOption _put;

    constructor(
        address underlyingToken_,
        uint256 amount_,
        address strikeToken_,
        uint256 strike_,
        uint256 expiration_,
        uint256 exerciseDuration_,
        address premiumToken_,
        uint256 premium_,
        Option.Type type_
    ) {
        _call = new VanillaOption(
            Option.Side.Call,
            underlyingToken_,
            amount_,
            strikeToken_,
            strike_,
            expiration_,
            exerciseDuration_,
            premiumToken_,
            premium_,
            type_
        );

        _put = new VanillaOption(
            Option.Side.Put,
            underlyingToken_,
            amount_,
            strikeToken_,
            strike_,
            expiration_,
            exerciseDuration_,
            premiumToken_,
            premium_,
            type_
        );
    }

    function exercise()

    function call() external view returns (VanillaOption) {
        return _call;
    }

    function put() external view returns (VanillaOption) {
        return _put;
    }
}
*/