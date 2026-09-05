import Link from "next/link";
import { BarChart3, BookOpen, FileText, Heart, House } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./DashboardSidebar.module.css";

export type DashboardSection = "home" | "subjects" | "tests" | "progress";

type NavEntry = {
  section: DashboardSection;
  label: string;
  Icon: LucideIcon;
  /** Sections without a page yet render as plain text instead of a dead link. */
  href: string | null;
};

const navEntries: NavEntry[] = [
  { section: "home", label: "Home", Icon: House, href: "/dashboard" },
  { section: "subjects", label: "Subjects", Icon: BookOpen, href: null },
  { section: "tests", label: "Tests", Icon: FileText, href: null },
  { section: "progress", label: "Progress", Icon: BarChart3, href: null },
];

type DashboardSidebarProps = {
  /** Shown in the user card; its first letter becomes the avatar. */
  userName: string;
  /** Line under the name in the user card. */
  userRole?: string;
  /** Which nav entry is highlighted. */
  active?: DashboardSection;
};

export function DashboardSidebar({ userName, userRole = "Student", active = "home" }: DashboardSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <svg viewBox="0 0 32 32" role="presentation">
            <path d="M11 4c3.3 0 6 2.7 6 6v6.5c0 3-2.5 5.5-5.5 5.5S6 19.5 6 16.5V10c0-3.3 2.7-6 5-6Z" fill="#4f9bff" />
            <path d="M23 6c2.8 0 5 2.2 5 5v7c0 3.3-2.7 6-6 6s-6-2.7-6-6v-7c0-2.8 2.2-5 5-5Z" fill="#43dfc0" opacity="0.85" />
          </svg>
        </span>
        <span className={styles.brandText}>
          <strong>OL CHU</strong>
          <span>More than learning</span>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        {navEntries.map(({ section, label, Icon, href }) => {
          const isActive = section === active;
          const className = `${styles.navItem} ${isActive ? styles.navItemActive : ""}`;
          const icon = <Icon size={20} strokeWidth={2} aria-hidden="true" />;

          return href ? (
            <Link className={className} href={href} key={section} aria-current={isActive ? "page" : undefined}>
              {icon}
              {label}
            </Link>
          ) : (
            <span className={className} key={section} aria-disabled="true">
              {icon}
              {label}
            </span>
          );
        })}
      </nav>

      <p className={styles.art} aria-hidden="true">
        Small steps
        <br />
        big dreams
        <Heart size={18} strokeWidth={2} />
      </p>

      <div className={styles.userCard}>
        <span className={styles.avatar} aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span>
        <span className={styles.userText}>
          <strong>{userName}</strong>
          <span>{userRole}</span>
        </span>
      </div>
    </aside>
  );
}
