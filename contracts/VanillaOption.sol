// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IVanillaOption } from "./interfaces/IVanillaOption.sol";
import { IERC20Metadata as IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract VanillaOption is IVanillaOption, ERC1155, ReentrancyGuard {
    struct OptionIssuance {
        VanillaOptionData data;
        address seller;
        uint256 exercisedOptions;
        uint256 soldOptions;
    }

    mapping(uint256 => OptionIssuance) public issuance;
    uint256 public issuanceCounter;

    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC1155("") ReentrancyGuard() {}

    function create(
        VanillaOptionData memory optionData
    ) external nonReentrant returns (uint256) {
        require(optionData.exerciseWindowEnd > block.timestamp, "exerciseWindowEnd");

        OptionIssuance memory newIssuance;
        newIssuance.data = optionData;
        newIssuance.seller = _msgSender();

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
        emit Created(issuanceCounter - 1);

        return issuanceCounter - 1;
    }

    function buy(uint256 id, uint256 amount) external nonReentrant {
        require(block.timestamp <= issuance[id].data.exerciseWindowEnd, "exceriseWindowEnd");
        require(issuance[id].data.amount - issuance[id].soldOptions >= amount, "amount");        
        require(amount > 0, "buyerOptionCount");
        
        if (issuance[id].data.premium > 0) {
            uint256 remainder = (amount * issuance[id].data.premium) % issuance[id].data.amount;              
            uint256 premiumPaid = (amount * issuance[id].data.premium) / issuance[id].data.amount;
            if (remainder > 0) { premiumPaid += 1; }

            bool success = IERC20(issuance[id].data.premiumToken).transferFrom(
                _msgSender(),
                issuance[id].seller,
                premiumPaid
            );
            if (!success) revert("Transfer Failed");
        }

        issuance[id].soldOptions += amount;
        _mint(_msgSender(), id, amount, bytes(""));
        emit Bought(id, amount, _msgSender());
    }

    function exercise(uint256 id, uint256 amount) external nonReentrant {
        require(amount > 0, "amount");
        require(
            block.timestamp >= issuance[id].data.exerciseWindowStart &&
                block.timestamp <= issuance[id].data.exerciseWindowEnd,
            "timestamp"
        );
        require(balanceOf(_msgSender(), id) >= amount, "balance");

        IERC20 underlyingToken = IERC20(issuance[id].data.underlyingToken);
        IERC20 strikeToken = IERC20(issuance[id].data.strikeToken);

        uint256 remainder = (amount * issuance[id].data.strike) % issuance[id].data.amount;              
        uint256 transferredStrikeTokens = (amount * issuance[id].data.strike) / issuance[id].data.amount;        

        if (remainder > 0) {
            if (issuance[id].data.side == Side.Call) {
                transferredStrikeTokens += 1;
            } else {
                if (transferredStrikeTokens > 0) {
                    transferredStrikeTokens--;
                }                                
            }
        }     

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

        emit Exercised(id, amount);
    }

    function retrieveExpiredTokens(uint256 id) external nonReentrant {
        require(_msgSender() == issuance[id].seller, "seller");
        require(block.timestamp > issuance[id].data.exerciseWindowEnd, "exerciseWindowEnd");

        if (issuance[id].data.amount > issuance[id].exercisedOptions) {
            uint256 underlyingTokenGiveback = issuance[id].data.amount - issuance[id].exercisedOptions;
            _transfer(IERC20(issuance[id].data.underlyingToken), _msgSender(), underlyingTokenGiveback);
        }

        delete issuance[id];
        emit Expired(id);
    }

    function cancel(uint256 id) external nonReentrant {
        require(_msgSender() == issuance[id].seller, "seller");
        require(issuance[id].soldOptions == 0, "soldOptions");

        _transfer(IERC20(issuance[id].data.underlyingToken), _msgSender(), issuance[id].data.amount);

        delete issuance[id];
        emit Canceled(id);
    }

    function updatePremium(uint256 id, uint256 amount) external nonReentrant {
        require(_msgSender() == issuance[id].seller, "seller");
        issuance[id].data.premium = amount;
        emit PremiumUpdated(id, amount);
    }

    function _transfer(IERC20 token, address to, uint256 amount) internal {
        bool success = token.transfer(to, amount);
        if (!success) revert("Transfer failed");
    }

    function _transferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bool success = token.transferFrom(from, to, amount);
        if (!success) revert("Transfer failed");
    }

    function _mint(address to, uint256 id, uint256 amount, bytes memory data) internal override {
        super._mint(to, id, amount, data);
    }

    function _burn(address from, uint256 id, uint256 amount) internal override {
        super._burn(from, id, amount);
    }    
}
