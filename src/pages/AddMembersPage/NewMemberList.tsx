import React, { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ENTRANCE } from 'common-lib/constants';
import { client } from 'lib/gql/client';
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form';
import { useQueryClient } from 'react-query';
import { z } from 'zod';

import { LoadingModal } from '../../components';
import CopyCodeTextField from '../../components/CopyCodeTextField';
import { useToast, useApiBase } from '../../hooks';
import { zEthAddress, zUsername } from '../../lib/zod/formHelpers';
import { Box, Button, Flex, Panel, Text } from '../../ui';
import { Check } from 'icons/__generated';
import { QUERY_KEY_CIRCLE_SETTINGS } from 'pages/CircleAdminPage/getCircleSettings';

import NewMemberEntry from './NewMemberEntry';
import NewMemberGridBox from './NewMemberGridBox';

export type NewMember = {
  name: string;
  address: string;
  entrance: string;
};

type ChangedUser = {
  oldName?: string;
  newName: string;
  address?: string;
};
const NewMemberList = ({
  // TODO: revoke comes later - maybe on admin page
  // revokeWelcome,
  circleId,
  welcomeLink,
  preloadedMembers,
}: {
  circleId: number;
  welcomeLink: string;
  revokeWelcome(): void;
  preloadedMembers: NewMember[];
}) => {
  const { fetchCircle } = useApiBase();
  const { showError } = useToast();

  const [loading, setLoading] = useState<boolean>();
  const [successCount, setSuccessCount] = useState<number>(0);
  const [changedUsers, setChangedUsers] = useState<ChangedUser[] | undefined>(
    undefined
  );

  const [defaultMembers, setDefaultMembers] =
    useState<NewMember[]>(preloadedMembers);

  const successRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  const emptyMember = { name: '', address: '', entrance: '' };

  const newMemberSchema = z.object({
    newMembers: z.array(
      z
        .object({
          address: zEthAddress.or(z.literal('')),
          name: zUsername.or(z.literal('')),
          entrance: z.string(),
        })
        .superRefine((data, ctx) => {
          if (data.name && data.name !== '' && data.address === '') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['address'],
              message: 'Address is required if name is provided',
            });
          }
          if (data.address && data.address !== '' && data.name === '') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['name'],
              message: 'Name is required if address is provided',
            });
          }
        })
    ),
  });

  type FormSchema = z.infer<typeof newMemberSchema>;

  const defaultValues = {
    newMembers: [...defaultMembers, emptyMember, emptyMember],
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
    watch,
    trigger,
  } = useForm<FormSchema>({
    resolver: zodResolver(newMemberSchema),
    reValidateMode: 'onChange',
    mode: 'onChange',
    defaultValues,
  });

  const {
    fields: newMemberFields,
    append: appendNewMember,
    remove: removeNewMember,
  } = useFieldArray({
    name: 'newMembers',
    control,
  });

  const newMembers = watch('newMembers');

  const submitNewMembers: SubmitHandler<FormSchema> = async data => {
    const { newMembers } = data;
    try {
      setLoading(true);
      setSuccessCount(0);
      setChangedUsers(undefined);
      const filteredMembers = newMembers
        .filter(m => m.address != '' && m.name != '')
        .map(m => ({
          ...m,
          entrance:
            m.entrance === ENTRANCE.CSV ? ENTRANCE.CSV : ENTRANCE.MANUAL,
        }));
      const res = await client.mutate(
        {
          createUsers: [
            {
              payload: {
                circle_id: circleId,
                users: filteredMembers,
              },
            },
            {
              UserResponse: {
                address: true,
                profile: {
                  name: true,
                },
              },
            },
          ],
        },
        {
          operationName: 'createUsers_newMemberList',
        }
      );

      const replacedNames = res?.createUsers
        ?.filter(res =>
          filteredMembers.find(
            m =>
              m.address.toLowerCase() ===
                res.UserResponse?.address.toLowerCase() &&
              res.UserResponse.profile.name &&
              m.name !== res.UserResponse.profile.name
          )
        )
        .map(res => ({
          oldName: filteredMembers.find(
            m =>
              m.address.toLowerCase() ===
              res.UserResponse?.address.toLowerCase()
          )?.name,
          newName: res.UserResponse?.profile.name,
          address: res.UserResponse?.address,
        }));

      setChangedUsers(replacedNames);
      // ok it worked, clear out?
      setSuccessCount(filteredMembers.length);
      setDefaultMembers([]);
      reset({ newMembers: [emptyMember, emptyMember] });
      successRef.current?.scrollIntoView();
      await queryClient.invalidateQueries([
        QUERY_KEY_CIRCLE_SETTINGS,
        circleId,
      ]);
      await fetchCircle({ circleId });
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  };

  const newMemberFocused = (idx: number) => {
    // make sure there is at least idx+1 elements in the namesToAdd Array
    if (newMemberFields.length - 1 <= idx) {
      appendNewMember(emptyMember, { shouldFocus: false });
    }
  };

  function errorForMemberIndex(idx: number) {
    let err: { name?: string; address?: string } | undefined = undefined;
    if (errors) {
      const addrErrors = errors['newMembers'] as {
        address?: { message?: string };
        name?: { message?: string };
        message?: string;
      }[];
      if (addrErrors) {
        const e = {
          name: addrErrors[idx]?.name?.message,
          address: addrErrors[idx]?.address?.message,
        };

        // if there is an error pass it along
        if (e.name || e.address) {
          err = e;
        }
      }
    }
    return err;
  }

  useEffect(() => {
    // do initial form validation to validate the preloaded values (from csv or other import)
    trigger().then();
  }, []);

  return (
    <Box>
      <Panel invertForm css={{ padding: 0 }}>
        <form onSubmit={handleSubmit(submitNewMembers)}>
          {loading && <LoadingModal visible={true} />}
          <Box data-testid="new-members">
            <NewMemberGridBox>
              <Box>
                <Text variant="label">Name</Text>
              </Box>
              <Box>
                <Text variant="label">Wallet Address</Text>
              </Box>
            </NewMemberGridBox>
            {newMemberFields.map((field, idx) => {
              const err = errorForMemberIndex(idx);
              return (
                <NewMemberEntry
                  key={field.id}
                  onFocus={() => newMemberFocused(idx)}
                  onRemove={idx > 0 ? () => removeNewMember(idx) : undefined}
                  register={register}
                  index={idx}
                  error={err}
                />
              );
            })}
          </Box>
          <Box>
            <Button
              type="submit"
              disabled={
                loading ||
                !isValid ||
                newMembers.filter(m => m.address != '' && m.name != '')
                  .length == 0
              }
              color="primary"
              size="large"
              fullWidth
            >
              Add Members
            </Button>
          </Box>
        </form>
      </Panel>

      <div ref={successRef}>
        {successCount > 0 && (
          <>
            <Panel
              css={{ mt: '$xl', border: '1px solid $currentEpochDescription' }}
            >
              <Flex>
                <Check
                  color="currentEpochDescription"
                  size="lg"
                  css={{ mr: '$md' }}
                />
                <Box css={{ color: '$currentEpochDescription', flexGrow: 1 }}>
                  <Text size="medium" color="inherit">
                    You have added {successCount} member
                    {successCount == 1 ? '' : 's'}
                    !&nbsp;
                    <Text semibold color="inherit">
                      Share this link to get them started.
                    </Text>
                  </Text>
                  <Box css={{ mt: '$md' }}>
                    <CopyCodeTextField value={welcomeLink} />
                  </Box>
                </Box>
              </Flex>
            </Panel>

            {changedUsers && changedUsers.length > 0 && (
              <Panel alert css={{ mt: '$xl' }}>
                <Flex column css={{ gap: '$sm' }}>
                  <Text color="inherit" size="medium">
                    Some addresses match existing accounts in our system, so
                    their names will be used:
                  </Text>
                  {changedUsers.map(user => (
                    <Text color="inherit" key={user.newName}>
                      &ldquo;{user.newName}&ldquo; will be used instead of
                      &ldquo;{user.oldName}&ldquo; for {user.address}
                    </Text>
                  ))}
                </Flex>
              </Panel>
            )}

            {/*<Box css={{ mt: '$xl' }}>*/}
            {/*  <div>*/}
            {/*    <Text variant="label" css={{ mb: '$xs' }}>*/}
            {/*      Shareable Circle Link*/}
            {/*    </Text>*/}

            {/*    /!* Revoke is disabled for now until we figure out the UI for it*!/*/}
            {/*    /!*<Button color={'transparent'} onClick={revokeWelcome}>*!/*/}
            {/*    /!*  <Working />*!/*/}
            {/*    /!*</Button>*!/*/}
            {/*  </div>*/}
            {/*</Box>*/}
          </>
        )}
      </div>
    </Box>
  );
};

export default NewMemberList;
