import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { IconButton, NativeButton } from '~/shared/ui/button';
import { IconGear, IconLogout, IconTeam } from '~/shared/ui/icon';
import { Modal, ModalBody, ModalHeader } from '~/shared/ui/modal';
import { Popup } from '~/shared/ui/popup';
import { Text } from '~/shared/ui/text';

const TITLE = 'Configurações';
const MENU_WIDTH = '26rem';
const SWITCH_LABEL = 'Trocar treinador';
const SIGN_OUT_LABEL = 'Sair da conta';
const MENU_ITEM_HOVER = { color: 'currency.gold' };
const TOOLTIP = (
  <Text color="fg" variant="meta">
    {TITLE}
  </Text>
);

type SettingsMenuProps = {
  onSignOut: () => void;
  onSwitchTrainer: () => void;
};

/**
 * The settings menu of the game.
 *
 * The trigger is the last button of the toolbar, and the menu holds the two
 * actions of the session: switching the trainer and signing out. Switching the
 * trainer only disconnects the trainer from the service, and the session of
 * the account stays alive.
 *
 * The menu is a layer in the middle of the screen, and not a menu at the
 * corner of the button: a menu de jogo é um pausing, e ele centraliza.
 */
export function SettingsMenu(props: SettingsMenuProps): ReactElement {
  const { onSignOut, onSwitchTrainer } = props;
  const [isOpen, setIsOpen] = useState<boolean>(false);

  function handleOpen(): void {
    setIsOpen(true);
  }

  function handleClose(): void {
    setIsOpen(false);
  }

  function handleSwitchTrainer(): void {
    handleClose();
    onSwitchTrainer();
  }

  function handleSignOut(): void {
    handleClose();
    onSignOut();
  }

  return (
    <>
      <Popup content={TOOLTIP}>
        <IconButton label={TITLE} onClick={handleOpen} radius="full" tone="neutral">
          <IconGear size="1.25rem" />
        </IconButton>
      </Popup>
      <Modal isOpen={isOpen} onClose={handleClose} width={MENU_WIDTH}>
        <ModalHeader>{TITLE}</ModalHeader>
        <ModalBody>
          <SettingsMenuContent onSignOut={handleSignOut} onSwitchTrainer={handleSwitchTrainer} />
        </ModalBody>
      </Modal>
    </>
  );
}

type SettingsMenuContentProps = {
  onSignOut: () => void;
  onSwitchTrainer: () => void;
};

/**
 * The items of the menu.
 *
 * O item e um botao de verdade, com o rotulo grande e gravado: o menu de um
 * jogo nao e uma lista de opcoes, e um conjunto de acoes.
 */
function SettingsMenuContent(props: SettingsMenuContentProps): ReactElement {
  const { onSignOut, onSwitchTrainer } = props;
  return (
    <Box display="flex" flexDirection="column" gap="2" paddingBlock="2">
      <SettingsMenuItem
        icon={<IconTeam size="1.25rem" />}
        label={SWITCH_LABEL}
        onClick={onSwitchTrainer}
      />
      <SettingsMenuItem
        icon={<IconLogout size="1.25rem" />}
        label={SIGN_OUT_LABEL}
        onClick={onSignOut}
        tone="danger"
      />
    </Box>
  );
}

type SettingsMenuItemProps = {
  icon: ReactElement;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'ghost';
};

/**
 * O item do menu.
 *
 * O icone vem antes do rotulo, e a cor nunca vem sozinha: o item perigoso
 * tem o icone e o rotulo na cor do perigo.
 */
function SettingsMenuItem(props: SettingsMenuItemProps): ReactElement {
  const { icon, label, onClick, tone = 'ghost' } = props;
  const isDanger = tone === 'danger';
  const iconColor = isDanger ? 'blood.emphasized' : 'currency.gold';
  const textColor = isDanger ? 'blood.emphasized' : 'fg';
  return (
    <NativeButton
      _hover={MENU_ITEM_HOVER}
      color={textColor}
      cursor="pointer"
      width="full"
      onClick={onClick}
    >
      <Box alignItems="center" display="flex" gap="3" justifyContent="center" paddingBlock="2">
        <Box color={iconColor} display="flex">
          {icon}
        </Box>
        <Text variant="title">{label}</Text>
      </Box>
    </NativeButton>
  );
}
