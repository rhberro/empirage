import { Button } from '@chakra-ui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { signOut } from '~/shared/auth';

export function SignOutButton(): React.ReactElement {
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();
  async function onSignOut(): Promise<void> {
    setLoading(true);
    await signOut();
    navigate('/signin');
    setLoading(false);
  }
  return (
    <Button disabled={loading} loading={loading} onClick={onSignOut} type="button">
      Sair
    </Button>
  );
}
