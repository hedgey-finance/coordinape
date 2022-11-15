import assert from 'assert';

import { parseUnits } from 'ethers/lib/utils';
import { lockedTokenDistribution } from 'lib/hedgey';

import { useContracts } from 'hooks';

export const useLockedTokenDistribution = () => {
  const contracts = useContracts();
  return async ({
    amount,
    gifts,
    vault,
    tokenContractAddress,
    hedgeyLockPeriod,
  }: any) => {
    assert(contracts, 'This network is not supported');

    const token = contracts.getERC20(
      vault ? vault.simple_token_address : tokenContractAddress
    );

    const decimals = await token.decimals();
    const weiAmount = parseUnits(amount, decimals);
    const deploymentInfo = contracts.getDeploymentInfo();

    if (vault) {
      const vaultContract = contracts.getVault(vault.vault_address);
      const result = await vaultContract.apeWithdrawSimpleToken(weiAmount);
      await result.wait();
    }

    const receipt = await lockedTokenDistribution(
      contracts.provider,
      contracts.chainId,
      token,
      weiAmount,
      hedgeyLockPeriod,
      gifts,
      decimals,
      deploymentInfo
    );
    await receipt.wait();
    return receipt;
  };
};
