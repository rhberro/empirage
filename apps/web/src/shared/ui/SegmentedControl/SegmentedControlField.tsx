import type { SegmentGroup } from '@chakra-ui/react';

import { SegmentedControl } from './SegmentedControl';
import type { SegmentedControlProperties } from './SegmentedControl';

export type SegmentedControlFieldProperties = Omit<SegmentedControlProperties, 'onValueChange'> & {
  onChange: (value: string) => void;
};

export function SegmentedControlField(props: SegmentedControlFieldProperties): React.ReactElement {
  const { onChange, ...segmentedControlProperties } = props;
  function handleValueChange(details: SegmentGroup.ValueChangeDetails): void {
    const { value } = details;
    if (value) {
      onChange(value);
    }
  }
  return <SegmentedControl {...segmentedControlProperties} onValueChange={handleValueChange} />;
}
