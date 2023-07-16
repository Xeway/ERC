// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/access/Ownable.sol';

abstract contract Option is Ownable {
    /// @notice underlyingToken the underlying token
    IERC20 public underlyingToken;

    /// @notice amount the amount of the underlying asset (be aware of token decimals!)
    uint256 public amount;

    /// @notice quoteToken token used to pay the writer when buyer exercise option
    /// @dev buyer will pay amount * strike
    IERC20 public quoteToken;

    /// @notice strike price determined in the quoteToken currency (be aware of token decimals!)
    uint256 public strike;

    /// @notice expiration in seconds (date)
    /// @dev must be under the same format as block.timestamp
    uint256 public expiration;

    /// @notice durationExerciseAfterExpiration the duration the buyer can exercise his option (duration)
    /// @dev must be under the same format as block.timestamp
    uint256 public durationExerciseAfterExpiration;

    /// @notice premiumToken the token the premium has to be paid
    IERC20 public premiumToken;

    /// @notice premium price (be aware of token decimals!)
    uint256 public premium;

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
        Expired,
        Canceled
    }
    OptionState public optionState;

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();
    error Expired();
    error NotExpired();
    error Forbidden();

    /// @notice buy option and give premium to writer
    function buy() external {
        if (optionState != OptionState.Created) revert Forbidden();
        if (block.timestamp > expiration) revert Forbidden();

        bool success = premiumToken.transferFrom(
            msg.sender,
            writer,
            premium
        );
        if (!success) revert TransferFailed();

        buyer = msg.sender;
        optionState = OptionState.Bought;
    }

    /// @notice if buyer hasn't exercised his option during the period 'durationExerciseAfterExpiration', writer can retrieve its funds
    function retrieveExpiredTokens() external onlyOwner {
        if (optionState != OptionState.Bought) revert Forbidden();

        if (block.timestamp <= expiration + durationExerciseAfterExpiration) revert Forbidden();

        _sendUnderlyingTokenToWriter();

        optionState = OptionState.Expired;
    }

    /// @notice possibility to cancel the option and retrieve collateralized funds while no one bought the option
    function cancel() external onlyOwner {
        if (optionState != OptionState.Created) revert Forbidden();

        _sendUnderlyingTokenToWriter();

        optionState = OptionState.Canceled;
    }

    function _sendUnderlyingTokenToWriter() internal {
        bool success = IERC20(underlyingToken).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
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
            address,
            uint256,
            uint256,
            uint256,
            address,
            uint256,
            OptionType,
            address,
            address,
            OptionState
        )
    {
        assembly {
            let freeMemPointer := mload(0x40)

            let i := 0x20
            let j := 0x01

            let firstSlot := underlyingToken.slot // == 0

            // first mstore not in the loop, more gas efficient because it avoids using add()
            mstore(freeMemPointer, sload(firstSlot))

            for {

            } lt(i, 0x180) {
                // 0x180 == 384 == number of slots (= variables stored) * 32 bytes == 12 * 32
                i := add(i, 0x20)
                j := add(j, 0x01)
            } {
                mstore(
                    add(freeMemPointer, i),
                    sload(add(firstSlot, j))
                )
            }

            return(freeMemPointer, i) // i == 0x180 == add(add(freeMemPointer, i), 0x20)
        }

        /* The assembly code above is the equivalent of :
        return (
            underlyingToken,
            amount,
            quoteToken,
            strike,
            expiration,
            durationExerciseAfterExpiration,
            premiumToken,
            premium,
            optionType,
            writer,
            buyer,
            optionState
        ); */
    }

    function exerciseOption() external virtual;
}
