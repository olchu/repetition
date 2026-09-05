"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type SignOutButtonProps = { className?: string; children?: ReactNode };

export function SignOutButton({ className, children }: SignOutButtonProps) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <button className={className} type="button" onClick={() => void signOut()}>
      {children ?? "Sign out"}
    </button>
  );
}
