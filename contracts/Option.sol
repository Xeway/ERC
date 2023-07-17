// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/access/Ownable.sol';

abstract contract Option is Ownable {
    /// @notice _underlyingToken the underlying token
    IERC20 internal _underlyingToken;

    /// @notice _amount the amount of the underlying asset (be aware of token decimals!)
    uint256 internal _amount;

    /// @notice _quoteToken token used to pay the writer when buyer exercise option
    /// @dev buyer will pay _amount * _strike
    IERC20 internal _quoteToken;

    /// @notice _strike price determined in the _quoteToken currency (be aware of token decimals!)
    uint256 internal _strike;

    /// @notice _expiration in seconds (date)
    /// @dev must be under the same format as block.timestamp
    uint256 internal _expiration;

    /// @notice _durationExerciseAfterExpiration the duration the buyer can exercise his option (duration)
    /// @dev must be under the same format as block.timestamp
    uint256 internal _durationExerciseAfterExpiration;

    /// @notice _premiumToken the token the premium has to be paid
    IERC20 internal _premiumToken;

    /// @notice _premium price (be aware of token decimals!)
    uint256 internal _premium;

    enum Type {
        European,
        American
    }
    Type internal _type;

    address internal _buyer;

    enum State {
        Created,
        Bought,
        Exercised,
        Expired,
        Canceled
    }
    State internal _state;

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();
    error Expired();
    error NotExpired();
    error Forbidden();

    /// @notice buy option and give premium to writer
    function buy() external {
        if (_state != State.Created) revert Forbidden();
        if (block.timestamp > _expiration) revert Forbidden();

        bool success = _premiumToken.transferFrom(
            msg.sender,
            owner(),
            _premium
        );
        if (!success) revert TransferFailed();

        _buyer = msg.sender;
        _state = State.Bought;
    }

    /// @notice if buyer hasn't exercised his option during the _durationExerciseAfterExpiration period, writer can retrieve its funds
    function retrieveExpiredTokens() external onlyOwner {
        if (_state != State.Bought) revert Forbidden();

        if (block.timestamp <= _expiration + _durationExerciseAfterExpiration) revert Forbidden();

        _sendUnderlyingTokenToWriter();

        _state = State.Expired;
    }

    /// @notice possibility to cancel the option and retrieve collateralized funds while no one bought the option
    function cancel() external onlyOwner {
        if (_state != State.Created) revert Forbidden();

        _sendUnderlyingTokenToWriter();

        _state = State.Canceled;
    }

    function _sendUnderlyingTokenToWriter() internal {
        bool success = IERC20(_underlyingToken).transfer(msg.sender, _amount);
        if (!success) revert TransferFailed();
    }

    function underlyingToken() external view returns (address) {
        return address(_underlyingToken);
    }

    function amount() external view returns (uint256) {
        return _amount;
    }

    function quoteToken() external view returns (address) {
        return address(_quoteToken);
    }

    function strike() external view returns (uint256) {
        return _strike;
    }

    function expiration() external view returns (uint256) {
        return _expiration;
    }

    function durationExerciseAfterExpiration() external view returns (uint256) {
        return _durationExerciseAfterExpiration;
    }

    function premiumToken() external view returns (address) {
        return address(_premiumToken);
    }

    function premium() external view returns (uint256) {
        return _premium;
    }

    function getType() external view returns (Type) {
        return _type;
    }

    function writer() external view returns (address) {
        return owner();
    }

    function buyer() external view returns (address) {
        return _buyer;
    }

    function state() external view returns (State) {
        return _state;
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
            address,
            uint256,
            address,
            uint256,
            uint256,
            uint256,
            address,
            uint256,
            Type,
            address,
            State
        )
    {
        assembly {
            let freeMemPointer := mload(0x40)

            let i := 0x20
            let j := 0x01

            let firstSlot := 0 // _owner.slot in Ownable

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
            owner(),
            _underlyingToken,
            _amount,
            _quoteToken,
            _strike,
            _expiration,
            _durationExerciseAfterExpiration,
            _premiumToken,
            _premium,
            _type,
            _buyer,
            _state
        ); */
    }

    function exercise() external virtual;
}
