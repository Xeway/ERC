// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC {
    /// @notice underlyingToken the underlying token
    /// @dev if underlyingToken == address(0), native currency is the underlying asset
    address public immutable underlyingToken;

    /// @notice the amount of the underlying asset
    uint256 public amount;

    /// @notice strike price in USD
    uint256 public immutable strike;

    /// @notice expiration in seconds
    /// @dev must be under the same format as block.timestamp
    uint256 public immutable expiration;

    /// @notice durationExerciseAfterExpiration the duration the buyer can exercise his option
    /// @dev must be under the same format as block.timestamp
    uint256 public immutable durationExerciseAfterExpiration;

    /// @notice premiumToken the token the premium has to be paid
    /// @dev if premiumToken == address(0), premium is paid with native currency
    address public immutable premiumToken;

    /// @notice premium price (!be aware of token decimals!)
    uint256 public premium;

    /// @notice auctionDuration how long potential buyers can participate in the auction for the premium
    /// @dev if auctionDuration == 0, no auction
    /// @dev the price proposals must be > premium
    uint256 public immutable auctionDuration;

    address public seller;
    address public buyer;

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();

    constructor(
        address _underlyingToken,
        uint256 _amount,
        uint256 _strike,
        uint256 _expiration,
        uint256 _durationExerciseAfterExpiration,
        address _premiumToken,
        uint256 _premium,
        uint256 _auctionDuration
    ) {
        if (_underlyingToken == address(0) || _amount == 0) {
            if (msg.value == 0) revert InsufficientAmount();
            amount = msg.value;
        } else {
            bool success = IERC20(_underlyingToken).transferFrom(
                msg.sender,
                address(this),
                _amount
            );
            if (!success) revert TransferFailed();
            amount = _amount;
        }

        strike = _strike;

        if (_expiration <= block.timestamp) revert InvalidValue();
        expiration = _expiration;

        if (_durationExerciseAfterExpiration == 0) revert InvalidValue();
        durationExerciseAfterExpiration = _durationExerciseAfterExpiration;

        premiumToken = _premiumToken;

        premium = _premium;

        auctionDuration = _auctionDuration;
        seller = msg.sender;
    }
}
