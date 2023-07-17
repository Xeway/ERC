// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract Option is Ownable {
    //                  //
    //    ATTRIBUTES    //
    //                  //

    enum Side {
        Call,
        Put
    }
    Side internal _side;

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

    //                  //
    //      ERRORS      //
    //                  //

    error TransferFailed();
    error InsufficientAmount();
    error InvalidValue();
    error Expired();
    error NotExpired();
    error Forbidden();

    //                  //
    //   CONSTRUCTOR    //
    //                  //

    constructor (
        Side side_,
        address underlyingToken_,
        uint256 amount_,
        address quoteToken_,
        uint256 strike_,
        uint256 expiration_,
        uint256 durationExerciseAfterExpiration_,
        address premiumToken_,
        uint256 premium_,
        Type type_
    ) {
        if (
            underlyingToken_ == address(0) ||
            amount_ == 0 ||
            quoteToken_ == address(0) ||
            strike_ == 0 ||
            expiration_ <= block.timestamp ||
            durationExerciseAfterExpiration_ == 0 ||
            underlyingToken_ == quoteToken_ // the underlying token and the stablecoin cannot be the same
        ) {
            revert InvalidValue();
        }

        if (side_ == Side.Call) {
            _transferFrom(IERC20(underlyingToken_), _msgSender(), address(this), amount_);
        } else if (side_ == Side.Put) {
            uint256 underlyingDecimals = ERC20(underlyingToken_).decimals();
            _transferFrom(IERC20(quoteToken_), _msgSender(), address(this), (strike_ * amount_) / 10**(underlyingDecimals));
        }

        _side = side_;

        _underlyingToken = IERC20(underlyingToken_);
        _amount = amount_;

        _quoteToken = IERC20(quoteToken_);
        _strike = strike_;

        _expiration = expiration_;
        _durationExerciseAfterExpiration = durationExerciseAfterExpiration_;

        _premiumToken = IERC20(premiumToken_);
        _premium = premium_;

        _type = type_;

        _state = State.Created;
    }

    //                  //
    // PUBLIC FUNCTIONS //
    //                  //

    /// @notice buy option and give premium to writer
    function buy() external {
        if (_state != State.Created) revert Forbidden();
        if (block.timestamp > _expiration) revert Forbidden();

        if (_premium > 0 && address(_premiumToken) != address(0)) {
            bool success = _premiumToken.transferFrom(
                _msgSender(),
                owner(),
                _premium
            );
            if (!success) revert TransferFailed();
        }

        _buyer = _msgSender();
        _state = State.Bought;
    }

    /// @notice buyer exercise his option
    /// @notice if option is a call : buy _amount of _underlyingToken
    /// @notice if option is a put : sell _amount of _underlyingToken
    function exercise() external {
        if (_buyer != _msgSender()) revert Forbidden();

        if (_state != State.Bought) revert Forbidden();

        if (_type == Type.European && block.timestamp <= _expiration) {
            revert Forbidden();
        }
        if (block.timestamp > _expiration + _durationExerciseAfterExpiration) {
            revert Expired();
        }

        IERC20 m_underlyingToken = _underlyingToken;

        uint256 underlyingDecimals = ERC20(address(m_underlyingToken)).decimals();

        uint256 m_amount = _amount;

        if (_side == Side.Call) {
            // buyer buy the undelying asset to writer
            _transferFrom(_quoteToken, _msgSender(), owner(), (_strike * m_amount) / 10**(underlyingDecimals));

            // transfer compensation to option buyer
            _transfer(m_underlyingToken, _msgSender(), m_amount);
        } else if (_side == Side.Put) {
            // buyer sell the underlying asset to writer
            _transferFrom(m_underlyingToken, _msgSender(), owner(), m_amount);

            // transfer compensation to option buyer
            _transfer(_quoteToken, _msgSender(), (_strike * m_amount) / 10**(underlyingDecimals));
        }

        _state = State.Exercised;
    }

    /// @notice if buyer hasn't exercised his option during the _durationExerciseAfterExpiration period, writer can retrieve its funds
    function retrieveExpiredTokens() external onlyOwner {
        if (_state != State.Bought) revert Forbidden();

        if (block.timestamp <= _expiration + _durationExerciseAfterExpiration) revert NotExpired();

        _transfer(_underlyingToken, _msgSender(), _amount);

        _state = State.Expired;
    }

    /// @notice possibility to cancel the option and retrieve collateralized funds while no one bought the option
    function cancel() external onlyOwner {
        if (_state != State.Created) revert Forbidden();

        _transfer(_underlyingToken, _msgSender(), _amount);

        _state = State.Canceled;
    }

    //                   //
    // PRIVATE FUNCTIONS //
    //                   //

    function _transfer(IERC20 token_, address to_, uint256 amount_) internal {
        bool success = token_.transfer(to_, amount_);
        if (!success) revert TransferFailed();
    }

    function _transferFrom(IERC20 token_, address from_, address to_, uint256 amount_) internal {
        bool success = token_.transferFrom(from_, to_, amount_);
        if (!success) revert TransferFailed();
    }

    //                  //
    //      GETTERS     //
    //                  //

    function side() external view returns (Side) {
        return _side;
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
}
