import { ERC20 } from '@coordinape/hardhat/dist/typechain';
import { BigNumber, ethers } from 'ethers';

import BatchNFTMinter from './BatchNFTMinter.json';

export const lockedTokenDistribution = async (
  provider: ethers.providers.JsonRpcProvider,
  token: ERC20,
  amount: BigNumber,
  hedgeyLockPeriod: number,
  hedgeyTransferable: string,
  balances: { address: string; earnings: string }[]
): Promise<any> => {
  const batchNftMinterContractAddress =
    '0x99b693a65ee51a0cd8dbf1f7e361fb8dde853a01';
  const transferrableNFTContractAddress =
    '0x400a0F8f027938D766538B8fD0CC4AAc8604e501';
  const nonTransferrableNftContractAddress =
    '0xcf744802f65d2030B1168526F8F2a8d0703BaC00';

  const signer = provider.getSigner();
  const signerAddress = await signer.getAddress();
  const tokenAddress = token.address;

  const allowance: BigNumber = await token.allowance(
    signerAddress,
    batchNftMinterContractAddress
  );

  if (allowance.lt(amount)) {
    await token.approve(batchNftMinterContractAddress, amount);
  }

  const batchNFTMinter = new ethers.Contract(
    batchNftMinterContractAddress,
    BatchNFTMinter.abi,
    provider.getSigner()
  );

  const holders: string[] = [];
  const amounts: string[] = [];
  const unlockDates: string[] = [];

  const now = new Date();
  const unlockDate = new Date(
    now.setMonth(now.getMonth() + Number(hedgeyLockPeriod))
  );
  const unlockSecondsSinceEpoch = Math.round(
    unlockDate.getTime() / 1000
  ).toString();

  balances.forEach(balance => {
    const amount = balance.earnings;
    holders.push(balance.address);
    amounts.push(amount);
    unlockDates.push(unlockSecondsSinceEpoch);
  });

  return batchNFTMinter.batchMint(
    hedgeyTransferable === '1'
      ? transferrableNFTContractAddress
      : nonTransferrableNftContractAddress,
    holders,
    tokenAddress,
    amounts,
    unlockDates
  );
};
