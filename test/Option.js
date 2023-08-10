const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Option", function () {
  const TOKEN1_DECIMALS = 10 ** 6;
  const TOKEN1_START_BALANCE = 10 * TOKEN1_DECIMALS;
  const TOKEN2_START_BALANCE = 10 * 10 ** 6;
  const OPTION_COUNT = 1 * 10 ** 6;
  const STRIKE = 4 * 10 ** 5;
  const PREMIUM = 3 * 10 ** 4;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  async function deployInfraFixture() {
    const [owner, acct1, acct2, acct3] = await ethers.getSigners();

    const vanillaOption = await ethers.deployContract("VanillaOption");
    await vanillaOption.waitForDeployment();

    const token1 = await ethers.deployContract("MockToken1");
    await token1.waitForDeployment();

    const token2 = await ethers.deployContract("MockToken2");
    await token2.waitForDeployment();

    await token1.connect(acct1).faucet(TOKEN1_START_BALANCE);
    await token1.connect(acct2).faucet(TOKEN1_START_BALANCE);
    await token1.connect(acct3).faucet(TOKEN1_START_BALANCE);

    await token2.connect(acct1).faucet(TOKEN2_START_BALANCE);
    await token2.connect(acct2).faucet(TOKEN2_START_BALANCE);
    await token2.connect(acct3).faucet(TOKEN2_START_BALANCE);

    currentTime = await time.latest();

    const callOption = {
      side: 0,
      underlyingToken: token1.target,
      amount: OPTION_COUNT,
      strikeToken: token2.target,
      strike: STRIKE,
      premiumToken: token2.target,
      premium: PREMIUM,
      exerciseWindowStart: currentTime,
      exerciseWindowEnd: currentTime + 60 * 60,
      minBuyingLot: 1,
      renounceable: true,
    };

    const putOption = {
      side: 1,
      underlyingToken: token1.target,
      amount: OPTION_COUNT,
      strikeToken: token2.target,
      strike: STRIKE,
      premiumToken: token2.target,
      premium: PREMIUM,
      exerciseWindowStart: currentTime,
      exerciseWindowEnd: currentTime + 60 * 60,
      minBuyingLot: 1,
      renounceable: true,
    };

    return {
      callOption: callOption,
      putOption: putOption,
      optionContract: vanillaOption,
      token1: token1,
      token2: token2,
      acct1: acct1,
      acct2: acct2,
      acct3: acct3,
      currentTime: currentTime,
    };
  }

  it("Should correctly deploy the contract", async function () {
    const { optionContract } = await loadFixture(deployInfraFixture);
    expect(await optionContract.issuanceCounter()).to.equal(0);
  });

  describe("Creation", function () {
    it("Should correctly create a call option", async function () {
      const { callOption, optionContract, token1, acct1 } = await loadFixture(deployInfraFixture);

      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");
      expect(await optionContract.issuanceCounter()).to.equal(1);

      const option = await optionContract.issuance(0);
      expect(option.seller).to.equal(acct1.address);
      expect(option.exercisedOptions).to.equal(0);
      expect(option.soldOptions).to.equal(0);
      expect(option.state).to.equal(1);
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

      await expect(optionContract.connect(acct1).create(putOption, [])).to.emit(optionContract, "Created");
      expect(await optionContract.issuanceCounter()).to.equal(1);

      const option = await optionContract.issuance(0);
      expect(option.seller).to.equal(acct1.address);
      expect(option.exercisedOptions).to.equal(0);
      expect(option.soldOptions).to.equal(0);
      expect(option.state).to.equal(1);
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
      await expect(optionContract.connect(acct1).create(optionData, [])).to.be.revertedWith("exerciseWindowEnd");
    });

    it("Should fail to create an option because token transfer is not approved", async function () {
      const { callOption, optionContract, acct1 } = await loadFixture(deployInfraFixture);

      await expect(optionContract.connect(acct1).create(callOption, [])).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
    });
  });

  describe("Buying", function () {
    it("Should buy call options", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 10;
      const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
      await token2.connect(acct2).approve(optionContract.target, premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

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

      const totalUnderlyingPrice = (OPTION_COUNT * STRIKE) / 10 ** 6;
      await token2.connect(acct1).approve(optionContract.target, totalUnderlyingPrice);
      await expect(optionContract.connect(acct1).create(putOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 10;
      const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
      await token2.connect(acct2).approve(optionContract.target, premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");

      expect(await token1.balanceOf(optionContract.target)).to.equal(0);
      expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);
      expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

      expect(await token2.balanceOf(optionContract.target)).to.equal(totalUnderlyingPrice);
      expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - totalUnderlyingPrice + premiumPaid);
      expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid);

      expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    });

    it("Should fail to buy non-existent options", async function () {
      const { optionContract, token2, acct2 } = await loadFixture(deployInfraFixture);
      const boughtOptions = OPTION_COUNT / 10;
      const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
      await token2.connect(acct2).approve(optionContract.target, premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false))
        .to.emit(optionContract, "Bought")
        .to.be.revertedWith("state");
    });

    it("Should fail to buy options that are expired", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 10;
      const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
      await token2.connect(acct2).approve(optionContract.target, premiumPaid);

      await time.increase(2 * 60 * 60);

      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.be.rejectedWith(
        "exceriseWindowEnd"
      );
    });

    it("Should fail to buy options because buyer is not on the allowed buyer list", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2, acct3 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [acct3.address])).to.emit(
        optionContract,
        "Created"
      );

      const boughtOptions = OPTION_COUNT / 10;
      const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
      await token2.connect(acct2).approve(optionContract.target, premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.be.rejectedWith("allowedBuyers");

      // acct3 should be able to buy, verify it!
      await token2.connect(acct3).approve(optionContract.target, premiumPaid);
      await expect(optionContract.connect(acct3).buy(0, OPTION_COUNT / 10, false)).to.emit(optionContract, "Bought");
    });

    it("Should fail to buy options because the amount of smaller than minimum buying lot size", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      const modifCallOption = {
        ...callOption,
        minBuyingLot: OPTION_COUNT / 5,
      };

      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(modifCallOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 5;
      const premiumPaid = Math.ceil((boughtOptions * PREMIUM) / OPTION_COUNT);
      await token2.connect(acct2).approve(optionContract.target, premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.be.rejectedWith("minBuyingLot");

      // Check that we can buy when correct amount is defined
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 5, false)).to.emit(optionContract, "Bought");

      expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    });

    it("Should fail to buy options because there are no options to be bought", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT;
      const premiumPaid = Math.ceil((boughtOptions * PREMIUM) / OPTION_COUNT);
      await token2.connect(acct2).approve(optionContract.target, 2 * premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT, false)).to.emit(optionContract, "Bought");

      // All options bought, verify we can't buy any more of them
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT, false)).to.be.revertedWith("buyerOptionCount");

      expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    });

    it("Should fail to buy options because we can't fill the whole amount", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 2;
      const premiumPaid = Math.ceil((boughtOptions * PREMIUM) / OPTION_COUNT);
      await token2.connect(acct2).approve(optionContract.target, 2 * premiumPaid);
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 2, false)).to.emit(optionContract, "Bought");

      // We want to buy whole OPTION_COUNT slot, but can't since half is already gone
      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT, true)).to.be.revertedWith("mustCompletelyFill");

      expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    });

    it("Should fail to buy options because buyer has not approved token transfer", async function () {
      const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      await expect(optionContract.connect(acct2).buy(0, OPTION_COUNT / 10, false)).to.be.rejectedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("Should adjust due to the zero premium when buying options", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 2;
      const premiumPaid = Math.ceil((boughtOptions * PREMIUM) / OPTION_COUNT);
      await token2.connect(acct2).approve(optionContract.target, 2 * premiumPaid);
      // Trying to buy too few option tokens, which would lead to zero premium
      await expect(optionContract.connect(acct2).buy(0, 10, false)).to.emit(optionContract, "Bought");

      expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
      expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
      expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

      expect(await token2.balanceOf(optionContract.target)).to.equal(0);
      expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + 1);
      expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - 1);

      expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(10);
    });

    it("Should adjust bought option count when modulo ≠ 0", async function () {
      const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

      const boughtOptions = OPTION_COUNT / 2;
      const premiumPaid = Math.ceil((boughtOptions * PREMIUM) / OPTION_COUNT);
      await token2.connect(acct2).approve(optionContract.target, 2 * premiumPaid);

      // Shouldn't be able to buy extra 17 tokens, instead the option token count should be OPTION_COUNT / 2
      await expect(optionContract.connect(acct2).buy(0, 17 + OPTION_COUNT / 2, false)).to.emit(
        optionContract,
        "Bought"
      );

      expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
      expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
      expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);

      expect(await token2.balanceOf(optionContract.target)).to.equal(0);
      expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid + 1);
      expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid - 1);

      expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(17 + OPTION_COUNT / 2);
    });
  });

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
});
