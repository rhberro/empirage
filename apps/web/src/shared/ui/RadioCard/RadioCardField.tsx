import { RadioCard } from '@chakra-ui/react';

type RadioCardFieldProperties = Omit<RadioCard.RootProps, 'onValueChange'> & {
  onChange: (value: string) => void;
};

export function RadioCardField(props: RadioCardFieldProperties): React.ReactElement {
  const { onChange, ...radioCardProperties } = props;
  function handleValueChange(details: RadioCard.ValueChangeDetails): void {
    onChange(details.value);
  }
  return <RadioCard.Root {...radioCardProperties} onValueChange={handleValueChange} />;
}
