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

    /// @notice function called by a bid participant wanting to higher the actual bid
    /// @param _bidAmount amount to give that must higher the last bid
    /// @dev if auctionDeadline == 0, this function should not be called
    /// because there is auction
    function newAuctionBid(uint256 _bidAmount) external {
        if (optionState != OptionState.Created) revert Expired();

        if (auctionDeadline < block.timestamp) revert Expired();

        uint256 senderBid = bids[msg.sender];

        if (premium >= senderBid + _bidAmount) {
            revert InsufficientAmount();
        }

        bool success = IERC20(premiumToken).transferFrom(
            msg.sender,
            address(this),
            _bidAmount
        );
        if (!success) revert TransferFailed();

        if (senderBid == 0) {
            bidders.push(msg.sender);
        }

        bids[msg.sender] += _bidAmount;

        buyer = msg.sender;
        premium = bids[msg.sender];
    }

    /// @notice give back to all auction participant their funds + give premium to writer
    /// @dev can only be called after the auction finished
    /// @dev one user have to call this function, otherwise participant won't get their funds back
    /// and writer won't receive the premium
    /// @dev if auctionDeadline == 0, this function should not be called
    /// because there is auction
    function endAuction() external {
        if (optionState != OptionState.Created) revert Forbidden();

        uint256 m_auctionDeadline = auctionDeadline;

        if (m_auctionDeadline == 0) revert Expired();
        if (m_auctionDeadline >= block.timestamp) revert NotExpired();

        bool success;
        address m_premiumToken = premiumToken;

        for (uint256 i = 0; i < bidders.length; ++i) {
            address bidder = bidders[i];

            if (bidder != buyer) {
                success = IERC20(m_premiumToken).transfer(bidder, bids[bidder]);
                if (!success) revert TransferFailed();
            }
        }

        success = IERC20(m_premiumToken).transfer(writer, premium);
        if (!success) revert TransferFailed();

        optionState = OptionState.Bought;
    }

    /// @notice buy option and give premium to writer
    /// @dev should be called when there is no auction (when premium is constant)
    function buyOption() external {
        if (optionState != OptionState.Created) revert Forbidden();
        if (buyer != address(0)) revert Forbidden();

        if (auctionDeadline > 0) revert Forbidden();
        if (block.timestamp > expiration) revert Forbidden();

        bool success = IERC20(premiumToken).transferFrom(
            msg.sender,
            writer,
            premium
        );
        if (!success) revert TransferFailed();

        buyer = msg.sender;

        optionState = OptionState.Bought;
    }

    /// @notice if buyer hasn't exercised his option during the period 'durationExerciseAfterExpiration',
    /// writer can retrieve their funds
    function retrieveExpiredTokens() external {
        OptionState m_optionState = optionState;

        if (
            m_optionState != OptionState.Bought &&
            m_optionState != OptionState.Created
        ) revert Forbidden();

        if (msg.sender != writer) revert Forbidden();

        // if no one bought this option, the writer can retrieve their tokens as soon as it expires
        if (m_optionState == OptionState.Created) {
            if (block.timestamp <= expiration) revert Forbidden();
        } else {
            if (block.timestamp <= expiration + durationExerciseAfterExpiration)
                revert Forbidden();
        }

        bool success = IERC20(underlyingToken).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();

        optionState = OptionState.Expired;
    }

    /// @notice return all the properties of that option
    /// @notice it prevents having to make multiple calls
    /// @dev doesn't include the bidders and bids array/map
    /// @dev it's using inline assembly for gas efficiency purpose, so the code is not very flexible
    function getFullProperties()
        external
        view
        returns (
            address,
            uint256,
            uint256,
            uint256,
            uint256,
            address,
            uint256,
            uint256,
            address,
            address,
            OptionState,
            address
        )
    {
        assembly {
            let freeMemPointer := mload(0x40)

            let i := 0x20
            let j := 0x01

            // first mstore not in the loop, more gas efficient because it avoids using add()
            mstore(freeMemPointer, sload(underlyingToken.slot))

            for {

            } lt(i, 0x180) {
                // 0x180 == 384 == number of slots (= variables stored) * 32 bytes == 12 * 32
                i := add(i, 0x20)
                j := add(j, 0x01)
            } {
                mstore(
                    add(freeMemPointer, i),
                    sload(add(underlyingToken.slot, j))
                ) // underlyingToken.slot == 0
            }

            return(freeMemPointer, i) // i == 0x180 == add(add(freeMemPointer, i), 0x20)
        }

        /* The assembly code above is the equivalent of :

        return (
            underlyingToken,
            amount,
            strike,
            expiration,
            durationExerciseAfterExpiration,
            premiumToken,
            premium,
            auctionDeadline,
            writer,
            buyer,
            optionState,
            address(STABLE)
        ); */
    }
}
