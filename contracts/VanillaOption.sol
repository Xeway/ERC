// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IVanillaOption} from "./interfaces/IVanillaOption.sol";
import {IERC20Metadata as IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VanillaOption is IVanillaOption, ERC1155, ReentrancyGuard {
    error TransferFailed();

    enum State {
        Invalid,
        Active,
        Expired
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
    mapping(uint256 => mapping(address => bool)) allowedBuyers;
    uint256 issuanceCounter;

    constructor() ERC1155("") {}

    function create(
        VanillaOptionData memory optionData,
        address[] calldata allowedBuyerAddresses
    ) external nonReentrant returns (uint256) {
        require(optionData.buyingWindowEnd > block.timestamp);
        require(optionData.exerciseWindowEnd > block.timestamp);

        OptionIssuance memory newIssuance;
        newIssuance.data = optionData;
        newIssuance.seller = tx.origin;
        newIssuance.state = State.Active;
        newIssuance.allAllowedToBuy = allowedBuyerAddresses.length == 0;

        if (allowedBuyerAddresses.length > 0) {
            for (uint i = 0; i < allowedBuyerAddresses.length; i++) {
                allowedBuyers[issuanceCounter][allowedBuyerAddresses[i]] = true;
            }
        }

        IERC20 underlyingToken = IERC20(optionData.underlyingToken);
        if (optionData.side == Side.Call) {
            _transferFrom(
                underlyingToken,
                tx.origin,
                address(this),
                optionData.amount
            );
        } else {
            _transferFrom(
                IERC20(optionData.strikeToken),
                tx.origin,
                address(this),
                (optionData.strike * optionData.amount) /
                    10 ** underlyingToken.decimals()
            );
        }

        issuance[issuanceCounter++] = newIssuance;
        emit Created(issuanceCounter - 1, block.timestamp);

        return issuanceCounter - 1;
    }

    function buy(
        uint256 id,
        uint256 amount,
        bool mustCompletelyFill
    ) external nonReentrant {
        require(issuance[id].state == State.Active);
        require(block.timestamp <= issuance[id].data.buyingWindowEnd);
        require(issuance[id].allAllowedToBuy || allowedBuyers[id][tx.origin]);

        uint256 buyerOptionCount = Math.min(
            amount,
            issuance[id].data.amount - issuance[id].soldOptions
        );

        require(buyerOptionCount > 0);
        require(!mustCompletelyFill || buyerOptionCount == amount);
        require(
            !issuance[id].data.forceToBuyAllOptions ||
                amount >= issuance[id].data.amount
        );

        if (issuance[id].data.premium > 0) {
            uint256 premiumPaid = (buyerOptionCount *
                issuance[id].data.premium) / issuance[id].data.amount;
            require(premiumPaid > 0);

            bool success = IERC20(issuance[id].data.premiumToken).transferFrom(
                tx.origin,
                issuance[id].seller,
                premiumPaid
            );
            if (!success) revert TransferFailed();
        }

        issuance[id].soldOptions += buyerOptionCount;
        _mint(tx.origin, id, buyerOptionCount, bytes(""));
        emit Bought(id, buyerOptionCount, tx.origin, block.timestamp);
    }

    function exercise(
        uint256 id,
        uint256 amount
    ) external nonReentrant returns (bool) {}

    function retrieveExpiredTokens(
        uint256 id
    ) external nonReentrant returns (bool) {}

    function cancel(uint256 id) external nonReentrant returns (bool) {}

    function _transfer(IERC20 token, address to, uint256 amount) internal {
        bool success = token.transfer(to, amount);
        if (!success) revert TransferFailed();
    }

    function _transferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        bool success = token.transferFrom(from, to, amount);
        if (!success) revert TransferFailed();
    }

    function _mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal override {
        super._mint(to, id, amount, data);
    }
}
