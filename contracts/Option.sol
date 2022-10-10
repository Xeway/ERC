// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Option {
    /// @notice underlyingToken the underlying token
    /// @dev if underlyingToken == address(0), native currency is the underlying asset
    address public underlyingToken;

    /// @notice the amount of the underlying asset
    uint256 public amount;

    /// @notice strike price determined according to the stable coin decimals
    // ex: my strike price is $2500 in USDC (6 decimals)
    // so strike = 2500*(10**6) = 2500000000
    uint256 public strike;

    /// @notice expiration in seconds (date)
    /// @dev must be under the same format as block.timestamp
    uint256 public expiration;

    /// @notice durationExerciseAfterExpiration the duration the buyer can exercise his option (duration)
    /// @dev must be under the same format as block.timestamp
    uint256 public durationExerciseAfterExpiration;

    /// @notice premiumToken the token the premium has to be paid
    /// @dev if premiumToken == address(0), premium is paid with native currency
    address public premiumToken;

    /// @notice premium price (!be aware of token decimals!)
    uint256 public premium;

    /// @notice auctionDeadline how long potential buyers can participate in the auction for the premium (date)
    /// @dev if auctionDeadline == 0, no auction
    /// @dev the price proposals must be > premium
    uint256 public auctionDeadline;

    enum OptionType {
        European,
        American
    }
    OptionType public optionType;

    address public writer;
    address public buyer;

    enum OptionState {
        Created,
        Bought,
        Exercised,
        Expired
    }
    OptionState public optionState;

    /// @notice stable coin used to pay to the writer when buyer exercise option
    /// @dev buyer will pay amount * strike (ex: 2 ETH * 3000 USD = 6000 USD in DAI)
    IERC20 public STABLE;

    /// @notice bids keep track of all the bids for each bidders
    mapping(address => uint256) bids;
    /// @dev bidders used to loop over bids
    address[] bidders;

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();
    error Expired();
    error NotExpired();
    error Forbidden();
}
