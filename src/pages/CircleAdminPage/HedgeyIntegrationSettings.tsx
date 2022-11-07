import { useState } from 'react';

import { Button, Flex, Modal, Select, SelectOption, Text } from 'ui';

function HedgeyIntro() {
  return (
    <>
      <Text h3 semibold css={{ mb: '$sm' }}>
        Hedgey Integration
      </Text>
      <Text p size="small" css={{ mb: '$md' }}>
        Hedgey is a protocol for locking tokens during fundraising and payroll.{' '}
        <a href="https://hedgey.finance" target="_blank" rel="noreferrer">
          Find out more
        </a>
      </Text>
    </>
  );
}

export const hedgeyLockPeriods: SelectOption[] = [
  { label: '1 month', value: '1' },
  { label: '2 months', value: '2' },
  { label: '3 months', value: '3' },
  { label: '4 months', value: '4' },
  { label: '5 months', value: '5' },
  { label: '6 months', value: '6' },
  { label: '12 months', value: '12' },
  { label: '18 months', value: '18' },
  { label: '24 months', value: '24' },
  { label: '48 months', value: '48' },
];

export default function HedgeyIntegrationSettings() {
  const [hedgeyEnabled, setHedgeyEnabled] = useState(false);
  const [hedgeyLockPeriod, setHedgeyLockPeriod] = useState('12');
  const [hedgeyTransferrable, setHedgeyTransferrable] = useState('1');
  const [showDisableModal, setShowDisableModal] = useState(false);

  const onSaveHedgeyIntegration = (e: any) => {
    e.preventDefault();
    // eslint-disable-next-line no-console
    console.log('Save hedgey integration with values:', {
      hedgeyEnabled,
      hedgeyLockPeriod,
      hedgeyTransferrable,
    });
  };

  const onDisableHedgey = () => {
    // eslint-disable-next-line no-console
    console.log('make a call to disable in the DB');
    setHedgeyEnabled(false);
    setShowDisableModal(false);
  };

  return (
    <>
      <Flex css={{ flexDirection: 'column', alignItems: 'start' }}>
        {!hedgeyEnabled && (
          <>
            <HedgeyIntro />
            <Button
              color="primary"
              outlined
              onClick={e => {
                e.preventDefault();
                setHedgeyEnabled(true);
              }}
            >
              Enable Hedgey Integration
            </Button>
          </>
        )}
        {hedgeyEnabled && (
          <>
            <Flex
              css={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <HedgeyIntro />
              </div>
              <Button
                color="destructive"
                outlined
                onClick={e => {
                  e.preventDefault();
                  setShowDisableModal(true);
                  // setHedgeyEnabled(false);
                }}
              >
                Disable integration
              </Button>
            </Flex>
            <Flex css={{ gap: '1em', marginBottom: '1em' }}>
              <Select
                label="Default lock period"
                infoTooltip="How long tokens are locked within the recipient's NFT"
                id="hedgey-default-lock-period"
                options={hedgeyLockPeriods}
                defaultValue="12"
                value={hedgeyLockPeriod}
                onValueChange={value => setHedgeyLockPeriod(value)}
              />
              <Select
                label="Transferable"
                infoTooltip="Allow the recipient to transfer their NFT (and their access to the locked tokens) to a different wallet address"
                id="hedgey-transferable"
                defaultValue="1"
                options={[
                  { label: 'Yes', value: '1' },
                  { label: 'No', value: '0' },
                ]}
                onValueChange={value => setHedgeyTransferrable(value)}
              />
            </Flex>
            <Button color="primary" outlined onClick={onSaveHedgeyIntegration}>
              Save Hedgey settings
            </Button>
          </>
        )}
      </Flex>
      <Modal
        open={showDisableModal}
        title="Disable Hedgey?"
        onClose={() => setShowDisableModal(false)}
      >
        Are you sure you want to disable the Hedgey integration?
        <Button
          css={{ marginTop: '1em' }}
          color="destructive"
          onClick={onDisableHedgey}
        >
          Disable Hedgey integration
        </Button>
      </Modal>
    </>
  );
}
