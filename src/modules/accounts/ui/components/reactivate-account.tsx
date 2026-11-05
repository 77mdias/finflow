"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { button } from "@/shared/ui/button";
import { DialogActions } from "@/shared/ui/dialog";
import { FormError } from "@/shared/ui/field";

import { SignOutButton } from "@/app/(app)/sign-out-button";

import { reactivateAccount } from "../actions";

export function ReactivateAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onReactivate() {
    setBusy(true);
    const res = await reactivateAccount({});
    if (res.ok) return router.replace("/dashboard");
    setBusy(false);
    setMessage(res.error.message);
  }

  return (
    <>
      {message && (
        <div className="mt-4">
          <FormError>{message}</FormError>
        </div>
      )}
      <DialogActions>
        <SignOutButton />
        <button type="button" onClick={onReactivate} disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Reativar conta
        </button>
      </DialogActions>
    </>
  );
}
