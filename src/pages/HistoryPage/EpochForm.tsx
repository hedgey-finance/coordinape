import { useState, useMemo, useEffect, useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import isEmpty from 'lodash/isEmpty';
import { DateTime, Interval } from 'luxon';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { useQueryClient } from 'react-query';
import { SafeParseReturnType, z } from 'zod';

import {
  FormInputField,
  FormRadioGroup,
  FormDatePicker,
  FormTimePicker,
} from 'components';
import { useApiAdminCircle } from 'hooks';
import { Info } from 'icons/__generated';
import { QUERY_KEY_MY_ORGS } from 'pages/CirclesPage/getOrgData';
import {
  Box,
  Flex,
  Form,
  FormLabel,
  Link,
  Text,
  Button,
  Panel,
  Tooltip,
} from 'ui';
import { TwoColumnLayout } from 'ui/layouts';

import { IQueryEpoch, QueryFutureEpoch } from './getHistoryData';

const longFormat = "DD 'at' H:mm";

interface IEpochFormSource {
  epoch?: IQueryEpoch;
  epochs?: IQueryEpoch[];
}
const EpochRepeatEnum = z.enum(['none', 'monthly', 'weekly']);
type TEpochRepeatEnum = typeof EpochRepeatEnum['_type'];

const schema = z
  .object({
    start_date: z.string(),
    repeat: EpochRepeatEnum,
    description: z
      .optional(
        z.nullable(
          z
            .string()
            .refine(val => val.trim().length >= 10, {
              message: 'Description should be at least 10 characters long',
            })
            .refine(val => val.length < 100, {
              message: 'Description length should not exceed 100 characters',
            })
        )
      )
      .transform(val => (val === '' ? null : val)),
    days: z
      .number()
      .refine(n => n >= 1, { message: 'Must be at least one day.' })
      .refine(n => n <= 100, { message: 'cant be more than 100 days' }),
    customError: z.undefined(), //unregistered to disable submitting
  })
  .strict();
const nextIntervalFactory = (repeat: TEpochRepeatEnum) => {
  const increment = repeat === 'weekly' ? { weeks: 1 } : { months: 1 };
  return (i: Interval) =>
    Interval.fromDateTimes(i.start.plus(increment), i.end.plus(increment));
};

const extraEpoch = (raw: QueryFutureEpoch): IQueryEpoch => {
  const startDate = DateTime.fromISO(raw.start_date, {
    zone: 'utc',
  });
  const endDate = DateTime.fromISO(raw.end_date, { zone: 'utc' });

  const calculatedDays = endDate.diff(startDate, 'days').days;

  const repeatEnum =
    raw.repeat === 2 ? 'monthly' : raw.repeat === 1 ? 'weekly' : 'none';

  return {
    ...raw,
    repeatEnum,
    startDate,
    interval: startDate.until(endDate),
    calculatedDays,
  };
};

const getCollisionMessage = (
  newInterval: Interval,
  newRepeat: TEpochRepeatEnum,
  e: IQueryEpoch
) => {
  if (
    newInterval.overlaps(e.interval) ||
    (e.repeatEnum === 'none' && newRepeat === 'none')
  ) {
    return newInterval.overlaps(e.interval)
      ? `Overlap with an epoch starting ${e.startDate.toFormat(longFormat)}`
      : undefined;
  }
  // Only one will be allowed to be repeating
  // Set r as the repeating and c as the constant interval.
  const [r, c, next] =
    e.repeatEnum !== 'none'
      ? [e.interval, newInterval, nextIntervalFactory(e.repeatEnum)]
      : [newInterval, e.interval, nextIntervalFactory(newRepeat)];

  if (c.isBefore(r.start) || +c.end === +r.start) {
    return undefined;
  }

  let rp = r;
  while (rp.start < c.end) {
    if (rp.overlaps(c)) {
      return e.repeatEnum !== 'none'
        ? `Overlap with repeating epoch ${e.number ?? 'x'}: ${rp.toFormat(
            longFormat
          )}`
        : `After repeat, new epoch overlaps ${
            e.number ?? 'x'
          }: ${e.startDate.toFormat(longFormat)}`;
    }
    rp = next(rp);
  }

  return undefined;
};

const getZodParser = async (
  source?: IEpochFormSource,
  currentEpoch?: number
) => {
  const otherRepeating = source?.epochs?.find(e => !!e.repeat);

  const getOverlapIssue = ({
    start_date,
    days,
    repeat,
  }: {
    start_date: DateTime;
    days: number;
    repeat: TEpochRepeatEnum;
  }) => {
    const interval = Interval.fromDateTimes(
      start_date,
      start_date.plus({ days })
    );

    const collisionMessage = source?.epochs
      ? source?.epochs
          .map(e => getCollisionMessage(interval, repeat, e))
          .find(m => m !== undefined)
      : undefined;

    return collisionMessage === undefined
      ? undefined
      : {
          path: ['start_dateTime'],
          message: collisionMessage,
        };
  };

  return schema
    .transform(
      async ({ start_date, ...fields }) =>
        await {
          start_date: DateTime.fromISO(start_date).setZone(),
          ...fields,
        }
    )
    .refine(
      ({ start_date }) =>
        start_date > DateTime.now().setZone() ||
        source?.epoch?.id === currentEpoch,
      {
        path: ['start_date'],
        message: 'Start date must be in the future',
      }
    )
    .refine(
      ({ start_date, days }) =>
        start_date.plus({ days }) > DateTime.now().setZone(),
      {
        path: ['days'],
        message: 'Epoch must end in the future',
      }
    )
    .superRefine((val, ctx) => {
      let message;
      if (val.days > 7 && val.repeat === 'weekly') {
        message =
          'You cannot have more than 7 days length for a weekly repeating epoch.';
      } else if (val.days > 28 && val.repeat === 'monthly') {
        message =
          'You cannot have more than 28 days length for a monthly repeating epoch.';
      }

      if (message) {
        ctx.addIssue({
          path: ['days'],
          code: z.ZodIssueCode.custom,
          message,
        });
      }
    })
    .refine(({ repeat }) => !(repeat !== 'none' && !!otherRepeating), {
      path: ['repeat'],
      // the getOverlapIssue relies on this invariant.
      message: `Only one repeating epoch allowed.`,
    })
    .refine(
      v => !getOverlapIssue(v),
      v => getOverlapIssue(v) ?? {}
    )
    .transform(({ start_date, ...fields }) => ({
      start_date: start_date.toISO(),
      ...fields,
    }));
};

type epochFormSchema = z.infer<typeof schema>;

const repeat = [
  {
    label: 'Does not repeat',
    value: 'none',
  },
  {
    label: 'Repeats monthly',
    value: 'monthly',
  },
  {
    label: 'Repeats weekly',
    value: 'weekly',
  },
];

const EpochForm = ({
  selectedEpoch,
  epochs,
  currentEpoch,
  circleId,
  setNewEpoch,
  setEditEpoch,
  onClose,
}: {
  selectedEpoch: QueryFutureEpoch | undefined;
  epochs: QueryFutureEpoch[] | undefined;
  currentEpoch: QueryFutureEpoch | undefined;
  circleId: number;
  setNewEpoch: (e: boolean) => void;
  setEditEpoch: (e: QueryFutureEpoch | undefined) => void;
  onClose: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const { createEpoch, updateEpoch } = useApiAdminCircle(circleId);

  const queryClient = useQueryClient();

  const source = useMemo(
    () => ({
      epoch: selectedEpoch ? extraEpoch(selectedEpoch) : undefined,
      epochs: currentEpoch
        ? currentEpoch.id !== selectedEpoch?.id
          ? epochs
              ?.filter(e => e.id !== selectedEpoch?.id)
              .concat(currentEpoch)
              .map(e => extraEpoch(e))
          : epochs?.map(e => extraEpoch(e))
        : epochs
            ?.filter(e => e.id !== selectedEpoch?.id)
            .map(e => extraEpoch(e)),
    }),
    [selectedEpoch, epochs, currentEpoch]
  );
  const {
    control,
    formState: { errors, isDirty },
    watch,
    handleSubmit,
    setError,
    clearErrors,
  } = useForm<epochFormSchema>({
    resolver: zodResolver(schema),
    mode: 'all',
    defaultValues: {
      days: source?.epoch?.days ?? source?.epoch?.calculatedDays ?? 4,
      start_date:
        source?.epoch?.start_date ??
        DateTime.now().setZone().plus({ days: 1 }).toISO(),
      description: source.epoch?.description,
    },
  });

  const [watchFields, setWatchFields] = useState<
    Omit<epochFormSchema, 'repeat'> & { repeat: string | number }
  >({
    days: source?.epoch?.days ?? source?.epoch?.calculatedDays ?? 4,
    start_date:
      source?.epoch?.start_date ??
      DateTime.now().setZone().plus({ days: 1 }).toISO(),
    repeat:
      source?.epoch?.repeat === 2
        ? 'monthly'
        : source?.epoch?.repeat === 1
        ? 'weekly'
        : 'none',
    description: source?.epoch?.description,
  });
  const extraErrors = useRef(false);

  useEffect(() => {
    watch(async data => {
      const value: SafeParseReturnType<epochFormSchema, epochFormSchema> =
        await getZodParser(source, currentEpoch?.id).then(result =>
          result.safeParseAsync(data)
        );
      if (!value.success) {
        extraErrors.current = true;
        setError('customError', {
          message: value.error.errors[0].message,
        });
      } else {
        extraErrors.current = false;
        clearErrors('customError');
      }
      const newValues = { ...watchFields };
      if (data.days) newValues.days = data.days;
      if (data.repeat) newValues.repeat = data.repeat;
      if (data.start_date) newValues.start_date = data.start_date;
      setWatchFields({ ...newValues });
    });
  }, [watch]);

  const onSubmit: SubmitHandler<epochFormSchema> = async data => {
    if (extraErrors.current) {
      return;
    }
    setSubmitting(true);
    (source?.epoch
      ? updateEpoch(source.epoch.id, {
          days: data.days,
          start_date: data.start_date,
          repeat:
            data.repeat === 'weekly' ? 1 : data.repeat === 'monthly' ? 2 : 0,
          ...(data.description !== null && { description: data.description }),
        })
      : createEpoch({
          ...data,
          repeat:
            data.repeat === 'weekly' ? 1 : data.repeat === 'monthly' ? 2 : 0,
        })
    )
      .then(() => {
        setSubmitting(false);
        queryClient.invalidateQueries(QUERY_KEY_MY_ORGS);
      })
      .then(onClose)
      .catch(console.warn);
  };

  return (
    <Form>
      <Panel css={{ mb: '$md', p: '$md' }}>
        <Flex
          css={{
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '$md',
          }}
        >
          <Text semibold css={{ color: '$secondaryText', fontSize: 'large' }}>
            {selectedEpoch ? 'Edit Epoch' : 'New Epoch'}
          </Text>

          <Flex css={{ gap: '$md', flexWrap: 'wrap' }}>
            <Button
              color="secondary"
              onClick={() => {
                selectedEpoch ? setEditEpoch(undefined) : setNewEpoch(false);
              }}
            >
              Cancel
            </Button>

            <Button
              color="primary"
              type="submit"
              disabled={submitting || !isDirty || !isEmpty(errors)}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </Flex>
        </Flex>
        <Panel nested css={{ mt: '$md' }}>
          <TwoColumnLayout>
            <Flex column>
              <Text h3 semibold>
                Epoch Settings
              </Text>
              <Text p size="small" css={{ mt: '$sm ' }}>
                An Epoch is a period of time where circle members contribute
                value & allocate {'GIVE'} tokens to one another.{' '}
                <span>
                  <Link
                    href="https://docs.coordinape.com/get-started/epochs/create-an-epoch"
                    rel="noreferrer"
                    target="_blank"
                    inlineLink
                  >
                    Learn More
                  </Link>
                </span>
              </Text>
            </Flex>
            <FormInputField
              id="description"
              name="description"
              defaultValue={source.epoch?.description}
              control={control}
              label="DESCRIPTION"
              infoTooltip="A brief description of this epoch"
            />
            <Flex column css={{ gap: '$lg' }}>
              <Text h3>Epoch Timing</Text>
              <Flex css={{ gap: '$xs' }}>
                <Flex
                  column
                  alignItems="start"
                  css={{
                    maxWidth: '150px',
                    gap: '$xs',
                  }}
                >
                  <FormLabel type="label" css={{ fontWeight: '$bold' }}>
                    Start Date{' '}
                    <Tooltip content="The first day of the epoch in your local time zone">
                      <Info size="sm" />
                    </Tooltip>
                  </FormLabel>
                  <Controller
                    control={control}
                    name="start_date"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <FormDatePicker
                        onChange={onChange}
                        value={value}
                        onBlur={onBlur}
                        disabled={
                          selectedEpoch &&
                          currentEpoch?.id === selectedEpoch?.id
                        }
                        format="MMM dd, yyyy"
                        style={{
                          marginLeft: 0,
                        }}
                      />
                    )}
                  />
                </Flex>
                <Flex css={{ maxWidth: '150px' }}>
                  <FormInputField
                    id="days"
                    name="days"
                    defaultValue={
                      source?.epoch?.days ?? source?.epoch?.calculatedDays ?? 4
                    }
                    control={control}
                    label="Duration (days)"
                    infoTooltip="How long the epoch lasts in days"
                    number
                  />
                </Flex>
                <Flex column css={{ gap: '$xs' }}>
                  <FormLabel type="label" css={{ fontWeight: '$bold' }}>
                    Start Time{' '}
                    <Tooltip content="The start time of the epoch in your local time zone">
                      <Info size="sm" />
                    </Tooltip>
                  </FormLabel>
                  <Flex row css={{ gap: '$sm' }}>
                    <Controller
                      control={control}
                      name="start_date"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <Box
                          css={{
                            maxWidth: '150px',
                            '> div': { mb: '0 !important' },
                          }}
                        >
                          <FormTimePicker
                            onBlur={onBlur}
                            onChange={onChange}
                            value={value}
                            disabled={
                              selectedEpoch &&
                              currentEpoch?.id === selectedEpoch?.id
                            }
                          />
                        </Box>
                      )}
                    />
                    <Text size="medium">
                      In your
                      <br /> local timezone
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
              <FormRadioGroup
                name="repeat"
                control={control}
                defaultValue={
                  source?.epoch?.repeat === 2
                    ? 'monthly'
                    : source?.epoch?.repeat === 1
                    ? 'weekly'
                    : 'none'
                }
                options={repeat}
                label="Type"
                infoTooltip="Decide whether the epoch will repeat monthly or weekly or will not repeat after ending"
              />
            </Flex>
            <Flex column>
              {epochsPreview(watchFields)}
              <Text p css={{ mt: '$lg' }}>
                {summarizeEpoch(watchFields)}
              </Text>
            </Flex>
          </TwoColumnLayout>
          {!isEmpty(errors) && (
            <Box
              css={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                mt: '$md',
                color: '$alert',
              }}
            >
              {Object.values(errors).map((error, i) => (
                <div key={i}>{error.message}</div>
              ))}
            </Box>
          )}
        </Panel>
      </Panel>
    </Form>
  );
};

const epochsPreview = (
  value: Omit<epochFormSchema, 'repeat'> & { repeat: string | number }
) => {
  const epochStart = DateTime.fromISO(value.start_date).setZone();
  const epochEnd = epochStart.plus({
    days: value.days,
  });
  return (
    <Flex column css={{ gap: '$xs' }}>
      <Text variant="label">Preview</Text>
      <Text bold css={{ mt: '$sm' }}>
        Epoch 1
      </Text>
      <Text>
        {epochStart.toFormat('ccc LLL d')} - {epochEnd.toFormat('ccc LLL d')}
      </Text>
      {(value.repeat === 'weekly' || value.repeat === 'monthly') && (
        <>
          <Text bold css={{ mt: '$sm' }}>
            Epoch 2
          </Text>
          <Text>
            {epochStart
              .plus(value.repeat === 'monthly' ? { months: 1 } : { weeks: 1 })
              .toFormat('ccc LLL d')}{' '}
            -{' '}
            {epochEnd
              .plus(value.repeat === 'monthly' ? { months: 1 } : { weeks: 1 })
              .toFormat('ccc LLL d')}
          </Text>
          <Text bold css={{ mt: '$sm' }}>
            Epoch 3
          </Text>
          <Text>
            {epochStart
              .plus(value.repeat === 'monthly' ? { months: 2 } : { weeks: 2 })
              .toFormat('ccc LLL d')}{' '}
            -{' '}
            {epochEnd
              .plus(value.repeat === 'monthly' ? { months: 2 } : { weeks: 2 })
              .toFormat('ccc LLL d')}
          </Text>
        </>
      )}
      <Text css={{ mt: '$sm' }}>
        {value.repeat === 'monthly'
          ? 'Repeats monthly'
          : value.repeat === 'weekly'
          ? 'Repeats weekly'
          : ''}
      </Text>
    </Flex>
  );
};

const summarizeEpoch = (
  value: Omit<epochFormSchema, 'repeat'> & { repeat: string | number }
) => {
  const startDate = DateTime.fromISO(value.start_date)
    .setZone()
    .toFormat(longFormat);
  const endDate = DateTime.fromISO(value.start_date)
    .setZone()
    .plus({ days: value.days })
    .toFormat(longFormat);

  const nextRepeat = DateTime.fromISO(value.start_date)
    .setZone()
    .plus(value.repeat === 'monthly' ? { months: 1 } : { weeks: 1 })
    .toFormat('DD');

  const repeating =
    value.repeat === 'monthly'
      ? `The epoch is set to repeat every month; the following epoch will start on ${nextRepeat}.`
      : value.repeat === 'weekly'
      ? `The epoch is set to repeat every week; the following epoch will start on ${nextRepeat}.`
      : "The epoch doesn't repeat.";

  return `This epoch starts on ${startDate} and will end on ${endDate}. ${repeating}`;
};
export default EpochForm;
