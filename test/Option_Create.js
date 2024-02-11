const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
} = require("./Option_Globals");

describe("Creation", function () {
  it("Should correctly create a call option", async function () {
    const { callOption, optionContract, token1, acct1 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(acct1.address);
    expect(option.exercisedAmount).to.equal(0);
    expect(option.soldAmount).to.equal(0);
    expect(option.data.side).to.equal(callOption.side);
    expect(option.data.underlyingToken).to.equal(callOption.underlyingToken);
    expect(option.data.amount).to.equal(callOption.amount);
    expect(option.data.strikeToken).to.equal(callOption.strikeToken);
    expect(option.data.strike).to.equal(callOption.strike);
    expect(option.data.premiumToken).to.equal(callOption.premiumToken);
    expect(option.data.premium).to.equal(callOption.premium);
    expect(option.data.exerciseWindowStart).to.equal(callOption.exerciseWindowStart);
    expect(option.data.exerciseWindowEnd).to.equal(callOption.exerciseWindowEnd);
    expect(option.data.minBuyingLot).to.equal(callOption.minBuyingLot);
    expect(option.data.renounceable).to.equal(callOption.renounceable);

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
  });

  it("Should correctly create a put option", async function () {
    const { putOption, optionContract, token2, acct1 } = await loadFixture(deployInfraFixture);

    const TOTAL_UNDERLYING_PRICE = (OPTION_COUNT * STRIKE) / 10 ** 6;
    await token2.connect(acct1).approve(optionContract.target, TOTAL_UNDERLYING_PRICE);

    await expect(optionContract.connect(acct1).create(putOption)).to.emit(optionContract, "Created");

    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(acct1.address);
    expect(option.exercisedAmount).to.equal(0);
    expect(option.soldAmount).to.equal(0);
    expect(option.data.side).to.equal(1);
    expect(option.data.underlyingToken).to.equal(putOption.underlyingToken);
    expect(option.data.amount).to.equal(putOption.amount);
    expect(option.data.strikeToken).to.equal(putOption.strikeToken);
    expect(option.data.strike).to.equal(putOption.strike);
    expect(option.data.premiumToken).to.equal(putOption.premiumToken);
    expect(option.data.premium).to.equal(putOption.premium);
    expect(option.data.exerciseWindowStart).to.equal(putOption.exerciseWindowStart);
    expect(option.data.exerciseWindowEnd).to.equal(putOption.exerciseWindowEnd);
    expect(option.data.minBuyingLot).to.equal(putOption.minBuyingLot);
    expect(option.data.renounceable).to.equal(putOption.renounceable);

    expect(await token2.balanceOf(optionContract.target)).to.equal(TOTAL_UNDERLYING_PRICE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - TOTAL_UNDERLYING_PRICE);
  });

  it("Should fail to create an option because times are wrong", async function () {
    const { callOption, optionContract, token1, acct1, currentTime } = await loadFixture(deployInfraFixture);
    const OPTION_COUNT = 1 * 10 ** 6;

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    const optionData = {
      ...callOption,
      exerciseWindowEnd: currentTime,
    };
    await expect(optionContract.connect(acct1).create(optionData)).to.be.revertedWith("exerciseWindowEnd");
  });

  it("Should fail to create an option because token transfer is not approved", async function () {
    const { callOption, optionContract, acct1 } = await loadFixture(deployInfraFixture);

    await expect(optionContract.connect(acct1).create(callOption)).to.be.revertedWith("ERC20: insufficient allowance");
  });
});
