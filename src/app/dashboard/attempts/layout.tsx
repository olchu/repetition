import type { ReactNode } from "react";
import { TestWorkspace } from "@/components/TestWorkspace";

export default function AttemptsLayout({ children }: { children: ReactNode }) {
  return <TestWorkspace>{children}</TestWorkspace>;
}
