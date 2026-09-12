import { SubjectsProvider } from "@/components/SubjectsProvider";
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <SubjectsProvider>{children}</SubjectsProvider>;
}
