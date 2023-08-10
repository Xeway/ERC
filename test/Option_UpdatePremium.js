const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
  PREMIUM,
  ZERO_ADDRESS,
} = require("./Option_Globals");

describe("Updating option premium", function () {
  it("Should update premium successfully", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions, false)).to.emit(optionContract, "Bought");

    await optionContract.connect(acct1).updatePremium(0, callOption.premium * 2);

    await token2.connect(acct2).approve(optionContract.target, premiumPaid * 2);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions, false)).to.emit(optionContract, "Bought");

    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid * 3);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid * 3);
    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions * 2);
  });

  it("Should fail to update since no issuance exists", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct1).updatePremium(0, 1)).to.be.revertedWith("seller");
  });

  it("Should fail to update premium since the updater is not the seller", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    await expect(optionContract.connect(acct2).updatePremium(0, 1)).to.be.revertedWith("seller");
  });
});
