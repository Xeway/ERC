// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken1 is ERC20 {
    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC20("MockToken1", "MOCK1") {}

    // Anyone can mint some MOCK1 for themselves
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    // To match USDC decimal count
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
