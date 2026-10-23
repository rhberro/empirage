import { Box } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

import { SCREEN_ANCHORS } from '~/pages/design-system/ui/rail';
import { BackpackModalPreview } from '~/pages/design-system/ui/screens/BackpackModal';
import { CreateTrainerScreen } from '~/pages/design-system/ui/screens/CreateTrainerScreen';
import { CreatureDetail } from '~/pages/design-system/ui/screens/CreatureDetail';
import { EmptyBackpack } from '~/pages/design-system/ui/screens/EmptyBackpack';
import { EmptyTrainers } from '~/pages/design-system/ui/screens/EmptyTrainers';
import { ForgotPasswordScreen } from '~/pages/design-system/ui/screens/ForgotPasswordScreen';
import { HuntAnalyzer } from '~/pages/design-system/ui/screens/HuntAnalyzer';
import { HuntAreaDetails } from '~/pages/design-system/ui/screens/huntArea/HuntAreaDetails';
import { HuntAreaSelect } from '~/pages/design-system/ui/screens/huntArea/HuntAreaSelect';
import { ItemDetailPopup } from '~/pages/design-system/ui/screens/ItemDetailPopup';
import { LoadingScreen } from '~/pages/design-system/ui/screens/LoadingScreen';
import { PrivacyScreen } from '~/pages/design-system/ui/screens/PrivacyScreen';
import { ReconnectScreen } from '~/pages/design-system/ui/screens/ReconnectScreen';
import { ResetPasswordScreen } from '~/pages/design-system/ui/screens/ResetPasswordScreen';
import { SignInScreen } from '~/pages/design-system/ui/screens/SignInScreen';
import { SignUpScreen } from '~/pages/design-system/ui/screens/SignUpScreen';
import { ConsumableSelectionPanel } from '~/pages/design-system/ui/screens/skillPanel/ConsumableSelectionPanel';
import { DeviceSelectionPanel } from '~/pages/design-system/ui/screens/skillPanel/DeviceSelectionPanel';
import { SkillSelectionPanel } from '~/pages/design-system/ui/screens/skillPanel/SkillSelectionPanel';
import { StorageModalPreview } from '~/pages/design-system/ui/screens/StorageModal';
import { TermsScreen } from '~/pages/design-system/ui/screens/TermsScreen';
import { TrainersList } from '~/pages/design-system/ui/screens/TrainersList';
import { ScreenEntry } from '~/pages/design-system/ui/sections/ScreenEntry';
import { Text } from '~/shared/ui/text';

import { SectionHeader } from './SectionHeader';

export function ScreensSection(): ReactElement {
  return (
    <Box marginBlockEnd="16">
      <SectionHeader
        description="Cada superfície do jogo, montada com os mesmos componentes. É aqui que a consistência aparece: os modais compartilham título, corpo, rodapé e a mesma anatomia de slot."
        id="telas"
        title="Telas"
      />
      <AuthGroup />
      <TrainerGroup />
      <CityGroup />
      <HuntGroup />
      <SkillPanelsGroup />
      <StateGroup />
    </Box>
  );
}

type ScreenGroupProps = {
  children: ReactNode;
  title: string;
};

function ScreenGroup(props: ScreenGroupProps): ReactElement {
  const { children, title } = props;
  return (
    <Box marginBlockEnd="10">
      <GroupTitle title={title} />
      <Box display="flex" flexDirection="column" gap="8">
        {children}
      </Box>
    </Box>
  );
}

type GroupProps = {
  title: string;
};

function GroupTitle(props: GroupProps): ReactElement {
  const { title } = props;
  return (
    <Text color="fg" marginBlockEnd="3" variant="section">
      {title}
    </Text>
  );
}

function AuthGroup(): ReactElement {
  return (
    <ScreenGroup title="Autenticação">
      <ScreenEntry
        description="O formulário de entrada, com e-mail, usuário e senha, e o rodapé com o aceite dos termos."
        id={SCREEN_ANCHORS.entrar}
        title="Entrar"
      >
        <SignInScreen />
      </ScreenEntry>
      <ScreenEntry
        description="O mesmo formulário de entrada, com o campo de confirmar senha e a ação de voltar."
        id={SCREEN_ANCHORS.criarConta}
        title="Criar conta"
      >
        <SignUpScreen />
      </ScreenEntry>
      <ScreenEntry
        description="O pedido de recuperação, com o e-mail e a ação de enviar o link."
        id={SCREEN_ANCHORS.recuperarSenha}
        title="Recuperar senha"
      >
        <ForgotPasswordScreen />
      </ScreenEntry>
      <ScreenEntry
        description="A redefinição de senha, com usuário, nova senha e confirmação."
        id={SCREEN_ANCHORS.novaSenha}
        title="Nova senha"
      >
        <ResetPasswordScreen />
      </ScreenEntry>
      <ScreenEntry
        description="O documento de termos dentro da mesma estrutura de formulário."
        id={SCREEN_ANCHORS.termos}
        title="Termos de serviço"
      >
        <TermsScreen />
      </ScreenEntry>
      <ScreenEntry
        description="A política de privacidade no mesmo documento."
        id={SCREEN_ANCHORS.privacidade}
        title="Privacidade"
      >
        <PrivacyScreen />
      </ScreenEntry>
    </ScreenGroup>
  );
}

function TrainerGroup(): ReactElement {
  return (
    <ScreenGroup title="Treinadores">
      <ScreenEntry
        description="A lista de treinadores, com seleção, ações e a confirmação de exclusão."
        id={SCREEN_ANCHORS.treinadores}
        title="Lista de treinadores"
      >
        <TrainersList />
      </ScreenEntry>
      <ScreenEntry
        description="A criação de treinador, com avatar, gênero, nome e criatura inicial."
        id={SCREEN_ANCHORS.criarTreinador}
        title="Criar treinador"
      >
        <CreateTrainerScreen />
      </ScreenEntry>
    </ScreenGroup>
  );
}

function CityGroup(): ReactElement {
  return (
    <ScreenGroup title="Cidade">
      <ScreenEntry
        description="A mochila aberta, com a grade de slots e a busca."
        frameMinHeight="40rem"
        id={SCREEN_ANCHORS.mochila}
        title="Mochila"
      >
        <BackpackModalPreview />
      </ScreenEntry>
      <ScreenEntry
        description="O armazenamento, com os mesmos slots e a ação de guardar."
        frameMinHeight="43.75rem"
        id={SCREEN_ANCHORS.armazenamento}
        title="Armazenamento"
      >
        <StorageModalPreview />
      </ScreenEntry>
    </ScreenGroup>
  );
}

function HuntGroup(): ReactElement {
  return (
    <ScreenGroup title="Caçada">
      <ScreenEntry
        description="A seleção de locais, em grade, com paginação e busca."
        frameMinHeight="48.75rem"
        id={SCREEN_ANCHORS.locaisDeCaca}
        title="Locais de caça"
      >
        <HuntAreaSelect />
      </ScreenEntry>
      <ScreenEntry
        description="A lateral com os detalhes do local e a ação de iniciar a caçada."
        frameMinHeight="48.75rem"
        id={SCREEN_ANCHORS.detalhesDoLocal}
        title="Detalhes do local"
      >
        <HuntAreaDetails />
      </ScreenEntry>
      <ScreenEntry
        description="O resumo da caçada em andamento e as métricas da sessão."
        id={SCREEN_ANCHORS.analiseDaCacada}
        title="Análise da caçada"
      >
        <HuntAnalyzer />
      </ScreenEntry>
    </ScreenGroup>
  );
}

function SkillPanelsGroup(): ReactElement {
  return (
    <ScreenGroup title="Seleção na barra de habilidades">
      <ScreenEntry
        description="A seleção de habilidade para um slot da barra."
        id={SCREEN_ANCHORS.painelHabilidades}
        title="Painel de habilidades"
      >
        <SkillSelectionPanel />
      </ScreenEntry>
      <ScreenEntry
        description="A seleção de consumível, com o gatilho de uso."
        id={SCREEN_ANCHORS.painelConsumiveis}
        title="Painel de consumíveis"
      >
        <ConsumableSelectionPanel />
      </ScreenEntry>
      <ScreenEntry
        description="A seleção de dispositivo para um slot da barra."
        id={SCREEN_ANCHORS.painelDispositivos}
        title="Painel de dispositivos"
      >
        <DeviceSelectionPanel />
      </ScreenEntry>
    </ScreenGroup>
  );
}

function StateGroup(): ReactElement {
  return (
    <ScreenGroup title="Estados do sistema">
      <ScreenEntry
        description="O estado de reconexão, com o aviso e a tentativa atual."
        id={SCREEN_ANCHORS.reconectar}
        title="Conexão perdida"
      >
        <ReconnectScreen />
      </ScreenEntry>
      <ScreenEntry
        description="A tela de carregamento com o indicador de progresso."
        id={SCREEN_ANCHORS.carregando}
        title="Carregando"
      >
        <LoadingScreen />
      </ScreenEntry>
      <ScreenEntry
        description="A mochila sem itens, com a ação de buscar de novo."
        id={SCREEN_ANCHORS.mochilaVazia}
        title="Mochila vazia"
      >
        <EmptyBackpack />
      </ScreenEntry>
      <ScreenEntry
        description="A lista sem treinadores, com o atalho de criar."
        id={SCREEN_ANCHORS.treinadoresVazios}
        title="Treinadores vazios"
      >
        <EmptyTrainers />
      </ScreenEntry>
      <ScreenEntry
        description="O cartão da criatura, com atributos e habilidades."
        id={SCREEN_ANCHORS.detalheDaCriatura}
        title="Detalhe da criatura"
      >
        <CreatureDetail />
      </ScreenEntry>
      <ScreenEntry
        description="O detalhe do item, com a descrição e o fechar."
        id={SCREEN_ANCHORS.detalheDoItem}
        title="Detalhe do item"
      >
        <ItemDetailPopup />
      </ScreenEntry>
    </ScreenGroup>
  );
}
