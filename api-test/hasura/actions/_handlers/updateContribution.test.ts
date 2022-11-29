import assert from 'assert';
import { DateTime } from 'luxon';

import { adminClient } from '../../../../api-lib/gql/adminClient';
import {
  createCircle,
  createContribution,
  createEpoch,
  createProfile,
  createUser,
  mockUserClient,
} from '../../../helpers';
import { getUniqueAddress } from '../../../helpers/getUniqueAddress';

let address, profile, circle, user;

beforeEach(async () => {
  address = await getUniqueAddress();
  circle = await createCircle(adminClient);
  profile = await createProfile(adminClient, { address });
  user = await createUser(adminClient, { address, circle_id: circle.id });
});

const default_req = {
  datetime_created: DateTime.now().toISO(),
  description: 'wen moon',
};

describe('Update Contribution action handler', () => {
  test('Test normal update contribution flow', async () => {
    const client = mockUserClient({ profileId: profile.id, address });
    const contribution = await createContribution(adminClient,  
      {
        circle_id: circle.id,
        user_id: user.id,
        description: 'i did a thing'
      });
    assert(contribution);
    const { updateContribution: result } = await client.mutate({
      updateContribution: [
        {
          payload: { id: contribution.id, ...default_req },
        },
        { id: true },
      ],
    });
    expect(result?.id).toBe(contribution.id);
  });

  test('cannot modify a contribution in a closed epoch', async () => {
    const client = mockUserClient({ profileId: profile.id, address });
    const startDate = DateTime.now().minus({ days: 4})
    const contribution = await createContribution(adminClient,  
      {
        circle_id: circle.id,
        user_id: user.id,
        description: 'i did a thing',
        datetime_created: startDate.toISO()
      });
    assert(contribution);
    const epoch = await createEpoch(adminClient, { circle_id: circle.id, start_date: startDate});
    const result = client.mutate({
      updateContribution: [
        {
          payload: { id: contribution.id, ...default_req },
        },
        { id: true },
      ],
    });
    
    expect.assertions(1);
    await expect(result).rejects.toThrow();
  });

  test('cannot move contribution to a closed epoch', async () => {
    const client = mockUserClient({ profileId: profile.id, address });
    const contribution = await createContribution(adminClient,  
      {
        circle_id: circle.id,
        user_id: user.id,
        description: 'i did a thing'
      });
    assert(contribution);
    const epoch = await createEpoch(adminClient, { circle_id: circle.id, start_date: DateTime.now().minus({ days: 4})});
    const result = client.mutate({
      updateContribution: [
        {
          payload: { 
            id: contribution.id, 
            datetime_created: DateTime.now().minus({days: 4}).toISO(),
            description: 'wen moon'
          },
        },
        { id: true },
      ],
    });
    
    expect.assertions(1);
    await expect(result).rejects.toThrow();
  });

  test('cannot modify a contribution from a different user', async () => {
    const newAddress = await getUniqueAddress();
    const newProfile = await createProfile(adminClient, { address: newAddress });
    await createUser(adminClient, { address: newAddress, circle_id: circle.id });
    const client = mockUserClient({ profileId: newProfile.id, address: newAddress });
    const contribution = await createContribution(adminClient,  
      {
        circle_id: circle.id,
        user_id: user.id,
        description: 'i did a thing'
      });
    assert(contribution);
    const result = client.mutate({
      updateContribution: [
        {
          payload: { id: contribution.id, ...default_req },
        },
        { id: true },
      ],
    });
    
    expect.assertions(1);
    await expect(result).rejects.toThrow();
  });
});
