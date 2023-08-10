const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  PREMIUM,
  ZERO_ADDRESS,
} = require("./Option_Globals");

describe("Retrieving expired tokens", function () {
  it("Should retrieve the non-exercised tokens (all)", async function () {
    const { callOption, optionContract, token1, acct1, currentTime } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.emit(optionContract, "Expired");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
  });

  it("Should retrieve the non-exercised tokens", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions, false)).to.emit(optionContract, "Bought");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid);
    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);

    await expect(optionContract.connect(acct2).exercise(0, boughtOptions)).to.emit(optionContract, "Exercised");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT - boughtOptions);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE + boughtOptions);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid + totalStrikePrice);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid - totalStrikePrice);
    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(0);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.emit(optionContract, "Expired");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - boughtOptions);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
  });

  it("Should fail to retrieve tokens since no issuance exists", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.be.revertedWith("state");
  });

  it("Should fail to retrieve tokens since retriever is not the seller", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct2).retrieveExpiredTokens(0)).to.be.revertedWith("seller");
  });

  it("Should fail to retrieve tokens since exercise window is still open", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.be.revertedWith("exerciseWindowEnd");
  });
});
