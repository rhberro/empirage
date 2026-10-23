/**
 * The props of the trigger, when another component delivers them.
 *
 * O Ark entrega as props do gatilho no componente que ele envolve: quando o
 * popup vive dentro de um menu, o menu entrega as props dele no popup, e o
 * popup precisa repassar para o mesmo elemento da tela.
 */
export type TriggerProps = Record<string, unknown>;

/**
 * The events that the trigger can carry.
 *
 * A lista e fechada de proposito: um evento que nao esta aqui nao e
 * repassado, e o comportamento do gatilho continua sendo o do componente que
 * o construiu.
 */
const HANDLER_NAMES = [
  'onBlur',
  'onClick',
  'onContextMenu',
  'onFocus',
  'onKeyDown',
  'onKeyUp',
  'onMouseDown',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseUp',
  'onPointerCancel',
  'onPointerDown',
  'onPointerEnter',
  'onPointerLeave',
  'onPointerMove',
  'onPointerUp',
] as const;

type TriggerHandler = (...args: unknown[]) => void;

/**
 * The props of the child, with the props of the trigger.
 *
 * Os dois lados podem ter o mesmo evento, e os dois precisam acontecer: o
 * evento do filho — o clique que marca a criatura escolhida — e o evento do
 * gatilho — o clique que abre o menu. O evento do filho vem primeiro, como o
 * Ark faz.
 */
export function mergeTriggerProps(
  childProps: Record<string, unknown>,
  triggerProps: TriggerProps,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...childProps, ...triggerProps };
  for (const name of HANDLER_NAMES) {
    const childHandler = childProps[name];
    const triggerHandler = triggerProps[name];
    if (typeof childHandler !== 'function' || typeof triggerHandler !== 'function') {
      continue;
    }
    merged[name] = function handleEvent(...args: unknown[]): void {
      (childHandler as TriggerHandler)(...args);
      (triggerHandler as TriggerHandler)(...args);
    };
  }
  return merged;
}
