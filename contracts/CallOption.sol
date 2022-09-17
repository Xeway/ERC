// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./tokens/WETH.sol";
import "./tokens/IWETH.sol";

contract CallOption {
    /// @notice underlyingToken the underlying token
    /// @dev if underlyingToken == address(0), native currency is the underlying asset
    address public underlyingToken;

    /// @notice the amount of the underlying asset
    uint256 public amount;

    /// @notice strike price determined according to the stable coin decimals
    // ex: my strike price is $2500 in USDC (6 decimals)
    // so strike = 2500*(10**6) = 2500000000
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

    address public writer;
    address public buyer;

    enum OptionState {
        Created,
        Bought,
        Exercised,
        Expired
    }

    OptionState public optionState;

    /// @notice WETH token
    /// @dev if in the constructor _underlyingToken or _premiumToken == address(0)
    /// then we check if _WETHAddr == address(0). If so, we create a new WETH token
    IWETH public WETH;

    /// @notice stable coin used to pay to the writer when buyer exercise option
    /// @dev buyer will pay amount * strike (ex: 2 ETH * 3000 USD = 6000 USD in DAI)
    IERC20 public STABLE;

    /// @notice bids keep track of all the bids for each bidders
    mapping(address => uint256) public bids;
    /// @dev bidders used to loop over bids
    address[] bidders;

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
        address _WETHAddress,
        address _STABLEAddress
    ) payable {
        // the underlying token and the stablecoin cannot be the same
        if (
            _underlyingToken == _STABLEAddress && _underlyingToken != address(0)
        ) {
            revert InvalidValue();
        }

        if (
            _underlyingToken == address(0) ||
            _premiumToken == address(0) ||
            _STABLEAddress == address(0)
        ) {
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

        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        // if no stablecoin address is provided,
        // stablecoin is set to DAI
        // if the contract is not in one of the chains listed bellow,
        // then it will revert
        if (_STABLEAddress == address(0)) {
            if (chainId == 1) {
                //Mainnet
                STABLE = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
            } else if (chainId == 56) {
                // Binance smart chain
                STABLE = IERC20(0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3);
            } else if (chainId == 137) {
                // Polygon
                STABLE = IERC20(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063);
            } else if (chainId == 43114) {
                // Avalanche
                STABLE = IERC20(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);
            } else if (chainId == 10) {
                // Optimism
                STABLE = IERC20(0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1);
            } else if (chainId == 42161) {
                // Arbitrum
                STABLE = IERC20(0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1);
            } else if (chainId == 250) {
                // Fantom
                STABLE = IERC20(0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E);
            } else {
                // if (...), this means that WETH has been set to _underlyingToken
                // so STABLE can't be the same coin
                if (_underlyingToken == address(0) || _amount == 0) {
                    revert InvalidValue();
                } else {
                    STABLE = IERC20(address(WETH));
                }
            }
        } else {
            STABLE = IERC20(_STABLEAddress);
        }

        writer = msg.sender;

        optionState = OptionState.Created;
    }

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
        if (block.timestamp >= expiration) revert Forbidden();

        bool success = IERC20(premiumToken).transferFrom(
            msg.sender,
            writer,
            premium
        );
        if (!success) revert TransferFailed();

        buyer = msg.sender;

        optionState = OptionState.Bought;
    }

    /// @notice buyer exercise his option = receive the x amount of underlyingToken
    function exerciseOption() external {
        if (optionState != OptionState.Bought) revert Forbidden();

        if (msg.sender != buyer) revert Forbidden();

        uint256 m_expiration = expiration;

        if (block.timestamp > m_expiration) revert Expired();
        if (block.timestamp <= auctionDeadline) revert Forbidden();
        if (block.timestamp > m_expiration + durationExerciseAfterExpiration)
            revert Forbidden();

        address m_underlyingToken = underlyingToken;

        uint256 underlyingDecimals = ERC20(m_underlyingToken).decimals();

        uint256 m_amount = amount;

        // buyer give buy the undelying asset at price `strike`
        bool success = STABLE.transferFrom(
            msg.sender,
            writer,
            (strike * m_amount) / 10**(underlyingDecimals)
        );
        if (!success) revert TransferFailed();

        // transfer funds to buyer
        success = IERC20(m_underlyingToken).transfer(msg.sender, m_amount);
        if (!success) revert TransferFailed();

        optionState = OptionState.Exercised;
    }

    /// @notice if buyer hasn't exercised his option during the period 'durationExerciseAfterExpiration',
    /// writer can retrieve their funds
    function retrieveExpiredTokens() external {
        OptionState m_optionState = optionState;

        if (
            m_optionState != OptionState.Bought &&
            m_optionState != OptionState.Created
        ) revert Forbidden();

        address m_writer = writer;

        if (msg.sender != m_writer) revert Forbidden();

        // if no one bought this option, the writer can retrieve their tokens as soon as it expires
        if (m_optionState == OptionState.Created) {
            if (block.timestamp <= expiration) revert Forbidden();
        } else {
            if (block.timestamp <= expiration + durationExerciseAfterExpiration)
                revert Forbidden();
        }

        bool success = IERC20(underlyingToken).transfer(m_writer, amount);
        if (!success) revert TransferFailed();

        optionState = OptionState.Expired;
    }

    /*
     *
     * Utility functions
     *
     */

    /// @notice give x amount of native currency, and receive x amount of wrapped native currency
    function wrapToken() external payable {
        WETH.deposit{value: msg.value}();

        bool success = WETH.transfer(msg.sender, msg.value);
        if (!success) revert TransferFailed();
    }

    /// @notice give x amount of wrapped native currency, and receive x amount of native currency
    /// @param _amount wrapped native currency amount to swap
    function unWrapToken(uint256 _amount) external {
        bool success = WETH.transferFrom(msg.sender, address(this), _amount);
        if (!success) revert TransferFailed();

        WETH.withdraw(_amount);

        (success, ) = payable(msg.sender).call{value: _amount}("");
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
            uint256,
            uint256,
            uint256,
            address,
            uint256,
            uint256,
            address,
            address,
            OptionState,
            address,
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

            } lt(i, 0x1A0) {
                // 0x1A0 == 416 == number of slots (= variables stored) * 32 bytes == 13 * 32
                i := add(i, 0x20)
                j := add(j, 0x01)
            } {
                mstore(
                    add(freeMemPointer, i),
                    sload(add(underlyingToken.slot, j))
                ) // underlyingToken.slot == 0
            }

            return(freeMemPointer, i) // i == 0x1A0 == add(add(freeMemPointer, i), 0x20)
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
            address(WETH),
            address(STABLE)
        ); */
    }
}
