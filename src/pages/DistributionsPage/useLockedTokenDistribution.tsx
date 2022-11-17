import assert from 'assert';

import { parseUnits } from 'ethers/lib/utils';
import { lockedTokenDistribution } from 'lib/hedgey';

import { useContracts } from 'hooks';

import {
  useMarkLockedDistributionDone,
  useSaveLockedTokenDistribution,
} from './mutations';

export const useLockedTokenDistribution = () => {
  const contracts = useContracts();
  const { mutateAsync: saveLockedTokenDistribution } =
    useSaveLockedTokenDistribution();
  const { mutateAsync: markLockedDistributionDone } =
    useMarkLockedDistributionDone();
  return async ({
    amount,
    gifts,
    vault,
    tokenContractAddress,
    hedgeyLockPeriod,
    epochId,
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

    const response = await saveLockedTokenDistribution({
      epoch_id: epochId,
      gift_amount: amount,
      distribution_json: gifts,
    });

    assert(response, 'Locked distribution was not saved.');

    const receipt = await lockedTokenDistribution(
      contracts.provider,
      token,
      weiAmount,
      hedgeyLockPeriod,
      gifts,
      decimals,
      deploymentInfo
    );
    await receipt.wait();
    if (!receipt) return;

    await markLockedDistributionDone({
      id: response.id,
      tx_hash: receipt.transactionHash,
    });
    return receipt;
  };
};
