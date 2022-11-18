/* eslint-disable */
import assert from 'assert';
import React, { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { formatRelative, parseISO } from 'date-fns';
import { BigNumber, constants as ethersConstants } from 'ethers';
import { parseUnits, formatUnits, commify } from 'ethers/lib/utils';
import {
  getVaultSymbolAddressString,
  getWrappedAmount,
  removeYearnPrefix,
} from 'lib/vaults';
import round from 'lodash/round';
import { useForm, SubmitHandler, useController } from 'react-hook-form';
import { z } from 'zod';

import { DISTRIBUTION_TYPE } from '../../config/constants';
import { paths } from '../../routes/paths';
import { IUser } from '../../types';
import {
  LoadingModal,
  FormTokenField,
  zTokenString,
  FormInputField,
} from 'components';
import { useApeSnackbar, useContracts } from 'hooks';
import { useCurrentCircleIntegrations } from 'hooks/gql/useCurrentCircleIntegrations';
import { hedgeyLockPeriods } from 'pages/CircleAdminPage/HedgeyIntegrationSettings';
import {
  AppLink,
  Box,
  Button,
  Flex,
  Panel,
  Select,
  SelectOption,
  Text,
} from 'ui';
import { TwoColumnLayout } from 'ui/layouts';
import { makeExplorerUrl } from 'utils/provider';

import { getPreviousDistribution } from './queries';
import type { EpochDataResult, Gift } from './queries';
import { useSubmitDistribution } from './useSubmitDistribution';
import { mapProfileIdsByAddress } from './utils';
import { useLockedTokenDistribution } from './useLockedTokenDistribution';

const headerStyle = {
  fontWeight: '$bold',
  color: '$headingText',
};

const vaultSelectionPanel = {
  padding: '$md',
  minHeight: '11rem',
  mb: '$lg',
};

type SubmitFormProps = {
  epoch: EpochDataResult;
  users: (Gift['recipient'] & { received: number })[];
  setAmount: (amount: string) => void;
  setGiftVaultId: (giftVaultId: string) => void;
  vaults: { id: number; symbol: string; vault_address: string }[];
  circleUsers: IUser[];
  giftVaultId: string;
  formGiftAmount: string;
  refetch: () => void;
  circleDist: EpochDataResult['distributions'][0] | undefined;
  fixedDist: EpochDataResult['distributions'][0] | undefined;
  totalGive: number;
};

/**
 * Displays a list of allocations and allows generation of Merkle Root for a given circle and epoch.
 * @param epochId string
 * @returns JSX.Element
 */
export function DistributionForm({
  epoch,
  users,
  setAmount,
  setGiftVaultId,
  vaults,
  circleUsers,
  giftVaultId,
  formGiftAmount,
  refetch,
  circleDist,
  fixedDist,
  totalGive,
}: SubmitFormProps) {
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [fixedSubmitting, setFixedSubmitting] = useState(false);

  const [sufficientFixedPaymentTokens, setSufficientFixPaymentTokens] =
    useState(false);
  const [sufficientGiftTokens, setSufficientGiftTokens] = useState(false);
  const [maxGiftTokens, setMaxGiftTokens] = useState(ethersConstants.Zero);
  const [maxFixedPaymentTokens, setMaxFixedPaymentTokens] = useState(
    ethersConstants.Zero
  );
  const [isUsingHedgey, setIsUsingHedgey] = useState(false);

  const { showError } = useApeSnackbar();
  const submitDistribution = useSubmitDistribution();
  const lockedTokenDistribution = useLockedTokenDistribution();
  const contracts = useContracts();
  const circle = epoch.circle;
  assert(circle);
  const fixedPaymentVaultId = circle.fixed_payment_vault_id;
  const totalFixedPayment = circleUsers
    .map(g => g.fixed_payment_amount ?? 0)
    .reduce((total, tokens) => tokens + total, 0)
    .toString();

  const findVault = (vaultId: string | undefined) =>
    circle.organization?.vaults?.find(v => v.id.toString() === vaultId);

  const fpVault = findVault(fixedPaymentVaultId?.toString());

  const giftDecimals = findVault(giftVaultId)?.decimals || 0;
  const DistributionFormSchema = z.object({
    amount: zTokenString(
      '0',
      formatUnits(maxGiftTokens, giftDecimals),
      giftDecimals
    ),
    selectedVaultId: z.string(),
    selectedHedgeyVaultId: z.string().optional(),
    hedgeyLockPeriod: z.string().optional(),
    hedgeyTransferable: z.string().optional(),
    tokenContractAddress: z.string().optional(),
  });
  const FixedDistributionFormSchema = z.object({
    amount: z.string(),
    selectedVaultId: z.string(),
  });
  type TDistributionForm = z.infer<typeof DistributionFormSchema>;
  type TFixedDistributionForm = z.infer<typeof FixedDistributionFormSchema>;
  const {
    handleSubmit,
    control,
    register,
    setValue,
    formState: { errors },
  } = useForm<TDistributionForm>({
    mode: 'all',
    resolver: zodResolver(DistributionFormSchema),
    defaultValues: {
      selectedVaultId: vaults[0] ? vaults[0].id.toString() : undefined,
      selectedHedgeyVaultId: vaults[0] ? vaults[0].id.toString() : undefined,
    },
  });

  const {
    handleSubmit: fixedHandleSubmit,
    control: fixedControl,
    register: fixedRegister,
  } = useForm<TFixedDistributionForm>({
    resolver: zodResolver(FixedDistributionFormSchema),
    defaultValues: {
      selectedVaultId: vaults[0] ? vaults[0].id.toString() : undefined,
    },
  });

  const { field: amountField } = useController({
    name: 'amount',
    control,
    defaultValue: '0',
  });

  const { field: fixedAmountField } = useController({
    name: 'amount',
    control: fixedControl,
    defaultValue: '0',
  });

  const { field: tokenContractAddress } = useController({
    name: 'tokenContractAddress',
    control,
    defaultValue: '0xE13FB676E9bdd7AFda91495eC4e027FC63212FC3',
  });

  useEffect(() => {
    if (circleDist) {
      setGiftVaultId(circleDist.vault.id.toString());
      updateBalanceState(
        circleDist.vault.id.toString(),
        circleDist.gift_amount.toString(),
        'gift'
      );
    } else if (vaults[0] && !giftVaultId) {
      setGiftVaultId(vaults[0].id.toString());
      updateBalanceState(vaults[0].id.toString(), formGiftAmount, 'gift');
    }
  }, [vaults]);

  useEffect(() => {
    if (fpVault)
      updateBalanceState(fpVault.id.toString(), totalFixedPayment, 'fixed');
  }, [fixedPaymentVaultId, totalFixedPayment]);

  const integrations = useCurrentCircleIntegrations();
  const hedgeyIntegration = integrations?.data?.find(integration => {
    return integration.type === 'hedgey';
  }) as {
    id: number;
    type: string;
    data: { enabled: boolean; lockPeriod: string; transferable: string };
  };

  useEffect(() => {
    if (isUsingHedgey) {
      setGiftVaultId(vaults[0].id.toString());
    }
  }, [isUsingHedgey]);

  const onFixedFormSubmit: SubmitHandler<TFixedDistributionForm> = async () => {
    assert(epoch?.id && circle);
    setFixedSubmitting(true);
    const vault = fpVault;
    assert(vault);
    assert(contracts, 'This network is not supported');

    // compute wrapped amounts for fixed gifts
    const fixedGiftsArray: [string, BigNumber][] = await Promise.all(
      circleUsers.map(async (user): Promise<[string, BigNumber]> => {
        const amt = user.fixed_payment_amount || 0;
        const wrappedAmount = await getWrappedAmount(
          amt.toString(),
          vault,
          contracts
        );
        return [user.address, wrappedAmount];
      })
    );

    // marshall fixed gifts into an object
    const fixedGifts = await fixedGiftsArray.reduce(
      (ret, [userAddress, amount]) => {
        if (amount.gt(0)) ret[userAddress] = amount;
        return ret;
      },
      {} as Record<string, BigNumber>
    );
    const type =
      isCombinedDistribution() && !circleDist && Number(formGiftAmount) > 0
        ? DISTRIBUTION_TYPE.COMBINED
        : DISTRIBUTION_TYPE.FIXED;
    const gifts = {} as Record<string, number>;
    if (type === DISTRIBUTION_TYPE.COMBINED) {
      users.forEach(user => {
        if (!(user.address in gifts)) gifts[user.address] = 0;
        gifts[user.address] += user.received;
      });
    }

    try {
      const result = await submitDistribution({
        amount:
          type === DISTRIBUTION_TYPE.COMBINED
            ? formatUnits(
                parseUnits(totalFixedPayment, vault.decimals).add(
                  parseUnits(formGiftAmount, vault.decimals)
                ),
                vault.decimals
              )
            : totalFixedPayment,
        vault,
        gifts,
        fixedGifts,
        profileIdsByAddress: mapProfileIdsByAddress(circleUsers),
        previousDistribution: await getPreviousDistribution(
          circle.id,
          vault.id
        ),
        circleId: circle.id,
        description: `Submit Distribution for ${circle.name}: Epoch ${epoch.number}`,
        epochId: epoch.id,
        fixedAmount: String(totalFixedPayment),
        giftAmount:
          type === DISTRIBUTION_TYPE.COMBINED ? String(formGiftAmount) : '0',
        type,
      });
      setFixedSubmitting(false);

      // could be due to user cancellation
      if (!result) return;

      refetch();
      updateBalanceState(vault.id.toString(), totalFixedPayment, 'fixed');
    } catch (e) {
      showError(e);
      console.error('DistributionsPage.onSubmit:', e);
      setFixedSubmitting(false);
    }
  };

  const onSubmit: SubmitHandler<TDistributionForm> = async (
    value: TDistributionForm
  ) => {
    assert(epoch?.id && circle);
    setGiftSubmitting(true);
    const vault = findVault(
      isUsingHedgey ? value.selectedHedgeyVaultId : value.selectedVaultId
    );

    let result;

    const gifts = users.reduce((ret, user) => {
      ret[user.address] = user.received;
      return ret;
    }, {} as Record<string, number>);

    if (isUsingHedgey) {
      try {
        result = await lockedTokenDistribution({
          amount: value.amount.toString(),
          tokenContractAddress: value.tokenContractAddress?.toString(),
          gifts,
          vault,
          hedgeyLockPeriod: value.hedgeyLockPeriod,
          hedgeyTransferable: value.hedgeyTransferable,
          epochId: epoch.id,
          circleId: circle.id,
          totalGive,
        });
      } catch (err) {
        showError(err);
        console.error('DistributionsPage.onSubmit:', err);
        setGiftSubmitting(false);
      }

      setGiftSubmitting(false);

      // could be due to user cancellation
      if (!result) return;

      refetch();
      return;
    }

    assert(vault);

    try {
      result = await submitDistribution({
        amount: value.amount.toString(),
        vault,
        gifts,
        fixedGifts: {},
        profileIdsByAddress: mapProfileIdsByAddress(circleUsers),
        previousDistribution: await getPreviousDistribution(
          circle.id,
          vault.id
        ),
        circleId: circle.id,
        description: `Submit Distribution for ${circle.name}: Epoch ${epoch.number}`,
        epochId: epoch.id,
        fixedAmount: '0',
        giftAmount: value.amount.toString(),
        type: DISTRIBUTION_TYPE.GIFT,
      });

      setGiftSubmitting(false);

      // could be due to user cancellation
      if (!result) return;

      refetch();
      updateBalanceState(vault.id.toString(), value.amount, 'gift');
    } catch (e) {
      showError(e);
      console.error('DistributionsPage.onSubmit:', e);
      setGiftSubmitting(false);
    }
  };

  const getDecimals = ({
    distribution,
    vaultId,
  }: {
    distribution: EpochDataResult['distributions'][0] | undefined;
    vaultId: string | undefined;
  }) => {
    if (distribution) return distribution.vault.decimals;
    if (vaultId) {
      const v = findVault(vaultId);
      if (v) return v.decimals;
    }
    return 0;
  };

  const getButtonText = (
    sufficientTokens: boolean,
    vaultId: string,
    amount: string,
    type: 'fixed' | 'gift' | 'combined'
  ): string => {
    if (Number.parseFloat(amount) === 0) {
      return type === 'fixed'
        ? 'No users have fixed payments'
        : `Please input a token amount`;
    }
    if (!sufficientTokens) return 'Insufficient tokens';
    if (
      (giftSubmitting && type === 'gift') ||
      (fixedSubmitting && type === 'fixed')
    )
      return 'Submitting...';
    return `Submit ${findVault(vaultId)?.symbol} Vault Distribution`;
  };

  const isCombinedDistribution = () => {
    if (isUsingHedgey) {
      return false;
    }
    return (
      ((fixedDist && circleDist) || (!fixedDist && !circleDist)) &&
      giftVaultId &&
      fpVault?.id.toString() === giftVaultId
    );
  };

  const updateBalanceState = async (
    vaultId: string,
    amountSet: string,
    formType: string
  ): Promise<void> => {
    function calculateIfCombinedDist() {
      if (isUsingHedgey) {
        return false;
      }
      return (
        // check if the two symbols are the same
        ((formType === 'gift' && fpVault?.id.toString() === vaultId) ||
          (formType === 'fixed' && giftVaultId === vaultId)) &&
        // check if a non combined distribution is selected
        ((!fixedDist && !circleDist) || (circleDist && fixedDist))
      );
    }
    assert(circle);
    const vault = findVault(vaultId);
    assert(vault);
    const amountSetBN = parseUnits(amountSet || '0', vault.decimals);
    assert(contracts, 'This network is not supported');
    const tokenBalance = await contracts.getVaultBalance(vault);

    const isCombinedDist = calculateIfCombinedDist();

    const totalAmt: BigNumber = isCombinedDist
      ? amountSetBN.add(parseUnits(totalFixedPayment, vault.decimals))
      : amountSetBN;

    if (isCombinedDist) {
      setMaxGiftTokens(tokenBalance);
      setMaxFixedPaymentTokens(tokenBalance);
      setSufficientFixPaymentTokens(
        totalAmt.lte(tokenBalance) && totalAmt.gt(0)
      );
    } else if (formType === 'gift') {
      setSufficientGiftTokens(tokenBalance.gte(totalAmt) && totalAmt.gt(0));
      setMaxGiftTokens(tokenBalance);
      // if switching from combined dist selection to non combined
      // we need to recheck if the fixed payment have sufficient tokens
      if (fpVault?.id.toString() === vaultId)
        setSufficientFixPaymentTokens(
          maxFixedPaymentTokens.gte(totalFixedPayment) &&
            ethersConstants.Zero.lt(totalFixedPayment)
        );
    } else {
      setSufficientFixPaymentTokens(
        tokenBalance.gte(totalAmt) && totalAmt.gt(0)
      );
      setMaxFixedPaymentTokens(tokenBalance);
    }
  };

  const shouldDisableGiftInput =
    giftSubmitting || !!circleDist || vaults.length === 0 || totalGive === 0;

  const displayAvailableAmount = (type: 'gift' | 'fixed') => {
    const max = type === 'gift' ? maxGiftTokens : maxFixedPaymentTokens;
    const distribution = type === 'gift' ? circleDist : fixedDist;
    const vaultId = type === 'gift' ? giftVaultId : fpVault?.id.toString();
    const decimals = getDecimals({ distribution, vaultId });
    const humanNumber = Number(formatUnits(max, decimals));
    return commify(round(humanNumber, 2));
  };

  const getVaultOptions = (options?: { includeHedgey: boolean }) => {
    // todo: figure out how to get the hedgey settings and set the default values of the form to use those set in the integration settings
    const hedgeyEnabled = true;
    let vaultOptions: SelectOption[] = [];
    if (vaults.length) {
      const v = vaults.map(t => {
        return {
          value: t.id.toString(),
          label: options?.includeHedgey
            ? getVaultSymbolAddressString(t)
            : `CoVault: ${getVaultSymbolAddressString(t)}`,
        };
      });
      vaultOptions = options?.includeHedgey
        ? v
        : [...v, { value: '', label: 'Connected wallet' }];
    } else {
      vaultOptions = options?.includeHedgey
        ? [{ value: '', label: 'No Vaults Available' }]
        : [{ value: '', label: 'Connected wallet' }];
    }
    return hedgeyEnabled && options?.includeHedgey
      ? [...vaultOptions, { value: 'hedgey', label: 'Hedgey' }]
      : vaultOptions;
  };

  const onVaultOrSourceChange = (value: string) => {
    if (value === 'hedgey') {
      setIsUsingHedgey(true);
      return;
    }
    setIsUsingHedgey(false);
    setValue('selectedVaultId', value, {
      shouldDirty: true,
    });
    setGiftVaultId(value);
    updateBalanceState(value, formGiftAmount, 'gift');
  };

  const onHedgeyVaultChange = (value: string) => {
    setValue('selectedHedgeyVaultId', value, {
      shouldDirty: true,
    });
    setGiftVaultId(value);
    updateBalanceState(value, formGiftAmount, 'gift');
  };

  const onChangeHedgeyLockPeriod = (value: string) => {
    setValue('hedgeyLockPeriod', value, {
      shouldDirty: true,
    });
  };

  return (
    <TwoColumnLayout>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Panel invertForm css={vaultSelectionPanel}>
          <Text h2 css={headerStyle}>
            Gift Circle
          </Text>
          <TwoColumnLayout css={{ pt: '$md' }}>
            <Box css={{ width: '100%' }}>
              <Select
                {...(register('selectedVaultId'),
                {
                  defaultValue: circleDist
                    ? circleDist.vault.id.toString()
                    : vaults[0]
                    ? vaults[0].id.toString()
                    : '',
                  label: 'CoVault / Source',
                  disabled: shouldDisableGiftInput,
                  onValueChange: onVaultOrSourceChange,
                })}
                options={getVaultOptions({
                  includeHedgey: hedgeyIntegration?.data.enabled,
                })}
              ></Select>
            </Box>
            <Box css={{ width: '100%' }}>
              <FormTokenField
                {...amountField}
                symbol={removeYearnPrefix(findVault(giftVaultId)?.symbol || '')}
                decimals={getDecimals({
                  distribution: circleDist,
                  vaultId: giftVaultId,
                })}
                type="text"
                placeholder="0"
                error={!!errors.amount}
                errorText={errors.amount ? 'Insufficient funds.' : ''}
                value={
                  circleDist
                    ? circleDist.gift_amount?.toString() || '0'
                    : amountField.value.toString()
                }
                disabled={
                  giftSubmitting ||
                  totalGive === 0 ||
                  (vaults.length > 0 && !!circleDist)
                }
                max={formatUnits(
                  maxGiftTokens,
                  getDecimals({
                    distribution: circleDist,
                    vaultId: giftVaultId,
                  })
                )}
                prelabel="Amount"
                infoTooltip={
                  <>
                    CoVault funds to be allocated to the distribution of this
                    gift circle.
                  </>
                }
                label={`Avail. ${displayAvailableAmount('gift')}`}
                onChange={value => {
                  amountField.onChange(value);
                  setAmount(value);
                  updateBalanceState(giftVaultId, value, 'gift');
                }}
                apeSize="small"
              />
            </Box>
          </TwoColumnLayout>
          {isUsingHedgey && (
            <>
              <TwoColumnLayout>
                <Box css={{ width: '100%', marginTop: '1em' }}>
                  <Select
                    {...(register('selectedHedgeyVaultId'),
                    {
                      defaultValue: circleDist
                        ? circleDist.vault.id.toString()
                        : vaults[0]
                        ? vaults[0].id.toString()
                        : '',
                      label: 'Distribution source',
                      disabled: shouldDisableGiftInput,
                      onValueChange: onHedgeyVaultChange,
                    })}
                    options={getVaultOptions({ includeHedgey: false })}
                  />
                </Box>
                {/* <Box css={{ width: '100%', marginTop: '1em' }}>
                  Custom token input here if using connected wallet
                </Box> */}
                <FormInputField
                  id="token_contract_address"
                  name="tokenContractAddress"
                  control={control}
                  label="Token Contract Address"
                  infoTooltip="This will be the circle name that your users will select"
                  showFieldErrors
                />
              </TwoColumnLayout>
              <TwoColumnLayout>
                <Box css={{ width: '100%', marginTop: '1em' }}>
                  <Select
                    css={{ width: '100%' }}
                    options={hedgeyLockPeriods}
                    {...(register('hedgeyLockPeriod'),
                    {
                      id: 'hedgey-default-lock-period',
                      label: 'Lock period',
                      infoTooltip:
                        "How long tokens are locked within the recipient's NFT",
                      defaultValue: hedgeyIntegration?.data.lockPeriod,
                      onValueChange: onChangeHedgeyLockPeriod,
                    })}
                  />
                </Box>
                <Box css={{ width: '100%', marginTop: '1em' }}>
                  <Select
                    css={{ width: '100%' }}
                    options={[
                      { label: 'Yes', value: '1' },
                      { label: 'No', value: '0' },
                    ]}
                    {...(register('hedgeyTransferable'),
                    {
                      label: 'Transferable',
                      infoTooltip:
                        'Allow the recipient to transfer their NFT (and their access to the locked tokens) to a different wallet address',
                      id: 'hedgey-transferable',
                      defaultValue: hedgeyIntegration?.data.transferable,
                      onValueChange: value =>
                        setValue('hedgeyTransferable', value, {
                          shouldDirty: true,
                        }),
                    })}
                  />
                </Box>
              </TwoColumnLayout>
            </>
          )}
        </Panel>
        {(fixedDist || circleDist) && <Summary distribution={circleDist} />}
        <Flex css={{ justifyContent: 'center', mb: '$sm' }}>
          {circleDist ? (
            <EtherscanButton distribution={circleDist} />
          ) : isCombinedDistribution() ? (
            <Text css={{ fontSize: '$small' }}>
              Combined Distribution. Total{' '}
              {renderCombinedSum(formGiftAmount, totalFixedPayment)}{' '}
              {fpVault?.symbol}
            </Text>
          ) : vaults[0] ? (
            <Button
              color="primary"
              outlined
              disabled={giftSubmitting || !sufficientGiftTokens}
              fullWidth
            >
              {getButtonText(
                sufficientGiftTokens,
                giftVaultId,
                formGiftAmount,
                'gift'
              )}
            </Button>
          ) : null}
        </Flex>
      </form>

      <form onSubmit={fixedHandleSubmit(onFixedFormSubmit)}>
        <Panel invertForm css={vaultSelectionPanel}>
          <Flex>
            <Text h2 css={{ ...headerStyle, flexGrow: 1 }}>
              Fixed Payments
            </Text>
            <Box css={{ fontSize: '$small', alignSelf: 'center' }}>
              <AppLink
                to={paths.circleAdmin(circle.id)}
                css={{ textDecoration: 'none' }}
              >
                <Text css={{ color: '$primary' }}>Edit Settings</Text>
              </AppLink>
            </Box>
          </Flex>

          {!fixedPaymentVaultId ? (
            <Box
              css={{
                pt: '$lg',
                pb: '$lg',
                mt: '$md',
                textAlign: 'center',
                fontSize: '$small',
                color: '$neutral',
              }}
            >
              Fixed Payments are Disabled
            </Box>
          ) : (
            <>
              <TwoColumnLayout css={{ pt: '$md' }}>
                <Box css={{ width: '100%' }}>
                  <Select
                    {...(fixedRegister('selectedVaultId'),
                    {
                      defaultValue: fpVault
                        ? fixedDist
                          ? fixedDist.vault.id.toString()
                          : fpVault.id.toString()
                        : '',
                      disabled: true,
                      label: 'CoVault',
                    })}
                    options={
                      fpVault
                        ? [
                            {
                              value: fpVault.id.toString(),
                              label: getVaultSymbolAddressString(fpVault),
                            },
                          ]
                        : [{ value: '', label: 'No Vaults Available' }]
                    }
                  ></Select>
                </Box>
                <Box css={{ width: '100%' }}>
                  <FormTokenField
                    {...fixedAmountField}
                    symbol={
                      fpVault
                        ? fixedDist
                          ? removeYearnPrefix(fixedDist.vault.symbol)
                          : removeYearnPrefix(fpVault.symbol)
                        : ''
                    }
                    decimals={getDecimals({
                      distribution: fixedDist,
                      vaultId: fpVault?.id.toString(),
                    })}
                    type="text"
                    placeholder="0"
                    value={
                      fixedDist
                        ? fixedDist.fixed_amount.toString()
                        : totalFixedPayment
                    }
                    disabled={true}
                    max={formatUnits(
                      maxFixedPaymentTokens,
                      getDecimals({
                        distribution: fixedDist,
                        vaultId: fpVault?.id.toString(),
                      })
                    )}
                    prelabel="Amount"
                    infoTooltip={
                      <>
                        CoVault funds to be allocated to the distribution of the
                        fixed payment.
                      </>
                    }
                    label={`Avail. ${displayAvailableAmount('fixed')}`}
                    onChange={() => {}}
                    apeSize="small"
                  />
                </Box>
              </TwoColumnLayout>

              {(giftSubmitting || fixedSubmitting) && <LoadingModal visible />}
            </>
          )}
        </Panel>
        {(fixedDist || circleDist) && <Summary distribution={fixedDist} />}
        <Flex css={{ justifyContent: 'center', mb: '$sm' }}>
          {fixedDist ? (
            <EtherscanButton distribution={fixedDist} />
          ) : fpVault ? (
            <Button
              color="primary"
              outlined
              disabled={fixedSubmitting || !sufficientFixedPaymentTokens}
              fullWidth
            >
              {getButtonText(
                sufficientFixedPaymentTokens,
                fpVault.id.toString(),
                isCombinedDistribution()
                  ? renderCombinedSum(formGiftAmount, totalFixedPayment)
                  : totalFixedPayment,
                isCombinedDistribution() ? 'combined' : 'fixed'
              )}
            </Button>
          ) : null}
        </Flex>
      </form>
    </TwoColumnLayout>
  );
}

const Summary = ({
  distribution,
}: {
  distribution: EpochDataResult['distributions'][0] | undefined;
}) => {
  return (
    <Flex
      css={{
        justifyContent: 'center',
        height: '$lg',
        fontSize: '$small',
        mb: '$lg',
      }}
    >
      {distribution && (
        <Text css={{ color: '$primary' }}>
          Distribution completed{' '}
          {formatRelative(parseISO(distribution.created_at + 'Z'), Date.now())}
        </Text>
      )}
    </Flex>
  );
};

const renderCombinedSum = (giftAmt: string, fixedAmt: string) =>
  formatUnits(parseUnits(giftAmt || '0').add(parseUnits(fixedAmt)));

const EtherscanButton = ({
  distribution,
}: {
  distribution: EpochDataResult['distributions'][0];
}) => {
  const explorerHref = makeExplorerUrl(
    distribution.vault.chain_id,
    distribution.tx_hash
  );
  return (
    <Button
      type="button"
      color="primary"
      outlined
      fullWidth
      as="a"
      target="_blank"
      href={explorerHref}
    >
      View on Etherscan
    </Button>
  );
};
