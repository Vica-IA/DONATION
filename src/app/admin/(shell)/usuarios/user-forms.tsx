"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui";
import { AREAS, USER_ROLES } from "@/lib/catalogs";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import type { PublicUser } from "@/lib/users";
import { createUserAction, resetPasswordAction, updateUserAction, type UserFormState } from "./actions";

const EMPTY: UserFormState = { errors: {}, values: {} };
type Org = { id: string; name: string };

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

/** Rol + alcance: el grupo aparece para líderes y el área para coordinadores. */
function RoleScope({
  initialRole,
  initialOrganizationId,
  initialArea,
  organizations,
  errors,
  disabled = false,
}: {
  initialRole: string;
  initialOrganizationId: string;
  initialArea: string;
  organizations: Org[];
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  return (
    <>
      <Field label="Rol" htmlFor="role" error={errors.role} required>
        <select id="role" name="role" className={`input${errors.role ? " input-error" : ""}`} defaultValue={initialRole} onChange={(e) => setRole(e.target.value)} disabled={disabled}>
          {USER_ROLES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {disabled ? <input type="hidden" name="role" value={initialRole} /> : null}
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {USER_ROLES.map((o) => (
            <li key={o.value} className={role === o.value ? "text-ink" : ""}>
              <span className="font-semibold">{o.label}:</span> {ROLE_DESCRIPTIONS[o.value]}
            </li>
          ))}
        </ul>
      </Field>
      {role === "lider_grupo" ? (
        <Field label="Grupo que lidera" htmlFor="organizationId" error={errors.organizationId} required>
          <select id="organizationId" name="organizationId" className={`input${errors.organizationId ? " input-error" : ""}`} defaultValue={initialOrganizationId}>
            <option value="">Selecciona un grupo</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {role === "coordinador" ? (
        <Field label="Área que coordina" htmlFor="area" error={errors.area} required>
          <select id="area" name="area" className={`input${errors.area ? " input-error" : ""}`} defaultValue={initialArea}>
            <option value="">Selecciona un área</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </>
  );
}

export function CreateUserForm({ organizations }: { organizations: Org[] }) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo" htmlFor="email" error={errors.email} required help="Será su usuario para entrar al panel.">
          <input id="email" name="email" type="email" className={`input${errors.email ? " input-error" : ""}`} defaultValue={str(values, "email")} />
        </Field>
        <Field label="Celular / WhatsApp" htmlFor="phone" error={errors.phone} help="Se muestra al equipo en su área.">
          <input id="phone" name="phone" type="tel" className={`input${errors.phone ? " input-error" : ""}`} defaultValue={str(values, "phone")} />
        </Field>
      </div>
      <RoleScope initialRole={str(values, "role", "coordinador")} initialOrganizationId={str(values, "organizationId")} initialArea={str(values, "area")} organizations={organizations} errors={errors} />
      <Field label="Contraseña temporal" htmlFor="password" error={errors.password} help="Déjala vacía para generar una automáticamente. La persona deberá cambiarla al entrar.">
        <input id="password" name="password" type="text" autoComplete="off" className={`input${errors.password ? " input-error" : ""}`} />
      </Field>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}

export function EditUserForm({ user, isSelf, organizations }: { user: PublicUser; isSelf: boolean; organizations: Org[] }) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo" htmlFor="email-ro">
          <input id="email-ro" className="input bg-paper-2" value={user.email} readOnly />
        </Field>
        <Field label="Celular / WhatsApp" htmlFor="phone" error={errors.phone}>
          <input id="phone" name="phone" type="tel" className={`input${errors.phone ? " input-error" : ""}`} defaultValue={str(values, "phone", user.phone ?? "")} />
        </Field>
      </div>
      <RoleScope
        initialRole={str(values, "role", user.role)}
        initialOrganizationId={str(values, "organizationId", user.organizationId ?? "")}
        initialArea={str(values, "area", user.area ?? "")}
        organizations={organizations}
        errors={errors}
        disabled={isSelf}
      />
      <label className="choice">
        <input type="checkbox" name="active" defaultChecked={activeDefault} className="mt-0.5" disabled={isSelf} />
        <span>
          Cuenta activa
          {isSelf ? <span className="block text-xs text-muted">No puedes desactivar ni cambiar el rol de tu propia cuenta.</span> : null}
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
      <p className="text-sm text-muted">Asigna una contraseña temporal. Sus sesiones abiertas se cerrarán y deberá cambiarla al entrar.</p>
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
