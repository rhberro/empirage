import { huntElementBackgroundColor } from '../../lib/hunt-element-colors';

type AbilityIconProps = { element: string; name: string };
type MoveIconStyle = React.CSSProperties;

const MOVE_NAME_ALIASES: Record<string, string> = {
  'bubble-beam': 'bubblebeam',
  'high-jump-kick': 'hi-jump-kick',
  'poison-powder': 'poisonpowder',
  'sonic-boom': 'sonicboom',
  'thunder-shock': 'thundershock',
};

export function AbilityIcon(props: AbilityIconProps): React.ReactElement | null {
  const { element, name } = props;
  const moveName = normalizeMoveName(name);
  const style = createMoveIconStyle(element, moveName);
  return <span aria-hidden="true" className="ability-icon" style={style} />;
}

function normalizeMoveName(name: string): string {
  const normalizedName = name.toLocaleLowerCase().replaceAll(' ', '-');
  return MOVE_NAME_ALIASES[normalizedName] ?? normalizedName;
}

function createMoveIconStyle(element: string, moveName: string): MoveIconStyle {
  const backgroundColor = huntElementBackgroundColor(element);
  const iconPath = '/assets/moves/icons/' + moveName + '.png';
  return {
    backgroundColor,
    backgroundImage:
      'linear-gradient(135deg, rgb(255 255 255 / 28%), transparent 52%), url(' + iconPath + ')',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 100%, contain',
  };
}
