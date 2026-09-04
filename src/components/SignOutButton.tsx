"use client";

import { useRouter } from "next/navigation";

type SignOutButtonProps = { className?: string };

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
  }

  return <button className={className} type="button" onClick={() => void signOut()}>Sign out</button>;
}
