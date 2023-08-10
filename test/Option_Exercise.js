const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
  PREMIUM,
} = require("./Option_Globals");

describe("Exercising", function () {
  it("Should successfully exercise call options", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

    const exercisableOptions = await optionContract.balanceOf(acct2.address, 0);
    await expect(optionContract.connect(acct2).exercise(0, exercisableOptions)).to.emit(optionContract, "Exercised");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT - OPTION_COUNT / 10);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE + OPTION_COUNT / 10);

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid + totalStrikePrice);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid - totalStrikePrice);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(0);
  });

  it("Should successfully exercise put options", async function () {
    const { putOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);

    const totalUnderlyingPrice = (OPTION_COUNT * STRIKE) / 10 ** 6;
    await token2.connect(acct1).approve(optionContract.target, totalUnderlyingPrice);
    await expect(optionContract.connect(acct1).create(putOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * putOption.strike) / TOKEN1_DECIMALS;
    await token1.connect(acct2).approve(optionContract.target, OPTION_COUNT / 10);
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

    const exercisableOptions = await optionContract.balanceOf(acct2.address, 0);
    await expect(optionContract.connect(acct2).exercise(0, exercisableOptions)).to.emit(optionContract, "Exercised");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE + boughtOptions);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE - boughtOptions);

    expect(await token2.balanceOf(optionContract.target)).to.equal(totalUnderlyingPrice - totalStrikePrice);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid - totalUnderlyingPrice);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid + totalStrikePrice);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(0);
  });

  it("Should fail to exercise option because amount is zero", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

    const exercisableOptions = await optionContract.balanceOf(acct2.address, 0);
    await expect(optionContract.connect(acct2).exercise(0, 0)).to.be.rejectedWith("amount");
  });

  it("Should fail to exercise option because there is no issuance", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct2).exercise(0, OPTION_COUNT)).to.be.rejectedWith("state");
  });

  it("Should fail to exercise option because exercise window is not yet open", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2, currentTime } = await loadFixture(
      deployInfraFixture
    );
    const callOption2 = {
      ...callOption,
      exerciseWindowStart: currentTime + 15 * 60,
    };
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption2, [])).to.emit(optionContract, "Created");
    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

    const exercisableOptions = await optionContract.balanceOf(acct2.address, 0);
    await expect(optionContract.connect(acct2).exercise(0, exercisableOptions)).to.revertedWith("timestamp");
  });

  it("Should fail to exercise option because exercise window is closed", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");
    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

    const exercisableOptions = await optionContract.balanceOf(acct2.address, 0);
    await time.increase(2 * 60 * 60);
    await expect(optionContract.connect(acct2).exercise(0, exercisableOptions)).to.revertedWith("timestamp");
  });

  it("Should adjust pricing for call because of the rounding of transferred tokens", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

    await expect(optionContract.connect(acct2).exercise(0, 1)).to.emit(optionContract, "Exercised");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT - 1);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE + 1);

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid + 1);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid - 1);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions - 1);
  });

  it("Should adjust pricing for put because of the rounding of transferred tokens", async function () {
    const { putOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);

    const totalUnderlyingPrice = (OPTION_COUNT * STRIKE) / 10 ** 6;
    await token2.connect(acct1).approve(optionContract.target, totalUnderlyingPrice);
    await expect(optionContract.connect(acct1).create(putOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * putOption.strike) / TOKEN1_DECIMALS;
    await token1.connect(acct2).approve(optionContract.target, OPTION_COUNT / 10);
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");
    await expect(optionContract.connect(acct2).exercise(0, 5)).to.emit(optionContract, "Exercised");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE + 5);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE - 5);

    expect(await token2.balanceOf(optionContract.target)).to.equal(totalUnderlyingPrice - 2);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid - totalUnderlyingPrice);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid + 2);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions - 5);
  });

  it("Should cancel put exercising because of the rounding error", async function () {
    const { putOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);

    const totalUnderlyingPrice = (OPTION_COUNT * STRIKE) / 10 ** 6;
    await token2.connect(acct1).approve(optionContract.target, totalUnderlyingPrice);
    await expect(optionContract.connect(acct1).create(putOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * putOption.strike) / TOKEN1_DECIMALS;
    await token1.connect(acct2).approve(optionContract.target, OPTION_COUNT / 10);
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");
    await expect(optionContract.connect(acct2).exercise(0, 1)).to.be.rejectedWith("transferredStrikeTokens");
  });
});