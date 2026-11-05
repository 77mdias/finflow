"use client";

import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";
import { describedBy, Field, FIELD, FormError } from "@/shared/ui/field";
import { SavedNote } from "@/shared/ui/saved-note";

import { updateProfile } from "../actions";

/** "America/Sao_Paulo" → "America / Sao Paulo" */
const tzLabel = (tz: string) => tz.replaceAll("_", " ").replaceAll("/", " / ");

/** Perfil (FLOW_MAP §1, RF-004): nome e fuso; o fuso define "hoje" para faturas e lembretes (RN-01). */
export function ProfileForm({
  profile,
  timezones,
}: {
  profile: { name: string; email: string; timezone: string };
  timezones: string[];
}) {
  const [v, setV] = useState({ name: profile.name, timezone: profile.timezone });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSaved(false);
  };
  const err = (key: string) => errors[key]?.[0];
  const zones = timezones.includes(v.timezone) ? timezones : [v.timezone, ...timezones];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await updateProfile({ name: v.name, timezone: v.timezone });
    setBusy(false);
    if (res.ok) return setSaved(true);
    setErrors(res.error.fieldErrors ?? {});
    setMessage(res.error.code === "VALIDATION_ERROR" ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="perfil-nome" label="Nome" error={err("name")}>
        <input
          {...describedBy("perfil-nome", err("name"))}
          value={v.name}
          onChange={set("name")}
          required
          maxLength={80}
          autoComplete="name"
          className={FIELD}
        />
      </Field>
      <Field id="perfil-email" label="E-mail" hint="É por ele que você entra e recebe os lembretes.">
        <input
          {...describedBy("perfil-email", undefined, "É por ele que você entra e recebe os lembretes.")}
          value={profile.email}
          readOnly
          className={`${FIELD} text-fg-muted`}
        />
      </Field>
      <Field
        id="perfil-fuso"
        label="Fuso horário"
        error={err("timezone")}
        hint="Define o dia de hoje para faturas, cobranças e lembretes."
      >
        <select
          {...describedBy(
            "perfil-fuso",
            err("timezone"),
            "Define o dia de hoje para faturas, cobranças e lembretes.",
          )}
          value={v.timezone}
          onChange={set("timezone")}
          className={FIELD}
        >
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {tzLabel(tz)}
            </option>
          ))}
        </select>
      </Field>
      {message && <FormError>{message}</FormError>}
      <div className="flex items-center justify-end gap-3">
        <SavedNote show={saved} />
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Salvar perfil
        </button>
      </div>
    </form>
  );
}
