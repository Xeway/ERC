// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
        bool allAllowedToBuy;
    }

    mapping(uint256 => OptionIssuance) issuance;
    mapping(uint256 => EnumerableSet.AddressSet) allowedBuyers;
    uint256 issuanceCounter;

    constructor() ERC1155("") ReentrancyGuard() {}

    function create(
        VanillaOptionData memory optionData,
        address[] calldata allowedBuyerAddresses
    ) external nonReentrant returns (uint256) {
        require(optionData.buyingWindowEnd > block.timestamp);
        require(optionData.exerciseWindowEnd > block.timestamp);

        OptionIssuance memory newIssuance;
        newIssuance.data = optionData;
        newIssuance.seller = _msgSender();
        newIssuance.state = State.Active;
        newIssuance.allAllowedToBuy = allowedBuyerAddresses.length == 0;

        if (allowedBuyerAddresses.length > 0) {
            for (uint i = 0; i < allowedBuyerAddresses.length; i++) {
                allowedBuyers[issuanceCounter].add(allowedBuyerAddresses[i]);
            }
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
        require(issuance[id].state == State.Active);
        require(block.timestamp <= issuance[id].data.buyingWindowEnd);
        require(issuance[id].allAllowedToBuy || allowedBuyers[id].contains(_msgSender()));
        require(amount >= issuance[id].data.minBuyingLot);

        uint256 buyerOptionCount = Math.min(amount, issuance[id].data.amount - issuance[id].soldOptions);

        require(buyerOptionCount > 0);
        require(!mustCompletelyFill || buyerOptionCount == amount);

        if (issuance[id].data.premium > 0) {
            uint256 premiumPaid = (buyerOptionCount * issuance[id].data.premium) / issuance[id].data.amount;
            require(premiumPaid > 0);

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
        require(amount > 0);
        require(issuance[id].state == State.Active);
        require(
            block.timestamp >= issuance[id].data.exerciseWindowStart &&
                block.timestamp <= issuance[id].data.exerciseWindowEnd
        );
        require(balanceOf(_msgSender(), id) >= amount);

        IERC20 underlyingToken = IERC20(issuance[id].data.underlyingToken);
        IERC20 strikeToken = IERC20(issuance[id].data.strikeToken);
        uint256 underlyingDecimals = underlyingToken.decimals();

        uint256 transferredStrikeTokens = (issuance[id].data.strike * amount) / 10 ** underlyingDecimals;
        require(transferredStrikeTokens > 0);
        if (issuance[id].data.side == Side.Call) {
            // buyer pay writer for the underlying token(s) at strike price
            _transferFrom(strikeToken, _msgSender(), issuance[id].seller, transferredStrikeTokens);

            // transfer underlying token(s) to buyer
            _transfer(underlyingToken, _msgSender(), amount);
        } else {
            // buyer transfer the underlying token(s) to writer
            _transferFrom(underlyingToken, _msgSender(), issuance[id].seller, amount);

            // pay buyer at strike price
            _transfer(strikeToken, _msgSender(), transferredStrikeTokens);
        }

        // Burn used option tokens
        _burn(_msgSender(), id, amount);
        issuance[id].exercisedOptions += amount;

        emit Exercised(id, amount, block.timestamp);
    }

    function retrieveExpiredTokens(uint256 id) external nonReentrant {
        require(issuance[id].state == State.Active);
        require(_msgSender() == issuance[id].seller);
        require(block.timestamp > issuance[id].data.exerciseWindowEnd);

        if (issuance[id].data.amount > issuance[id].exercisedOptions) {
            uint256 underlyingTokenGiveback = issuance[id].data.amount - issuance[id].exercisedOptions;
            _transfer(IERC20(issuance[id].data.underlyingToken), _msgSender(), underlyingTokenGiveback);
        }

        _deleteData(id);
        emit Expired(id, block.timestamp);
    }

    function cancel(uint256 id) external nonReentrant {
        require(issuance[id].state == State.Active);
        require(_msgSender() == issuance[id].seller);
        require(issuance[id].soldOptions == 0);

        _transfer(IERC20(issuance[id].data.underlyingToken), _msgSender(), issuance[id].data.amount);

        _deleteData(id);
        emit Canceled(id, block.timestamp);
    }

    function _deleteData(uint256 id) internal {
        if (!issuance[id].allAllowedToBuy) {
            while (allowedBuyers[id].length() > 0) {
                allowedBuyers[id].remove(allowedBuyers[id].at(0));
            }
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
