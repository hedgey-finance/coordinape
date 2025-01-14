import { ValueTypes } from '../__generated__/zeus';
import { client } from '../client';

export const addVault = (payload: ValueTypes['CreateVaultInput']) =>
  client.mutate(
    {
      createVault: [
        { payload },
        {
          vault: {
            id: true,
            created_at: true,
            created_by: true,
            decimals: true,
            simple_token_address: true,
            symbol: true,
            token_address: true,
            updated_at: true,
            vault_address: true,
            chain_id: true,
            deployment_block: true,
            organization: {
              name: true,
            },
            vault_transactions: [
              {},
              {
                tx_hash: true,
                tx_type: true,
                created_at: true,
                profile: {
                  address: true,
                  name: true,
                  users: [{}, { circle_id: true, name: true }],
                },
                distribution: {
                  claims: [{}, { profile_id: true }],
                  fixed_amount: true,
                  gift_amount: true,
                  epoch: {
                    start_date: true,
                    end_date: true,
                    number: true,
                    circle: { name: true },
                  },
                },
              },
            ],
          },
        },
      ],
      delete_pending_vault_transactions_by_pk: [
        { tx_hash: payload.tx_hash },
        { __typename: true },
      ],
    },
    { operationName: 'addVault' }
  );

export const addVaultTx = (payload: ValueTypes['LogVaultTxInput']) =>
  client.mutate(
    {
      createVaultTx: [{ payload }, { __typename: true }],
    },
    { operationName: 'createVaultTx' }
  );

export async function savePendingVaultTx(
  input: ValueTypes['pending_vault_transactions_insert_input']
) {
  client.mutate(
    {
      insert_pending_vault_transactions_one: [
        { object: { ...input } },
        { __typename: true },
      ],
    },
    { operationName: 'savePendingVaultTx' }
  );
}
