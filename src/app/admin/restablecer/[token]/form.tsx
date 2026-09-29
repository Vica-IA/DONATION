"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { resetWithTokenAction, type ResetState } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const action = resetWithTokenAction.bind(null, token);
  const [state, formAction, pending] = useActionState<ResetState, FormData>(action, { errors: {} });
  const { errors } = state;
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._form ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {errors._form}
        </div>
      ) : null}
      <Field label="Nueva contraseña" htmlFor="newPassword" error={errors.newPassword} required help={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" className={cls("newPassword")} autoFocus />
      </Field>
      <Field label="Confirma la nueva contraseña" htmlFor="confirmPassword" error={errors.confirmPassword} required>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className={cls("confirmPassword")} />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña y entrar"}
      </button>
    </form>
  );
}
