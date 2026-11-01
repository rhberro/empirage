import { Button, Input, Stack } from "@chakra-ui/react";
import * as React from "react";

import { FormField } from "~/shared/ui/FormField";

import { useSignInForm } from "../model/use-sign-in-form";

export function SignInForm(): React.ReactElement {
  const { control, handleSubmit, isSubmitting } = useSignInForm();

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="5">
        <FormField
          control={control}
          label="E-mail"
          name="email"
          placeholder="you@example.com"
          render={Input}
          required
          type="email"
        />
        <FormField
          control={control}
          label="Password"
          name="password"
          placeholder="Enter your password"
          render={Input}
          required
          type="password"
        />
        <Button loading={isSubmitting} type="submit" w="full">
          Enter the game
        </Button>
      </Stack>
    </form>
  );
}
