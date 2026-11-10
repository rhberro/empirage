import { SegmentGroup } from '@chakra-ui/react';

type SegmentGroupItems = React.ComponentProps<typeof SegmentGroup.Items>['items'];

export type SegmentedControlProperties = Omit<SegmentGroup.RootProps, 'children'> & {
  items: SegmentGroupItems;
};

export function SegmentedControl(props: SegmentedControlProperties): React.ReactElement {
  const { items, ...rootProperties } = props;
  const segmentItems = [...items];
  return (
    <SegmentGroup.Root {...rootProperties}>
      <SegmentGroup.Indicator />
      <SegmentGroup.Items items={segmentItems} />
    </SegmentGroup.Root>
  );
}
