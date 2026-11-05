"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { button } from "@/shared/ui/button";

/** Encerra a sessão atual (RF-005) e volta para /entrar. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    const res = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => null);
    if (res?.ok) {
      router.replace("/entrar");
      router.refresh();
      return;
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={`${button("ghost", "md")} ${className}`}
    >
      {pending ? (
        <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <LogOut aria-hidden size={18} strokeWidth={1.5} />
      )}
      Sair
    </button>
  );
}
