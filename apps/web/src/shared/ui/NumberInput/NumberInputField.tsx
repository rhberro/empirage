import { NumberInput } from '@chakra-ui/react';

type NumberInputFieldProperties = Omit<NumberInput.RootProps, 'onValueChange'> & {
  onChange: (value: string) => void;
};

export function NumberInputField(props: NumberInputFieldProperties): React.ReactElement {
  const { onChange, ...numberInputProperties } = props;
  function handleValueChange(details: NumberInput.ValueChangeDetails): void {
    onChange(details.value);
  }
  return <NumberInput.Root {...numberInputProperties} onValueChange={handleValueChange} />;
}
