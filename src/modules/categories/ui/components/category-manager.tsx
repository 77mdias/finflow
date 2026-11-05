"use client";

import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError } from "@/shared/ui/field";

import type { CategoryDTO } from "../../application/categories";
import { createCategory, deleteCategory, updateCategory } from "../actions";

// shortcut: cor e ícone ainda não aparecem na interface; novas categorias usam o neutro.
const NEW_CATEGORY_STYLE = { color: "gray", icon: "tag" };

function NewCategoryForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createCategory({ name, ...NEW_CATEGORY_STYLE });
    setBusy(false);
    if (res.ok) return setName("");
    setError(res.error.fieldErrors?.name?.[0] ?? res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
      <div className="flex-1">
        <label htmlFor="categoria-nova" className="sr-only">
          Nome da nova categoria
        </label>
        <input
          {...describedBy("categoria-nova", error)}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          maxLength={40}
          autoComplete="off"
          placeholder="Nova categoria"
          className={FIELD.replace("mt-1.5 ", "")}
        />
        {error && (
          <p id="categoria-nova-erro" className="mt-1.5 text-body-sm text-status-danger-fg">
            {error}
          </p>
        )}
      </div>
      <button type="submit" disabled={busy || !name.trim()} className={`${button("tonal", "md")} h-11`}>
        {busy ? (
          <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Plus aria-hidden size={18} strokeWidth={1.5} />
        )}
        Adicionar
      </button>
    </form>
  );
}

function RenameForm({ category, onDone }: { category: CategoryDTO; onDone: () => void }) {
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateCategory({ id: category.id, name });
    setBusy(false);
    if (res.ok) return onDone();
    setError(res.error.fieldErrors?.name?.[0] ?? res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field id="categoria-nome" label="Nome" error={error}>
        <input
          {...describedBy("categoria-nome", error)}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          maxLength={40}
          autoComplete="off"
          className={FIELD}
        />
      </Field>
      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          Cancelar
        </button>
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Salvar
        </button>
      </DialogActions>
    </form>
  );
}

function DeleteForm({
  category,
  other,
  onDone,
}: {
  category: CategoryDTO;
  other: string;
  onDone: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p className="text-body text-fg-muted">
        Assinaturas, despesas e cobranças de {category.name} passam para {other}.
      </p>
      {message && (
        <div className="mt-4">
          <FormError>{message}</FormError>
        </div>
      )}
      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          Voltar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await deleteCategory({ id: category.id });
            setBusy(false);
            if (res.ok) return onDone();
            setMessage(res.error.message);
          }}
          className={button("danger", "md")}
        >
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Excluir categoria
        </button>
      </DialogActions>
    </>
  );
}

/** Categorias (RF-070/RF-071): criar, renomear e excluir; "Outros" é fixa e recebe as órfãs. */
export function CategoryManager({ categories }: { categories: CategoryDTO[] }) {
  const [dialog, setDialog] = useState<{ kind: "rename" | "delete"; category: CategoryDTO } | null>(null);
  const close = () => setDialog(null);
  const other = categories.find((c) => c.isSystem)?.name ?? "Outros";

  return (
    <div className="flex flex-col gap-4">
      <NewCategoryForm />
      <ul className="divide-y divide-border">
        {categories.map((c) => (
          <li key={c.id} className="flex min-h-12 items-center gap-2 py-1">
            <span className="min-w-0 flex-1 truncate text-body">{c.name}</span>
            {c.isSystem ? (
              <span className="text-body-sm text-fg-muted">Fixa</span>
            ) : (
              <>
                <button
                  type="button"
                  aria-label={`Renomear ${c.name}`}
                  onClick={() => setDialog({ kind: "rename", category: c })}
                  className={button("ghost", "sm")}
                >
                  <Pencil aria-hidden size={16} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${c.name}`}
                  onClick={() => setDialog({ kind: "delete", category: c })}
                  className={button("ghost", "sm")}
                >
                  <Trash2 aria-hidden size={16} strokeWidth={1.5} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={dialog?.kind === "rename"} onClose={close} title="Renomear categoria">
        {dialog?.kind === "rename" && <RenameForm category={dialog.category} onDone={close} />}
      </Dialog>
      <Dialog
        open={dialog?.kind === "delete"}
        onClose={close}
        title={`Excluir ${dialog?.category.name ?? "categoria"}?`}
      >
        {dialog?.kind === "delete" && <DeleteForm category={dialog.category} other={other} onDone={close} />}
      </Dialog>
    </div>
  );
}
