const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Option", function () {
  const TOKEN1_START_BALANCE = 10 * 10 ** 6;
  const TOKEN2_START_BALANCE = 10 * 10 ** 6;

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

    return { optionContract: vanillaOption, token1: token1, token2: token2, acct1: acct1, acct2: acct2, acct3: acct3, currentTime: currentTime };
  }

  it("Should correctly deploy the contract", async function () {
    const { optionContract } = await loadFixture(deployInfraFixture);
    expect(await optionContract.issuanceCounter()).to.equal(0);
  });

  describe("Creation", function () {
    it("Should correctly create a call option", async function () {
      const { optionContract, token1, token2, acct1, currentTime } = await loadFixture(deployInfraFixture);
      const OPTION_COUNT = 1 * 10 ** 6;

      await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

      const optionData = {
        side: 0,
        underlyingToken: token1.target,
        amount: OPTION_COUNT,
        strikeToken: token2.target,
        strike: 1 * 10 ** 6,
        premiumToken: token2.target,
        premium: 1 * 10 ** 4,
        exerciseWindowStart: currentTime,
        exerciseWindowEnd: currentTime + 60 * 60,
        buyingWindowEnd: currentTime + 15 * 60,
        minBuyingLot: 1,
        renounceable: true
      };

      await expect(optionContract.connect(acct1).create(optionData, [])).to.emit(optionContract, "Created");
      expect(await optionContract.issuanceCounter()).to.equal(1);

      const option = await optionContract.issuance(0);
      expect(option.seller).to.equal(acct1.address);
      expect(option.exercisedOptions).to.equal(0);
      expect(option.soldOptions).to.equal(0);
      expect(option.state).to.equal(1);
      expect(option.data.side).to.equal(optionData.side);
      expect(option.data.underlyingToken).to.equal(optionData.underlyingToken);
      expect(option.data.amount).to.equal(optionData.amount);
      expect(option.data.strikeToken).to.equal(optionData.strikeToken);
      expect(option.data.strike).to.equal(optionData.strike);
      expect(option.data.premiumToken).to.equal(optionData.premiumToken);
      expect(option.data.premium).to.equal(optionData.premium);
      expect(option.data.exerciseWindowStart).to.equal(optionData.exerciseWindowStart);
      expect(option.data.exerciseWindowEnd).to.equal(optionData.exerciseWindowEnd);
      expect(option.data.buyingWindowEnd).to.equal(optionData.buyingWindowEnd);
      expect(option.data.minBuyingLot).to.equal(optionData.minBuyingLot);
      expect(option.data.renounceable).to.equal(optionData.renounceable);

      expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
      expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    });

    it("Should correctly create a put option", async function () {
      const { optionContract, token1, token2, acct1, currentTime } = await loadFixture(deployInfraFixture);
      const OPTION_COUNT = 1 * 10 ** 6;
      const STRIKE = 4 * 10 ** 5;
      const TOTAL_UNDERLYING_PRICE = OPTION_COUNT * STRIKE / 10 ** 6;

      await token2.connect(acct1).approve(optionContract.target, TOTAL_UNDERLYING_PRICE);

      const optionData = {
        side: 1,
        underlyingToken: token1.target,
        amount: OPTION_COUNT,
        strikeToken: token2.target,
        strike: STRIKE,
        premiumToken: token2.target,
        premium: 1 * 10 ** 4,
        exerciseWindowStart: currentTime,
        exerciseWindowEnd: currentTime + 60 * 60,
        buyingWindowEnd: currentTime + 15 * 60,
        minBuyingLot: 1,
        renounceable: true
      };

      await expect(optionContract.connect(acct1).create(optionData, [])).to.emit(optionContract, "Created");
      expect(await optionContract.issuanceCounter()).to.equal(1);

      const option = await optionContract.issuance(0);
      expect(option.seller).to.equal(acct1.address);
      expect(option.exercisedOptions).to.equal(0);
      expect(option.soldOptions).to.equal(0);
      expect(option.state).to.equal(1);
      expect(option.data.side).to.equal(optionData.side);
      expect(option.data.underlyingToken).to.equal(optionData.underlyingToken);
      expect(option.data.amount).to.equal(optionData.amount);
      expect(option.data.strikeToken).to.equal(optionData.strikeToken);
      expect(option.data.strike).to.equal(optionData.strike);
      expect(option.data.premiumToken).to.equal(optionData.premiumToken);
      expect(option.data.premium).to.equal(optionData.premium);
      expect(option.data.exerciseWindowStart).to.equal(optionData.exerciseWindowStart);
      expect(option.data.exerciseWindowEnd).to.equal(optionData.exerciseWindowEnd);
      expect(option.data.buyingWindowEnd).to.equal(optionData.buyingWindowEnd);
      expect(option.data.minBuyingLot).to.equal(optionData.minBuyingLot);
      expect(option.data.renounceable).to.equal(optionData.renounceable);

      expect(await token2.balanceOf(optionContract.target)).to.equal(TOTAL_UNDERLYING_PRICE);
      expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - TOTAL_UNDERLYING_PRICE);
    });
  });
});
