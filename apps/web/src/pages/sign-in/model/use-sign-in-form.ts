import * as React from "react";
import type { Control } from "react-hook-form";

import { useZodForm } from "~/shared/lib/use-zod-form";

import { SignInSchema, SignInValues } from "./sign-in-schema";

export type SignInForm = {
  control: Control<SignInValues>;
  handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void;
  isBusy: boolean;
  isSubmitting: boolean;
};

const defaultValues = { email: "", password: "" };

function onSubmit(_values: SignInValues): void {
  // console.log(values);
}

export function useSignInForm(): SignInForm {
  const form = useZodForm(SignInSchema, defaultValues);
  return {
    control: form.control,
    handleSubmit: form.handleSubmit(onSubmit),
    isBusy: form.formState.isSubmitting,
    isSubmitting: form.formState.isSubmitting,
  };
}
