const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployInfraFixture, OPTION_COUNT, PREMIUM } = require("./Option_Globals");

describe("Transferring option tokens", function () {
  it("Should transfer tokens successfully on renounceable issuance", async function () {
    const abiCoder = new ethers.AbiCoder();

    const { callOption, optionContract, token1, token2, acct1, acct2, acct3 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions, false)).to.emit(optionContract, "Bought");

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    expect(await optionContract.balanceOf(acct3.address, 0)).to.equal(0);

    await expect(
      optionContract
        .connect(acct2)
        .safeTransferFrom(acct2.address, acct3.address, 0, boughtOptions, abiCoder.encode(["bytes"], ["0x"]))
    ).to.emit(optionContract, "TransferSingle");

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(0);
    expect(await optionContract.balanceOf(acct3.address, 0)).to.equal(boughtOptions);
  });

  it("Should fail to transfer tokens on non-renounceable issuance", async function () {
    const abiCoder = new ethers.AbiCoder();

    const { callOption, optionContract, token1, token2, acct1, acct2, acct3 } = await loadFixture(deployInfraFixture);
    const callOption2 = {
      ...callOption,
      renounceable: false,
    };

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption2, [])).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions, false)).to.emit(optionContract, "Bought");

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    expect(await optionContract.balanceOf(acct3.address, 0)).to.equal(0);

    await expect(
      optionContract
        .connect(acct2)
        .safeTransferFrom(acct2.address, acct3.address, 0, boughtOptions, abiCoder.encode(["bytes"], ["0x"]))
    ).to.be.reverted;

    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);
    expect(await optionContract.balanceOf(acct3.address, 0)).to.equal(0);
  });
});
