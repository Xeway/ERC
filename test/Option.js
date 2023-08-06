const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Option", function () {
  async function deployInfraFixture() {
    const [owner, acct1, acct2] = await ethers.getSigners();

    const vanillaOption = await ethers.deployContract("VanillaOption");
    const token1 = await ethers.deployContract("MockToken1");
    const token2 = await ethers.deployContract("MockToken2");

    return { option: vanillaOption, token1: token1, token2: token2, accounts: [owner, acct1, acct2] };
  }

  describe("Creation", function () {
    it("Should create a new option contract", async function () {
      const vars = await loadFixture(deployInfraFixture);
      const optionContract = vars.option;

      expect(await optionContract.issuanceCounter()).to.equal(0);
    });
  });
});
