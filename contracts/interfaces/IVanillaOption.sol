// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IVanillaOption {
    enum Side {
        Call,
        Put
    }

    struct VanillaOptionData {
        Side side;
        address underlyingToken;
        uint256 amount;
        address strikeToken;
        uint256 strike;
        address premiumToken;
        uint256 premium;
        uint256 exerciseWindowStart;
        uint256 exerciseWindowEnd;
        bytes data;
    }

    event Created(uint256 indexed id);
    event Bought(uint256 indexed id, uint256 amount, address indexed buyer);
    event Exercised(uint256 indexed id, uint256 amount);
    event Expired(uint256 indexed id);
    event Canceled(uint256 indexed id);
    event PremiumUpdated(uint256 indexed id, uint256 amount);

    function create(VanillaOptionData memory optionData) external returns (uint256);

    function buy(uint256 id, uint256 amount) external;

    function exercise(uint256 id, uint256 amount) external;

    function retrieveExpiredTokens(uint256 id) external;

    function cancel(uint256 id) external;

    function updatePremium(uint256 id, uint256 amount) external;
}
