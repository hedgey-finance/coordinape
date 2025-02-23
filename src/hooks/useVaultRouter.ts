import { BigNumber } from '@ethersproject/bignumber';
import { utils, ethers } from 'ethers';
import { addVaultTx } from 'lib/gql/mutations/vaults';
import {
  getDisplayTokenString,
  getTokenAddress,
  getWrappedAmount,
  hasSimpleToken,
} from 'lib/vaults';
import type { Contracts } from 'lib/vaults';

import { useWeb3React } from 'hooks/useWeb3React';
import { sendAndTrackTx, SendAndTrackTxResult } from 'utils/contractHelpers';

import type { Vault } from './gql/useVaults';
import { useToast } from './useToast';

export function useVaultRouter(contracts?: Contracts) {
  const { account } = useWeb3React();
  const { showError, showDefault } = useToast();

  const deposit = async (
    vault: Vault,
    humanAmount: string,
    usingEth = false
  ): Promise<SendAndTrackTxResult> => {
    if (!contracts) throw new Error('Contracts not loaded');
    const amount = BigNumber.from(
      utils.parseUnits(humanAmount, vault.decimals)
    );

    const tokenAddress = getTokenAddress(vault);
    const token = contracts.getERC20(tokenAddress);
    const [symbol, myAddress] = await Promise.all([
      token.symbol(),
      contracts.getMyAddress(),
    ]);

    if (usingEth) {
      const weth = new ethers.Contract(
        tokenAddress,
        ['function deposit() public payable'],
        contracts.signerOrProvider
      );
      const convertWethTxResult = await sendAndTrackTx(
        () => weth.deposit({ value: amount }),
        {
          showError,
          showDefault,
          signingMessage: 'Please sign the transaction to wrap your ETH.',
          description: `Deposit ${humanAmount} ETH`,
          chainId: contracts.chainId,
        }
      );

      if (convertWethTxResult.error) return convertWethTxResult;
    }

    const isSimpleToken = hasSimpleToken(vault);
    const receiverAddress = isSimpleToken
      ? vault.vault_address
      : contracts.router.address;

    const allowance = await token.allowance(myAddress, receiverAddress);

    if (allowance.lt(amount)) {
      const result = await sendAndTrackTx(
        () => token.approve(receiverAddress, amount),
        {
          showError,
          showDefault,
          signingMessage:
            'Please sign the transaction to approve the transfer.',
          description: `Approve ${humanAmount} ${symbol}`,
          chainId: contracts.chainId,
        }
      );
      if (result.error) return result;
    }

    const txResult = await sendAndTrackTx(
      () =>
        isSimpleToken
          ? token.transfer(receiverAddress, amount)
          : contracts.router.delegateDeposit(
              vault.vault_address,
              tokenAddress,
              amount
            ),
      {
        showError,
        showDefault,
        signingMessage: 'Please sign the transaction to deposit tokens.',
        description: `Deposit ${humanAmount} ${symbol}`,
        chainId: contracts.chainId,
      }
    );
    if (txResult?.tx)
      await addVaultTx({
        tx_type: 'Deposit',
        vault_id: vault.id,
        tx_hash: txResult.tx.hash,
        amount: Number.parseFloat(humanAmount),
        symbol: getDisplayTokenString(vault),
      }).catch(err => showError(err));
    return txResult;
  };

  const withdraw = async (
    vault: Vault,
    humanAmount: string,
    underlying: boolean
  ): Promise<SendAndTrackTxResult> => {
    if (!contracts || !account)
      throw new Error('Contracts or account not loaded');
    const vaultContract = contracts.getVault(vault.vault_address);
    const tokenAddress = getTokenAddress(vault);
    const token = contracts.getERC20(tokenAddress);
    const symbol = await token.symbol();
    const shares = await getWrappedAmount(humanAmount, vault, contracts);
    const txResult = await sendAndTrackTx(
      () =>
        hasSimpleToken(vault)
          ? vaultContract.apeWithdrawSimpleToken(shares)
          : vaultContract.apeWithdraw(shares, underlying),
      {
        showError,
        showDefault,
        signingMessage: 'Please sign the transaction to withdraw tokens.',
        chainId: contracts.chainId,
        description: `Withdraw ${humanAmount} ${symbol}`,
      }
    );
    if (txResult?.tx)
      await addVaultTx({
        tx_type: 'Withdraw',
        vault_id: vault.id,
        tx_hash: txResult.tx.hash,
        amount: Number.parseFloat(humanAmount),
        symbol: getDisplayTokenString(vault),
      }).catch(err => showError(err));
    return txResult;
  };

  return { deposit, withdraw };
}
