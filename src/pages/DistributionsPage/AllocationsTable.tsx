import { useCallback } from 'react';

import { formatUnits } from 'ethers/lib/utils';
import sumBy from 'lodash/sumBy';
import uniqBy from 'lodash/uniqBy';

import { makeTable } from 'components';
import { Flex, Text, Panel, Button, Link, Avatar } from 'ui';
import { smartRounding, numberWithCommas, shortenAddress } from 'utils';

import type { Gift } from './queries';
import { EpochDataResult } from './queries';
import type { CustomToken } from './types';

const styles = {
  alignRight: { textAlign: 'right' },
};

export const AllocationsTable = ({
  users,
  totalGive,
  formGiftAmount,
  tokenName,
  fixedTokenName,
  giveTokenName,
  downloadCSV,
  epoch,
  fixedDist,
  circleDist,
  isLockedTokenDistribution,
  lockedTokenDistributionDecimals,
  lockedTokenDistributionSymbol,
  customToken,
}: {
  users: {
    id: number;
    name: string;
    address: string;
    received: number;
    circleClaimed: number;
    combinedClaimed: number;
    fixedPaymentAmount: number;
    fixedPaymentClaimed: number;
    avatar: string | undefined;
    givers: number;
  }[];
  totalGive: number;
  formGiftAmount: number;
  tokenName: string | undefined;
  fixedTokenName: string | undefined;
  giveTokenName: string | undefined;
  downloadCSV: (
    epoch: number,
    epochId: number,
    formGiftAmount: number,
    giftTokenSymbol: string
  ) => Promise<any>;
  epoch: EpochDataResult;
  fixedDist: EpochDataResult['distributions'][0] | undefined;
  circleDist: EpochDataResult['distributions'][0] | undefined;
  isLockedTokenDistribution: boolean;
  lockedTokenDistributionDecimals: number;
  lockedTokenDistributionSymbol: string;
  customToken: CustomToken | undefined;
}) => {
  type User = Exclude<typeof users[0], undefined>;
  const givenPercent = useCallback(
    (received: number) => received / totalGive,
    [totalGive]
  );

  const showDeletedInfo = (token_gifts?: Gift[]) => {
    const deletedGifts = token_gifts?.filter((g: Gift) => !g.recipient);
    const sumGive = sumBy(deletedGifts, 'tokens');
    const num = uniqBy(deletedGifts, 'recipient_id').length;

    if (num < 1) return;
    return (
      <Text p as="p" size="medium" css={{ mt: '$sm' }}>
        Note: This epoch included {num} deleted {num > 1 ? 'users' : 'user'} who
        received {sumGive} GIVE.
      </Text>
    );
  };

  const combinedDist =
    tokenName && fixedTokenName && tokenName === fixedTokenName;

  const UserTable = makeTable<User>('UserTable');
  const rewardTitle = isLockedTokenDistribution
    ? 'Locked Token Rewards'
    : 'Circle Rewards';
  const headers = [
    { title: 'Name' },
    { title: 'ETH' },
    { title: 'Givers', css: styles.alignRight },
    { title: `${giveTokenName || 'GIVE'} Received`, css: styles.alignRight },
    { title: `% of ${giveTokenName || 'GIVE'}`, css: styles.alignRight },
    { title: rewardTitle, css: styles.alignRight },
    { title: 'Fixed Payments', css: styles.alignRight },
  ];
  if (combinedDist) {
    headers.push({ title: 'Funds Allocated', css: styles.alignRight });
  }
  return (
    <Panel>
      <Flex
        alignItems="center"
        css={{
          justifyContent: 'space-between',
          mb: '$lg',
        }}
      >
        <Text h3 css={{ fontWeight: '$semibold', color: '$headingText' }}>
          Distributions Table
        </Text>
        <Button
          type="button"
          color="secondary"
          onClick={async () => {
            // use the authed api to download the CSV
            if (epoch.number) {
              const csv = await downloadCSV(
                epoch.number,
                epoch.id,
                formGiftAmount,
                tokenName || ''
              );
              if (csv?.file) {
                const a = document.createElement('a');
                a.href = csv.file;
                a.click();
                a.href = '';
              }
            }
            return false;
          }}
        >
          Export CSV
        </Button>
      </Flex>
      <UserTable
        headers={headers}
        data={users}
        startingSortIndex={2}
        startingSortDesc
        perPage={10}
        sortByColumn={(index: number) => {
          if (index === 0) return (u: User) => u.name.toLowerCase();
          if (index === 1) return (u: User) => u.address.toLowerCase();
          return (u: User) => u.received;
        }}
      >
        {user => (
          <tr key={user.id}>
            <td>
              <Flex
                row
                alignItems="center"
                css={{ gap: '$sm', height: '$2xl' }}
              >
                <Avatar size="small" path={user.avatar} name={user.name} />
                <Text>{user.name}</Text>
              </Flex>
            </td>
            <td>{shortenAddress(user.address)}</td>
            <td className="alignRight">{user.givers}</td>
            <td className="alignRight">{user.received}</td>
            <td className="alignRight">
              {numberWithCommas(givenPercent(user.received) * 100, 2)}%
            </td>
            <td className="alignRight">
              {isLockedTokenDistribution
                ? `${formatUnits(
                    user.circleClaimed.toLocaleString('fullwide', {
                      useGrouping: false,
                    }),
                    lockedTokenDistributionDecimals
                  )} ${lockedTokenDistributionSymbol}`
                : circleDist
                ? `${smartRounding(user.circleClaimed)} ${tokenName || 'GIVE'}`
                : `${smartRounding(
                    givenPercent(user.received) * formGiftAmount
                  )} ${customToken?.symbol || tokenName || 'GIVE'}`}
            </td>
            <td className="alignRight">
              {fixedDist
                ? smartRounding(user.fixedPaymentClaimed)
                : smartRounding(user.fixedPaymentAmount)}{' '}
              {fixedTokenName || ''}
            </td>
            {combinedDist ? (
              <td className="alignRight">
                {(() => {
                  if (circleDist && fixedDist) {
                    return smartRounding(user.combinedClaimed);
                  }
                  const giftAmt = circleDist
                    ? user.circleClaimed
                    : givenPercent(user.received) * formGiftAmount;
                  return smartRounding(giftAmt + user.fixedPaymentAmount);
                })()}{' '}
                {tokenName}
              </td>
            ) : null}
          </tr>
        )}
      </UserTable>
      {showDeletedInfo(epoch.token_gifts)}
      <Flex
        css={{
          justifyContent: 'space-between',
          mt: '$lg',
        }}
      >
        <Text p as="p" size="medium" css={{ mt: '$sm' }}>
          <Link
            css={{ color: '$primary' }}
            target="_blank"
            href="https://docs.coordinape.com/get-started/compensation/paying-your-team"
          >
            Documentation: Paying Your Team
          </Link>
        </Text>
      </Flex>
    </Panel>
  );
};
