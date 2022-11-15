import { ERC20 } from '@coordinape/hardhat/dist/typechain';
import { BigNumber, ContractTransaction, ethers } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';

import BatchNFTMinter from './BatchNFTMinter.json';

export const lockedTokenDistribution = async (
  provider: ethers.providers.JsonRpcProvider,
  chainId: string,
  token: ERC20,
  amount: BigNumber,
  hedgeyLockPeriod: number,
  gifts: any,
  decimals: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deploymentInfo: Record<string, any>
): Promise<ContractTransaction> => {
  const batchNftMinterContractAddress =
    '0x99b693a65ee51a0cd8dbf1f7e361fb8dde853a01';
  const nftContractAddress = '0x400a0F8f027938D766538B8fD0CC4AAc8604e501';

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

  for (const address of Object.keys(gifts)) {
    const amount = parseUnits(gifts[address].toString(), decimals);
    holders.push(address);
    amounts.push(amount.toString());
    unlockDates.push(unlockSecondsSinceEpoch);
  }

  return batchNFTMinter.batchMint(
    nftContractAddress,
    holders,
    tokenAddress,
    amounts,
    unlockDates
  );
};
