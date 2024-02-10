// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC7390 {
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
        address[] allowed;
    }

    struct OptionIssuance {
        VanillaOptionData data;
        address seller;
        uint256 exercisedOptions;
        uint256 soldAmount;
        uint256 transferredStrikeAmount;
        uint256 strikeAmount;
    }

    error Forbidden();
    error TransferFailed();
    error TimeForbidden();
    error AmountForbidden();
    error InsufficientBalance();

    event Created(uint256 indexed id);
    event Bought(uint256 indexed id, uint256 amount, address indexed buyer);
    event Exercised(uint256 indexed id, uint256 amount);
    event Expired(uint256 indexed id);
    event Canceled(uint256 indexed id);
    event PremiumUpdated(uint256 indexed id, uint256 amount);
    event AllowedUpdated(uint256 indexed id, address[] allowed);

    function create(VanillaOptionData calldata optionData) external returns (uint256);

    function buy(uint256 id, uint256 amount) external;

    function exercise(uint256 id, uint256 amount) external;

    function retrieveExpiredTokens(uint256 id) external;

    function cancel(uint256 id) external;

    function updatePremium(uint256 id, uint256 amount) external;

    function updateAllowed(uint256 id, address[] memory allowed) external;

    function issuance(uint256 id) external view returns (OptionIssuance memory);
}
