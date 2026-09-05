import type { ReactNode } from "react";
import { TestWorkspace } from "@/components/TestWorkspace";

export default function TestLayout({ children }: { children: ReactNode }) {
  return <TestWorkspace>{children}</TestWorkspace>;
}
