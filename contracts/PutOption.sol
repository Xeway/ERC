// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Option.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PutOption is Option {
    constructor(
        address _underlyingToken,
        uint256 _amount,
        uint256 _strike,
        uint256 _expiration,
        uint256 _durationExerciseAfterExpiration,
        address _premiumToken,
        uint256 _premium,
        uint256 _auctionDeadline,
        address _STABLEAddress,
        OptionType _optionType
    ) {
        // the underlying token and the stablecoin cannot be the same
        if (
            _underlyingToken == _STABLEAddress && _underlyingToken != address(0)
        ) {
            revert InvalidValue();
        }

        if (
            _underlyingToken == address(0) ||
            _premiumToken == address(0) ||
            _amount == 0 ||
            _STABLEAddress == address(0)
        ) {
            revert InvalidValue();
        }

        if (_expiration <= block.timestamp) revert InvalidValue();
        if (_durationExerciseAfterExpiration == 0) revert InvalidValue();
        if (_auctionDeadline >= _expiration) revert InvalidValue();

        STABLE = IERC20(_STABLEAddress);

        uint256 underlyingDecimals = ERC20(_underlyingToken).decimals();

        bool success = STABLE.transferFrom(
            msg.sender,
            address(this),
            (_strike * _amount) / 10**(underlyingDecimals)
        );
        if (!success) revert TransferFailed();

        amount = _amount;

        strike = _strike;

        expiration = _expiration;

        durationExerciseAfterExpiration = _durationExerciseAfterExpiration;

        premiumToken = _premiumToken;
        premium = _premium;

        auctionDeadline = _auctionDeadline;

        optionType = _optionType;

        writer = msg.sender;

        optionState = OptionState.Created;
    }

    /// @notice buyer exercise his option = sell the x amount of underlyingToken
    function exerciseOption() external {
        if (optionState != OptionState.Bought) revert Forbidden();

        if (msg.sender != buyer) revert Forbidden();

        uint256 m_expiration = expiration;

        if (optionType == OptionType.European) {
            if (block.timestamp <= m_expiration) revert Expired();
        }
        if (block.timestamp <= auctionDeadline) revert Forbidden();
        if (block.timestamp > m_expiration + durationExerciseAfterExpiration)
            revert Forbidden();

        address m_underlyingToken = underlyingToken;

        uint256 underlyingDecimals = ERC20(m_underlyingToken).decimals();

        uint256 m_amount = amount;

        // buyer sell the underlying asset to writer
        bool success = IERC20(m_underlyingToken).transferFrom(
            msg.sender,
            writer,
            m_amount
        );
        if (!success) revert TransferFailed();

        // transfer compensation to option buyer
        success = STABLE.transfer(
            msg.sender,
            (strike * m_amount) / 10**(underlyingDecimals)
        );
        if (!success) revert TransferFailed();

        optionState = OptionState.Exercised;
    }
}
