import { ethers } from "hardhat";

async function main() {
  const optionFactory = await ethers.getContractFactory("ERC7390");
  const option = await optionFactory.deploy();
  const contractAddress = await option.getAddress();

  console.log(`Vanilla Option contract deployed to address: ${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });