const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
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

describe("Canceling", function () {
  it("Should cancel the call option contract and return the underlying to seller", async function () {
    const { callOption, optionContract, token1, acct1 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await expect(optionContract.connect(acct1).cancel(0)).to.emit(optionContract, "Canceled");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
  });

  it("Should cancel the put option contract and return the underlying to seller", async function() {
    const { putOption, optionContract, token2, acct1 } = await loadFixture(deployInfraFixture);

    await token2.connect(acct1).approve(optionContract.target, STRIKE);

    await expect(optionContract.connect(acct1).create(putOption)).to.emit(optionContract, "Created");

    expect(await token2.balanceOf(optionContract.target)).to.equal(STRIKE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - STRIKE);

    await expect(optionContract.connect(acct1).cancel(0)).to.emit(optionContract, "Canceled");

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
  });

  it("Should fail to cancel the option contract since option(s) are already bought", async function () {
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

    await expect(optionContract.connect(acct1).cancel(0)).to.be.revertedWith("soldAmount");

    const option = await optionContract.issuance(0);
    expect(option.seller).to.not.equal(ZERO_ADDRESS);
  });

  it("Should fail to cancel since no issuance exists", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct1).cancel(0)).to.be.revertedWith("seller");
  });

  it("Should fail to cancel since the canceling party is not the seller", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await expect(optionContract.connect(acct2).cancel(0)).to.be.revertedWith("seller");
  });
});
