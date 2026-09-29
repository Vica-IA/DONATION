"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui";
import { USER_ROLES } from "@/lib/catalogs";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import type { PublicUser } from "@/lib/users";
import { createUserAction, resetPasswordAction, updateUserAction, type UserFormState } from "./actions";

const EMPTY: UserFormState = { errors: {}, values: {} };

function str(values: Record<string, unknown>, key: string, fallback = ""): string {
  const v = values[key];
  return typeof v === "string" ? v : fallback;
}

function Credentials({ credentials }: { credentials: { email: string; password: string } }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900" role="status">
      <p className="font-semibold">Credenciales temporales (se muestran una sola vez)</p>
      <p className="mt-2">
        Correo: <code className="rounded bg-white px-1.5 py-0.5">{credentials.email}</code>
      </p>
      <p className="mt-1">
        Contraseña temporal: <code className="rounded bg-white px-1.5 py-0.5 text-base font-bold">{credentials.password}</code>
      </p>
      <p className="mt-2 text-xs text-brand-800">Compártelas por un canal seguro. La persona deberá cambiar la contraseña al entrar.</p>
    </div>
  );
}

function RoleSelect({ defaultValue, error }: { defaultValue: string; error?: string }) {
  return (
    <Field label="Rol" htmlFor="role" error={error} required>
      <select id="role" name="role" className={`input${error ? " input-error" : ""}`} defaultValue={defaultValue}>
        {USER_ROLES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ul className="mt-2 space-y-1 text-xs text-slate-500">
        {USER_ROLES.map((o) => (
          <li key={o.value}>
            <span className="font-medium text-slate-700">{o.label}:</span> {ROLE_DESCRIPTIONS[o.value]}
          </li>
        ))}
      </ul>
    </Field>
  );
}

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(createUserAction, EMPTY);
  const { errors, values } = state;
  return (
    <form action={formAction} className="card space-y-4" noValidate>
      {state.credentials ? <Credentials credentials={state.credentials} /> : null}
      {state.credentials ? <h2 className="section-title">Crear otro usuario</h2> : null}
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      <Field label="Nombre" htmlFor="name" error={errors.name} required>
        <input id="name" name="name" className={`input${errors.name ? " input-error" : ""}`} defaultValue={str(values, "name")} />
      </Field>
      <Field label="Correo" htmlFor="email" error={errors.email} required help="Será su usuario para entrar al panel.">
        <input id="email" name="email" type="email" className={`input${errors.email ? " input-error" : ""}`} defaultValue={str(values, "email")} />
      </Field>
      <RoleSelect defaultValue={str(values, "role", "coordinador")} error={errors.role} />
      <Field label="Contraseña temporal" htmlFor="password" error={errors.password} help="Déjala vacía para generar una automáticamente. La persona deberá cambiarla al entrar.">
        <input id="password" name="password" type="text" autoComplete="off" className={`input${errors.password ? " input-error" : ""}`} />
      </Field>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}

export function EditUserForm({ user, isSelf }: { user: PublicUser; isSelf: boolean }) {
  const action = updateUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, EMPTY);
  const { errors, values } = state;
  const activeDefault = values.active !== undefined ? values.active === true : user.active;
  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">Datos y rol</h2>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.saved ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Cambios guardados.</div> : null}
      <Field label="Nombre" htmlFor="name" error={errors.name} required>
        <input id="name" name="name" className={`input${errors.name ? " input-error" : ""}`} defaultValue={str(values, "name", user.name)} />
      </Field>
      <Field label="Correo" htmlFor="email-ro">
        <input id="email-ro" className="input bg-slate-50" value={user.email} readOnly />
      </Field>
      <RoleSelect defaultValue={str(values, "role", user.role)} error={errors.role} />
      <label className="choice">
        <input type="checkbox" name="active" defaultChecked={activeDefault} className="mt-0.5" disabled={isSelf} />
        <span>
          Cuenta activa
          {isSelf ? <span className="block text-xs text-slate-500">No puedes desactivar tu propia cuenta.</span> : null}
        </span>
      </label>
      {isSelf ? <input type="hidden" name="active" value="on" /> : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ user }: { user: PublicUser }) {
  const action = resetPasswordAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, EMPTY);
  const { errors } = state;
  return (
    <form action={formAction} className="card space-y-4" noValidate>
      <h2 className="section-title">Restablecer contraseña</h2>
      <p className="text-sm text-slate-500">
        Asigna una contraseña temporal. Sus sesiones abiertas se cerrarán y deberá cambiarla al entrar.
      </p>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {state.credentials ? <Credentials credentials={state.credentials} /> : null}
      <Field label="Contraseña temporal" htmlFor="reset-password" error={errors.password} help="Vacío = generar automáticamente.">
        <input id="reset-password" name="password" type="text" autoComplete="off" className={`input${errors.password ? " input-error" : ""}`} />
      </Field>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Restableciendo…" : "Restablecer contraseña"}
      </button>
    </form>
  );
}
