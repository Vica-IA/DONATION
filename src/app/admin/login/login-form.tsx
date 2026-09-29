"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">
          Correo
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="username" defaultValue={state.email ?? ""} autoFocus required />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
        {state.error ? (
          <p className="error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
