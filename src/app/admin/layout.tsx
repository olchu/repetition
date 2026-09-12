import { SubjectsProvider } from "@/components/SubjectsProvider";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SubjectsProvider>{children}</SubjectsProvider>;
}
