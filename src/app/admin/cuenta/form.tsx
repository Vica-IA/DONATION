"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { changePasswordAction, type ChangePasswordState } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, { errors: {} });
  const { errors } = state;
  const cls = (key: string) => `input${errors[key] ? " input-error" : ""}`;
  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">Cambiar contraseña</h2>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      <Field label="Contraseña actual" htmlFor="currentPassword" error={errors.currentPassword} required>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className={cls("currentPassword")} />
      </Field>
      <Field label="Nueva contraseña" htmlFor="newPassword" error={errors.newPassword} required help={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" className={cls("newPassword")} />
      </Field>
      <Field label="Confirma la nueva contraseña" htmlFor="confirmPassword" error={errors.confirmPassword} required>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className={cls("confirmPassword")} />
      </Field>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
