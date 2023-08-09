// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IVanillaOption } from "./interfaces/IVanillaOption.sol";
import { IERC20Metadata as IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract VanillaOption is IVanillaOption, ERC1155, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    error TransferFailed();
    error CannotTransferTokens();

    enum State {
        Invalid,
        Active
    }

    struct OptionIssuance {
        VanillaOptionData data;
        address seller;
        uint256 exercisedOptions;
        uint256 soldOptions;
        State state;
    }

    mapping(uint256 => OptionIssuance) public issuance;
    uint256 public issuanceCounter;

    mapping(uint256 => EnumerableSet.AddressSet) private _allowedBuyers;

    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC1155("") ReentrancyGuard() {}

    function create(
        VanillaOptionData memory optionData,
        address[] calldata allowedBuyerAddresses
    ) external nonReentrant returns (uint256) {
        require(optionData.exerciseWindowEnd > block.timestamp, "exerciseWindowEnd");

        OptionIssuance memory newIssuance;
        newIssuance.data = optionData;
        newIssuance.seller = _msgSender();
        newIssuance.state = State.Active;

        for (uint i = 0; i < allowedBuyerAddresses.length; i++) {
            _allowedBuyers[issuanceCounter].add(allowedBuyerAddresses[i]);
        }

        IERC20 underlyingToken = IERC20(optionData.underlyingToken);
        if (optionData.side == Side.Call) {
            _transferFrom(underlyingToken, _msgSender(), address(this), optionData.amount);
        } else {
            _transferFrom(
                IERC20(optionData.strikeToken),
                _msgSender(),
                address(this),
                (optionData.strike * optionData.amount) / 10 ** underlyingToken.decimals()
            );
        }

        issuance[issuanceCounter++] = newIssuance;
        emit Created(issuanceCounter - 1, block.timestamp);

        return issuanceCounter - 1;
    }

    function buy(uint256 id, uint256 amount, bool mustCompletelyFill) external nonReentrant {
        require(issuance[id].state == State.Active, "state");
        require(block.timestamp <= issuance[id].data.exerciseWindowEnd, "exceriseWindowEnd");
        require(_allowedBuyers[id].length() == 0 || _allowedBuyers[id].contains(_msgSender()), "allowedBuyers");
        require(amount >= issuance[id].data.minBuyingLot, "minBuyingLot");

        uint256 buyerOptionCount = Math.min(amount, issuance[id].data.amount - issuance[id].soldOptions);

        require(buyerOptionCount > 0, "buyerOptionCount");
        require(!mustCompletelyFill || buyerOptionCount == amount, "mustCompletelyFill");

        if (issuance[id].data.premium > 0) {
            uint256 remainder = (buyerOptionCount * issuance[id].data.premium) % issuance[id].data.amount;  
            // Adjust the amount of options being bought when modulo is not zero
            buyerOptionCount -= remainder / issuance[id].data.premium;
            uint256 premiumPaid = (buyerOptionCount * issuance[id].data.premium) / issuance[id].data.amount;
            require(premiumPaid > 0, "premiumPaid");

            bool success = IERC20(issuance[id].data.premiumToken).transferFrom(
                _msgSender(),
                issuance[id].seller,
                premiumPaid
            );
            if (!success) revert TransferFailed();
        }

        issuance[id].soldOptions += buyerOptionCount;
        _mint(_msgSender(), id, buyerOptionCount, bytes(""));
        emit Bought(id, buyerOptionCount, _msgSender(), block.timestamp);
    }

    function exercise(uint256 id, uint256 amount) external nonReentrant {
        require(amount > 0, "amount");
        require(issuance[id].state == State.Active, "state");
        require(
            block.timestamp >= issuance[id].data.exerciseWindowStart &&
                block.timestamp <= issuance[id].data.exerciseWindowEnd,
            "timestamp"
        );
        require(balanceOf(_msgSender(), id) >= amount, "balance");

        IERC20 underlyingToken = IERC20(issuance[id].data.underlyingToken);
        IERC20 strikeToken = IERC20(issuance[id].data.strikeToken);
        uint256 underlyingDecimals = 10 ** underlyingToken.decimals();

        uint256 remainder = (issuance[id].data.strike * amount) % underlyingDecimals;            
        amount -= remainder / issuance[id].data.strike;
        uint256 transferredStrikeTokens = (issuance[id].data.strike * amount) / underlyingDecimals;
        require(transferredStrikeTokens > 0, "transferredStrikeTokens");
        if (issuance[id].data.side == Side.Call) {
            // Buyer pays seller for the underlying token(s) at strike price
            _transferFrom(strikeToken, _msgSender(), issuance[id].seller, transferredStrikeTokens);

            // Transfer underlying token(s) to buyer
            _transfer(underlyingToken, _msgSender(), amount);
        } else {
            // Buyer transfers the underlying token(s) to writer
            _transferFrom(underlyingToken, _msgSender(), issuance[id].seller, amount);

            // Pay buyer the strike price
            _transfer(strikeToken, _msgSender(), transferredStrikeTokens);
        }

        // Burn used option tokens
        _burn(_msgSender(), id, amount);
        issuance[id].exercisedOptions += amount;

        emit Exercised(id, amount, block.timestamp);
    }

    function retrieveExpiredTokens(uint256 id) external nonReentrant {
        require(issuance[id].state == State.Active, "state");
        require(_msgSender() == issuance[id].seller, "seller");
        require(block.timestamp > issuance[id].data.exerciseWindowEnd, "exerciseWindowEnd");

        if (issuance[id].data.amount > issuance[id].exercisedOptions) {
            uint256 underlyingTokenGiveback = issuance[id].data.amount - issuance[id].exercisedOptions;
            _transfer(IERC20(issuance[id].data.underlyingToken), _msgSender(), underlyingTokenGiveback);
        }

        _deleteData(id);
        emit Expired(id, block.timestamp);
    }

    function cancel(uint256 id) external nonReentrant {
        require(issuance[id].state == State.Active, "state");
        require(_msgSender() == issuance[id].seller, "seller");
        require(issuance[id].soldOptions == 0, "soldOptions");

        _transfer(IERC20(issuance[id].data.underlyingToken), _msgSender(), issuance[id].data.amount);

        _deleteData(id);
        emit Canceled(id, block.timestamp);
    }

    function updatePremium(uint256 id, uint256 amount) external nonReentrant {
        require(_msgSender() == issuance[id].seller, "seller");
        issuance[id].data.premium = amount;
    }

    function _deleteData(uint256 id) internal {
        while (_allowedBuyers[id].length() > 0) {
            _allowedBuyers[id].remove(_allowedBuyers[id].at(_allowedBuyers[id].length() - 1));
        }

        delete issuance[id];
    }

    function _transfer(IERC20 token, address to, uint256 amount) internal {
        bool success = token.transfer(to, amount);
        if (!success) revert TransferFailed();
    }

    function _transferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bool success = token.transferFrom(from, to, amount);
        if (!success) revert TransferFailed();
    }

    function _mint(address to, uint256 id, uint256 amount, bytes memory data) internal override {
        super._mint(to, id, amount, data);
    }

    function _burn(address from, uint256 id, uint256 amount) internal override {
        super._burn(from, id, amount);
    }

    function _beforeTokenTransfer(
        address /*operator*/,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory /*amounts*/,
        bytes memory /*data*/
    ) internal view override {
        for (uint i = 0; i < ids.length; i++) {
            if (!issuance[i].data.renounceable) {
                // If the options are non-renoncueable then only mint and burn operations are allowed
                if (from != address(0) && to != address(0)) {
                    revert CannotTransferTokens();
                }
            }
        }
    }
}
