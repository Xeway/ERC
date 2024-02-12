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
  STRIKE,
  ZERO_ADDRESS,
} = require("./Option_Globals");

describe("Retrieving expired tokens", function () {
  it("Should retrieve the non-exercised tokens (all) of call option", async function () {
    const { callOption, optionContract, token1, acct1 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.emit(optionContract, "Expired");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.writer).to.equal(ZERO_ADDRESS);
  });

  it("Should retrieve the non-exercised tokens (all) of put option", async function () {
    const { putOption, optionContract, token2, acct1 } = await loadFixture(deployInfraFixture);

    await token2.connect(acct1).approve(optionContract.target, STRIKE);

    await expect(optionContract.connect(acct1).create(putOption)).to.emit(optionContract, "Created");

    expect(await token2.balanceOf(optionContract.target)).to.equal(STRIKE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - STRIKE);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.emit(optionContract, "Expired");

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.writer).to.equal(ZERO_ADDRESS);
  });

  it("Should retrieve the non-exercised tokens of call contract", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");

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
    expect(option.writer).to.equal(ZERO_ADDRESS);
  });

  it("Should retrieve the non-exercised tokens of put contract", async function () {
    const { putOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token2.connect(acct1).approve(optionContract.target, STRIKE);
    await expect(optionContract.connect(acct1).create(putOption)).to.emit(optionContract, "Created");

    expect(await token2.balanceOf(optionContract.target)).to.equal(STRIKE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - STRIKE);

    const boughtOptions = Math.ceil(OPTION_COUNT / 6);
    const premiumPaidModulo = (boughtOptions * PREMIUM) % OPTION_COUNT;
    let premiumPaid = Math.floor((boughtOptions * PREMIUM) / OPTION_COUNT);
    if (premiumPaidModulo > 0) {
      premiumPaid += 1;
    }

    const totalStrikePriceModulo = (boughtOptions * putOption.strike) % OPTION_COUNT;
    let totalStrikePrice = Math.floor((boughtOptions * putOption.strike) / OPTION_COUNT);

    if (totalStrikePriceModulo > 0) {
      totalStrikePrice--;
    }

    await token1.connect(acct2).approve(optionContract.target, boughtOptions);
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");

    const exercisableOptions = await optionContract.balanceOf(acct2.address, 0);
    await expect(optionContract.connect(acct2).exercise(0, exercisableOptions)).to.emit(optionContract, "Exercised");

    expect(await token2.balanceOf(optionContract.target)).to.equal(STRIKE - totalStrikePrice);    
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE + boughtOptions);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE - boughtOptions);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid - STRIKE);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid + totalStrikePrice);
    
    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.emit(optionContract, "Expired");

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - totalStrikePrice + premiumPaid);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.writer).to.equal(ZERO_ADDRESS);
  });

  it("Should fail to retrieve tokens since no issuance exists", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.be.revertedWith("writer");
  });

  it("Should fail to retrieve tokens since retriever is not the writer", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct2).retrieveExpiredTokens(0)).to.be.revertedWith("writer");
  });

  it("Should fail to retrieve tokens since exercise window is still open", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await expect(optionContract.connect(acct1).retrieveExpiredTokens(0)).to.be.revertedWith("exerciseWindowEnd");
  });
});
