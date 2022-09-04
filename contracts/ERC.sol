// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./WETH.sol";
import "./IWETH.sol";

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

    /// @notice auctionDeadline how long potential buyers can participate in the auction for the premium
    /// @dev if auctionDeadline == 0, no auction
    /// @dev the price proposals must be > premium
    uint256 public immutable auctionDeadline;

    address public seller;
    address public buyer;

    /// @notice bids keep track of all the bids for each bidders
    mapping(address => uint256) public bids;
    /// @dev bidders used to loop over bids
    address[] bidders;

    struct LastBid {
        address user;
        uint256 amount;
    }

    /// @notice lastBid current largest bid
    LastBid public lastBid;

    /// @notice WETH token
    /// @dev if in the constructor, _WETHAddr == address(0) then we create a new WETH token
    IWETH public WETH;

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();
    error Expired();
    error NotExpired();

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
        if (_underlyingToken == address(0) || _amount == 0) {
            if (msg.value == 0) revert InsufficientAmount();
            amount = msg.value;
        } else {
            if (msg.value == 0) revert InvalidValue();

            bool success = IERC20(_underlyingToken).transferFrom(
                msg.sender,
                address(this),
                _amount
            );
            if (!success) revert TransferFailed();
            amount = _amount;
        }

        underlyingToken = _underlyingToken;

        strike = _strike;

        if (_expiration <= block.timestamp) revert InvalidValue();
        expiration = _expiration;

        if (_durationExerciseAfterExpiration == 0) revert InvalidValue();
        durationExerciseAfterExpiration = _durationExerciseAfterExpiration;

        premiumToken = _premiumToken;

        premium = _premium;

        auctionDeadline = _auctionDeadline;
        seller = msg.sender;

        if (_underlyingToken != address(0) || _premiumToken != address(0)) {
            if (_WETHAddress != address(0)) {
                WETH = IWETH(_WETHAddress);
            } else {
                WETH = IWETH(address(new WrappedETH()));
            }
        }
    }

    function newAuctionBid(uint256 _bidAmount) external payable {
        if (auctionDeadline < block.timestamp) revert Expired();

        if (premiumToken == address(0)) {
            if (
                lastBid.amount >= bids[msg.sender] + msg.value ||
                premium >= bids[msg.sender] + msg.value
            ) revert InsufficientAmount();

            if (bids[msg.sender] == 0) {
                bidders.push(msg.sender);
            }

            bids[msg.sender] += msg.value;

            lastBid.user = msg.sender;
            lastBid.amount = bids[msg.sender];
        } else {
            if (msg.value == 0) revert InvalidValue();

            if (
                lastBid.amount >= bids[msg.sender] + _bidAmount ||
                premium >= bids[msg.sender] + _bidAmount
            ) revert InsufficientAmount();

            bool success = IERC20(premiumToken).transferFrom(
                msg.sender,
                address(this),
                _bidAmount
            );
            if (!success) revert TransferFailed();

            if (bids[msg.sender] == 0) {
                bidders.push(msg.sender);
            }

            bids[msg.sender] += _bidAmount;

            lastBid.user = msg.sender;
            lastBid.amount = bids[msg.sender];
        }
    }

    function endAuction() external {
        if (auctionDeadline == 0) revert Expired();
        if (auctionDeadline >= block.timestamp) revert NotExpired();

        for (uint256 i = 0; i < bidders.length; ++i) {
            address bidder = bidders[i];

            if (premiumToken == address(0)) {
                if (bidder != lastBid.user) {
                    (bool success, ) = bidder.call{value: bids[bidder]}("");
                    if (!success) revert TransferFailed();
                }
            } else {
                if (bidder != lastBid.user) {
                    bool success = IERC20(premiumToken).transfer(
                        bidder,
                        bids[bidder]
                    );
                    if (!success) revert TransferFailed();
                }
            }
        }
    }
}
