import assert from 'assert';

import { order_by } from 'lib/gql/__generated__/zeus';
import { client } from 'lib/gql/client';
import { INTEGRATION_TYPE as HEDGEY } from 'lib/hedgey';
import type { Contracts } from 'lib/vaults';

import type { Awaited } from 'types/shim';

export const getProfileIds = async (addresses: string[]) => {
  const { profiles } = await client.query(
    {
      profiles: [
        { where: { address: { _in: addresses } } },
        {
          id: true,
          address: true,
        },
      ],
    },
    {
      operationName: 'getProfileIds__DistributionPage',
    }
  );
  return profiles;
};

export const getEpochData = async (
  epochId: number,
  myAddress?: string,
  contracts?: Contracts
) => {
  assert(myAddress);

  const gq = await client.query(
    {
      epochs_by_pk: [
        { id: epochId },
        {
          id: true,
          number: true,
          ended: true,
          start_date: true,
          end_date: true,
          description: true,
          circle: {
            id: true,
            name: true,
            fixed_payment_token_type: true,
            fixed_payment_vault_id: true,
            token_name: true,
            // get this user's role so we can check that they're an admin
            users: [
              { where: { address: { _eq: myAddress.toLowerCase() } } },
              { role: true },
            ],
            ...(!!contracts && {
              organization: {
                name: true,
                vaults: [
                  {
                    where: {
                      profile: { address: { _eq: myAddress.toLowerCase() } },
                      chain_id: { _eq: Number(contracts.chainId) },
                    },
                  },
                  {
                    id: true,
                    symbol: true,
                    decimals: true,
                    vault_address: true,
                    simple_token_address: true,
                  },
                ],
              },
            }),
            integrations: [{ where: { type: { _eq: HEDGEY } } }, { id: true }],
          },
          token_gifts: [
            { where: { tokens: { _gt: 0 } } },
            {
              recipient_address: true,
              recipient_id: true,
              recipient: {
                id: true,
                name: true,
                address: true,
                profile: { avatar: true, id: true, name: true },
              },
              tokens: true,
            },
          ],
          distributions: [
            { where: { tx_hash: { _is_null: false } } },
            {
              created_at: true,
              total_amount: true,
              tx_hash: true,
              distribution_type: true,
              distribution_json: [{}, true],
              gift_amount: true,
              fixed_amount: true,
              vault: {
                id: true,
                decimals: true,
                symbol: true,
                vault_address: true,
                simple_token_address: true,
                chain_id: true,
                price_per_share: true,
              },
              epoch: {
                number: true,
                circle: { id: true, name: true },
              },
              claims: [
                {},
                {
                  id: true,
                  new_amount: true,
                  address: true,
                  profile_id: true,
                  profile: { avatar: true },
                },
              ],
            },
          ],
        },
      ],
    },
    { operationName: 'getEpochData' }
  );

  const epoch = gq.epochs_by_pk;
  return { ...epoch, distributions: epoch?.distributions || [] };
};

export type EpochDataResult = Awaited<ReturnType<typeof getEpochData>>;
export type Gift = Exclude<EpochDataResult['token_gifts'], undefined>[0];

export const getExistingLockedTokenDistribution = async (epochId: number) => {
  const response = await client.query(
    {
      locked_token_distributions: [
        {
          limit: 1,
          where: {
            epoch_id: { _eq: epochId },
            tx_hash: { _is_null: false },
          },
        },
        {
          id: true,
          tx_hash: true,
          chain_id: true,
          token_decimals: true,
          token_symbol: true,
          locked_token_distribution_gifts: [
            { where: { earnings: { _gt: 0 } } },
            {
              profile: { address: true },
              earnings: true,
            },
          ],
        },
      ],
    },
    {
      operationName: 'getPreviousLockedTokenDistribution',
    }
  );
  const [lockedTokenDistribution] = response.locked_token_distributions;
  return lockedTokenDistribution;
};

export const getPreviousDistribution = async (
  circleId: number,
  vaultId: number
): Promise<typeof distributions[0] | undefined> => {
  const { distributions } = await client.query(
    {
      distributions: [
        {
          order_by: [{ id: order_by.desc }],
          limit: 1,
          where: {
            epoch: { circle_id: { _eq: circleId } },
            vault_id: { _eq: vaultId },
            tx_hash: { _is_null: false },
          },
        },
        {
          id: true,
          vault_id: true,
          distribution_json: [{}, true],
          tx_hash: true,
        },
      ],
    },
    {
      operationName: 'getPreviousDistribution',
    }
  );
  return distributions?.[0];
};

export type PreviousDistribution = Exclude<
  Awaited<ReturnType<typeof getPreviousDistribution>>,
  undefined
>;
