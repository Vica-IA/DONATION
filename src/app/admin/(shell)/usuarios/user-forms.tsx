"use client";

import { useActionState, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Field } from "@/components/ui";
import { AREAS, USER_ROLES } from "@/lib/catalogs";
import { formatDateTime } from "@/lib/format";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import type { PublicUser } from "@/lib/users";
import { createResetLinkAction, createUserAction, resetPasswordAction, updateUserAction, type UserFormState } from "./actions";

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

/** Enlace de un solo uso (invitación o nueva contraseña) con copia y envío por WhatsApp. */
function LinkBox({ title, url, expiresAt, message, phone, inputId = "reset-link" }: { title: string; url: string; expiresAt: string; message: string; phone?: string | null; inputId?: string }) {
  const wa = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900" role="status">
      <p className="font-semibold">{title}</p>
      <input id={inputId} readOnly value={url} className="input mt-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
      <p className="mt-1 text-xs text-brand-800">Vence el {formatDateTime(expiresAt)}. Un solo uso; si generas otro, este deja de servir.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={url} />
        {wa ? (
          <a className="btn-accent" href={wa} target="_blank" rel="noopener noreferrer">
            Enviar por WhatsApp
          </a>
        ) : null}
      </div>
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
      {state.link ? (
        <LinkBox
          title={`Cuenta creada para ${state.link.name ?? "la persona"}. Envíale este enlace de invitación (se muestra una sola vez).`}
          url={state.link.url}
          expiresAt={state.link.expiresAt}
          phone={state.link.phone}
          message={`Hola ${state.link.name ?? ""}, te crearon una cuenta en el panel del equipo de DONATION. Con este enlace creas tu contraseña (vale 7 días y una sola vez): ${state.link.url}`}
        />
      ) : null}
      {state.link ? <h2 className="section-title">Crear otro usuario</h2> : null}
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
      <p className="text-xs text-muted">Al crear la cuenta se genera un enlace de invitación (7 días, un solo uso) con el que la persona crea su propia contraseña y entra.</p>
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

export function ResetLinkForm({ user }: { user: PublicUser }) {
  const action = createResetLinkAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, EMPTY);
  const { errors, link } = state;
  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="section-title">Enlace para crear nueva contraseña</h2>
      <p className="text-sm text-muted">
        Genera un enlace de un solo uso, válido 48 horas. La persona lo abre, escribe su nueva contraseña y entra directo. Sus sesiones anteriores se cierran.
      </p>
      {errors._form ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors._form}</div> : null}
      {link ? (
        <LinkBox
          title="Enlace listo (se muestra una sola vez)"
          url={link.url}
          expiresAt={link.expiresAt}
          phone={user.phone}
          message={`Hola ${user.name}, con este enlace creas tu nueva contraseña del panel DONATION (vale 48 horas y una sola vez): ${link.url}`}
        />
      ) : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Generando…" : link ? "Generar otro enlace" : "Generar enlace"}
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
