// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
        uint256 exceriseWindowStart;
        uint256 exerciseWindowEnd;
        uint256 buyingWindowEnd;
        address premiumToken;
        uint256 premium;
        bool renounceable;
        bool forceToBuyAllOptions;
    }

    event Created(uint256 indexed id, uint256 timestamp);
    event Bought(
        uint256 indexed id,
        uint256 amount,
        address indexed buyer,
        uint256 timestamp
    );
    event Exercised(uint256 indexed id, uint256 amount, uint256 timestamp);
    event Expired(uint256 indexed id, uint256 timestamp);
    event Canceled(uint256 indexed id, uint256 timestamp);

    function create(
        VanillaOptionData memory optionData,
        address[] calldata allowedBuyers
    ) external returns (uint256);

    function buy(uint256 id, uint256 amount, bool mustCompletelyFill) external;

    function exercise(uint256 id, uint256 amount) external returns (bool);

    function retrieveExpiredTokens(uint256 id) external returns (bool);

    function cancel(uint256 id) external returns (bool);
}
