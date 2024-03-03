const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
  PREMIUM,
} = require("./Option_Globals");

describe("Buying", function () {
  it("Should buy call options", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10)).to.emit(optionContract, "Bought");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
  });

  it("Should buy put options", async function () {
    const { putOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token2.connect(acct1).approve(optionContract.target, putOption.strike);
    await expect(optionContract.connect(acct1).create(putOption)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10)).to.emit(optionContract, "Bought");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

    expect(await token2.balanceOf(optionContract.target)).to.equal(putOption.strike);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - putOption.strike + premiumPaid);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
  });

  it("Should fail to buy non-existent options", async function () {
    const { optionContract, token2, acct2 } = await loadFixture(deployInfraFixture);
    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10)).to.be.revertedWithCustomError(
      optionContract,
      "AmountForbidden"
    );
  });

  it("Should fail to buy options that are expired", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);

    await time.increase(2 * 60 * 60);

    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10)).to.be.revertedWithCustomError(
      optionContract,
      "TimeForbidden"
    );
  });

  it("Should fail to buy options because there are no options to be bought", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT;
    const premiumPaid = Math.ceil((boughtOptions * PREMIUM) / OPTION_COUNT);
    await token2.connect(acct2).approve(optionContract.target, 2 * premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT)).to.emit(optionContract, "Bought");

    // All options bought, verify we can't buy any more of them
    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT)).to.be.revertedWithCustomError(
      optionContract,
      "AmountForbidden"
    );

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
  });

  it("Should fail to buy options because buyer has not approved token transfer", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10)).to.be.rejectedWith(
      "ERC20: insufficient allowance"
    );
  });

  it("Should fail due to the zero premium when buying options", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 2;
    // Trying to buy too few option tokens, which would lead to zero premium and fail when trying to buy an option
    await expect(optionContract.connect(acct2).buy(0, 10)).to.be.revertedWithCustomError(
      optionContract,
      "AmountForbidden"
    );

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(0);
  });

  it("Should adjust bought option count when modulo ≠ 0", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    let boughtOptions = 17 + OPTION_COUNT / 2;
    const premiumPaid = Math.floor((boughtOptions * PREMIUM) / OPTION_COUNT);
    await token2.connect(acct2).approve(optionContract.target, 2 * premiumPaid);

    // Shouldn't be able to buy extra 17 tokens since we would not be paying extra premium for them
    // Instead the option token count should be OPTION_COUNT / 2
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

    expect(await token2.balanceOf(optionContract.target)).to.equal(0);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid);

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(OPTION_COUNT / 2);
  });
});
