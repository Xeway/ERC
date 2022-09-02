// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract ERC {
    /// @notice strike price in USD
    uint256 public immutable strike;
    /// @notice expiration in seconds under the same format as block.timestamp
    uint256 public immutable expiration;
    /// @notice durationExerciseAfterExpiration the duration the buyer can exercise his option (same format as block.timestamp)
    uint256 public immutable durationExerciseAfterExpiration;
    /// @notice tokenPremium the token the premium has to be paid
    /// @dev if tokenPremium == address(0), premium is paid with native currency
    address public immutable tokenPremium;
    /// @notice premium price (!be aware of token decimals!)
    uint256 public immutable premium;

    constructor(
        uint256 _strike,
        uint256 _expiration,
        uint256 _durationExerciseAfterExpiration,
        address _tokenPremium,
        uint256 _premium
    ) {
        strike = _strike;
        expiration = _expiration;
        durationExerciseAfterExpiration = _durationExerciseAfterExpiration;
        tokenPremium = _tokenPremium;
        premium = _premium;
    }
}
