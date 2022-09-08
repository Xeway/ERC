// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./WETH.sol";
import "./IWETH.sol";

contract ERC {
    /// @notice underlyingToken the underlying token
    /// @dev if underlyingToken == address(0), native currency is the underlying asset
    address public underlyingToken;

    /// @notice the amount of the underlying asset
    uint256 public amount;

    /// @notice strike price in USD
    uint256 public immutable strike;

    /// @notice expiration in seconds (date)
    /// @dev must be under the same format as block.timestamp
    uint256 public immutable expiration;

    /// @notice durationExerciseAfterExpiration the duration the buyer can exercise his option (duration)
    /// @dev must be under the same format as block.timestamp
    uint256 public immutable durationExerciseAfterExpiration;

    /// @notice premiumToken the token the premium has to be paid
    /// @dev if premiumToken == address(0), premium is paid with native currency
    address public premiumToken;

    /// @notice premium price (!be aware of token decimals!)
    uint256 public premium;

    /// @notice auctionDeadline how long potential buyers can participate in the auction for the premium (date)
    /// @dev if auctionDeadline == 0, no auction
    /// @dev the price proposals must be > premium
    uint256 public immutable auctionDeadline;

    address public seller;
    address public buyer;

    /// @notice bids keep track of all the bids for each bidders
    mapping(address => uint256) public bids;
    /// @dev bidders used to loop over bids
    address[] bidders;

    /// @notice WETH token
    /// @dev if in the constructor, _WETHAddr == address(0) then we create a new WETH token
    IWETH public WETH;

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();
    error Expired();
    error NotExpired();
    error Forbidden();

    constructor(
        address _underlyingToken,
        uint256 _amount,
        uint256 _strike,
        uint256 _expiration,
        uint256 _durationExerciseAfterExpiration,
        address _premiumToken,
        uint256 _premium,
        uint256 _auctionDeadline,
        address _WETHAddress
    ) payable {
        if (_underlyingToken == address(0) || _premiumToken == address(0)) {
            if (_WETHAddress != address(0)) {
                WETH = IWETH(_WETHAddress);
            } else {
                WETH = IWETH(address(new WrappedETH()));
            }
        }

        if (_underlyingToken == address(0) || _amount == 0) {
            if (msg.value == 0) revert InsufficientAmount();

            WETH.deposit{value: msg.value}();

            underlyingToken = address(WETH);
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

        if (_premiumToken == address(0)) {
            premiumToken = address(WETH);
        } else {
            premiumToken = _premiumToken;
        }

        premium = _premium;

        if (_auctionDeadline >= _expiration) revert InvalidValue();
        auctionDeadline = _auctionDeadline;
        seller = msg.sender;
    }

    function newAuctionBid(uint256 _bidAmount) external {
        if (auctionDeadline < block.timestamp) revert Expired();

        bool success = IERC20(premiumToken).transferFrom(
            msg.sender,
            address(this),
            _bidAmount
        );
        if (!success) revert TransferFailed();

        if (premium >= bids[msg.sender] + _bidAmount) {
            revert InsufficientAmount();
        }

        if (bids[msg.sender] == 0) {
            bidders.push(msg.sender);
        }

        bids[msg.sender] += _bidAmount;

        buyer = msg.sender;
        premium = bids[msg.sender];
    }

    function endAuction() external {
        if (auctionDeadline == 0) revert Expired();
        if (auctionDeadline >= block.timestamp) revert NotExpired();

        bool success;

        for (uint256 i = 0; i < bidders.length; ++i) {
            address bidder = bidders[i];

            if (bidder != buyer) {
                success = IERC20(premiumToken).transfer(bidder, bids[bidder]);
                if (!success) revert TransferFailed();
            }
        }

        success = IERC20(premiumToken).transfer(seller, premium);
        if (!success) revert TransferFailed();
    }

    function buyOption() external {
        if (auctionDeadline > 0) revert Forbidden();
        if (block.timestamp >= expiration) revert Forbidden();

        bool success = IERC20(premiumToken).transferFrom(
            msg.sender,
            seller,
            premium
        );
        if (!success) revert TransferFailed();

        buyer = msg.sender;
    }

    function exerciseOption() external {
        if (msg.sender != buyer) revert Forbidden();

        if (block.timestamp > expiration) revert Expired();
        if (block.timestamp <= auctionDeadline) revert Forbidden();
        if (block.timestamp > expiration + durationExerciseAfterExpiration)
            revert Forbidden();

        bool success = IERC20(underlyingToken).transfer(buyer, amount);
        if (!success) revert TransferFailed();
    }

    function retrieveExpiredTokens() external {
        if (msg.sender != seller) revert Forbidden();
        if (block.timestamp <= expiration + durationExerciseAfterExpiration)
            revert Forbidden();

        bool success = IERC20(underlyingToken).transfer(seller, amount);
        if (!success) revert TransferFailed();
    }

    function wrapToken() external payable {
        WETH.deposit{value: msg.value}();

        bool success = WETH.transfer(msg.sender, msg.value);
        if (!success) revert TransferFailed();
    }

    function unWrapToken(uint256 _amount) external {
        bool success = WETH.transferFrom(msg.sender, address(this), _amount);
        if (!success) revert TransferFailed();

        WETH.withdraw(_amount);

        (success, ) = payable(msg.sender).call{value: _amount}("");
        if (!success) revert TransferFailed();
    }

    // WETH
    // if no one took part of the option
    // if no auction at all
}
