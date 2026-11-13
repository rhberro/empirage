import moveAtlas from '../../../../../public/assets/moves/atlas/moves.json';
import { huntElementBackgroundColor } from '../../lib/hunt-element-colors';

type AbilityIconProps = { element: string; name: string };
type MoveFrame = { x: number; y: number };
type MoveIconStyle = React.CSSProperties;

const ATLAS_PATH = '/assets/moves/atlas/moves.png';
const ICON_SIZE = 56;
const FRAME_SIZE = 32;
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
  const move = moveAtlas.frames[moveName];
  const frame = move ? move.frame : undefined;
  if (!frame) {
    return null;
  }
  const style = createMoveIconStyle(element, frame);
  return <span aria-hidden="true" className="ability-icon" style={style} />;
}

function normalizeMoveName(name: string): string {
  const normalizedName = name.toLocaleLowerCase().replaceAll(' ', '-');
  return MOVE_NAME_ALIASES[normalizedName] ?? normalizedName;
}

function createMoveIconStyle(element: string, frame: MoveFrame): MoveIconStyle {
  const scale = ICON_SIZE / FRAME_SIZE;
  const backgroundColor = huntElementBackgroundColor(element);
  const atlasWidth = moveAtlas.meta.size.w * scale;
  const atlasHeight = moveAtlas.meta.size.h * scale;
  const positionX = -frame.x * scale;
  const positionY = -frame.y * scale;
  return {
    backgroundColor,
    backgroundImage:
      'linear-gradient(135deg, rgb(255 255 255 / 28%), transparent 52%), url(' + ATLAS_PATH + ')',
    backgroundPosition: 'center, ' + positionX + 'px ' + positionY + 'px',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 100%, ' + atlasWidth + 'px ' + atlasHeight + 'px',
  };
}
