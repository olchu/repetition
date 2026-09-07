import Image from "next/image";
import Link from "next/link";
import { BookOpen, Heart, House } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logo from "../../public/images/logo.png";
import styles from "./DashboardSidebar.module.css";

export type DashboardSection = "home" | "subjects" | "tests" | "progress";

type NavEntry = {
  section: DashboardSection;
  label: string;
  Icon: LucideIcon;
  /** A section appears here only once its page exists — an entry is added
   *  together with the page it opens, so the menu never holds a dead link. */
  href: string;
};

const navEntries: NavEntry[] = [
  { section: "home", label: "Home", Icon: House, href: "/dashboard" },
  { section: "subjects", label: "Subjects", Icon: BookOpen, href: "/dashboard/subjects" },
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
        <span className={styles.brandMark}>
          {/* Decorative: the "OL CHU" wordmark next to it carries the name. */}
          <Image src={logo} alt="" width={36} height={36} priority />
        </span>
        <span className={styles.brandText}>
          <strong>OL CHU</strong>
          <span>More than learning</span>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        {navEntries.map(({ section, label, Icon, href }) => {
          const isActive = section === active;

          return (
            <Link
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              href={href}
              key={section}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={2} aria-hidden="true" />
              {label}
            </Link>
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
