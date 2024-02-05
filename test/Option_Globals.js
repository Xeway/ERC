const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const TOKEN1_DECIMALS = 10 ** 6;
const TOKEN1_START_BALANCE = 10 * TOKEN1_DECIMALS;
const TOKEN2_START_BALANCE = 10 * 10 ** 6;
const OPTION_COUNT = 1 * 10 ** 6;
const STRIKE = 10 * 4 * 10 ** 5;
const PREMIUM = 3 * 10 ** 4;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function deployInfraFixture() {
  const [owner, acct1, acct2, acct3] = await ethers.getSigners();

  const vanillaOption = await ethers.deployContract("MockERC7390");
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

  const emptyBytes = ethers.AbiCoder.defaultAbiCoder().encode(["string"], [""]);
  
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
    data: emptyBytes
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
    data: emptyBytes
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

module.exports = {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
  PREMIUM,
  ZERO_ADDRESS,
};
