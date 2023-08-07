// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken2 is ERC20 {
    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC20("MockToken2", "MOCK2") {}

    // Anyone can mint some MOCK2 for themselves
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    // To match USDC decimal count
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
