"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BookOpen, ClipboardList, Heart, House, LogOut, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStudentOverview } from "@/lib/use-student-overview";
import logo from "../../public/images/logo.png";
import { SignOutButton } from "./SignOutButton";
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
  { section: "tests", label: "Tests", Icon: ClipboardList, href: "/dashboard/tests" },
];

type DashboardSidebarProps = {
  /** Shown in the user card; its first letter becomes the avatar. */
  userName: string;
  /** Line under the name in the user card. */
  userRole?: string;
  /** Which nav entry is highlighted. */
  active?: DashboardSection;
};

function UserCard({ userName, userRole, stars, mobile = false }: { userName: string; userRole: string; stars: number | null; mobile?: boolean }) {
  return (
    <div className={`${styles.userFooter} ${mobile ? styles.mobileUserFooter : ""}`}>
      <div className={`${styles.userCard} ${mobile ? styles.mobileUserCard : ""}`}>
        <div className={styles.userIdentity}>
          <span className={styles.avatar} aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span>
          <span className={styles.userText}>
            <strong>{userName}</strong>
            <span className={styles.userRole}>{userRole}</span>
            {stars !== null && <span className={styles.userBalance} aria-label={`${stars} stars earned`}>⭐ {stars} stars</span>}
          </span>
        </div>
      </div>
      <SignOutButton className={styles.signOut}>
        <LogOut size={16} strokeWidth={2} aria-hidden="true" />
        Sign out
      </SignOutButton>
    </div>
  );
}

export function DashboardSidebar({ userName, userRole = "Student", active = "home" }: DashboardSidebarProps) {
  const { data } = useStudentOverview();
  const stars = data?.stars ?? null;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mobileMenuId = useId();
  const shouldReduceMotion = useReducedMotion();
  const animationDuration = shouldReduceMotion ? 0 : 0.24;

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

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

      <UserCard userName={userName} userRole={userRole} stars={stars} />

      <button
        className={styles.menuButton}
        type="button"
        aria-label="Open navigation menu"
        aria-controls={mobileMenuId}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen(true)}
      >
        <Menu aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className={styles.mobileMenu}
            initial="closed"
            animate="open"
            exit="closed"
            key="mobile-navigation"
          >
            <motion.button
              className={styles.menuBackdrop}
              type="button"
              aria-label="Close navigation menu"
              variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
              transition={{ duration: animationDuration, ease: "easeOut" }}
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              className={styles.menuPanel}
              id={mobileMenuId}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              variants={{ closed: { x: "100%" }, open: { x: 0 } }}
              transition={{ duration: animationDuration, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={styles.menuHeader}>
                <span className={styles.menuTitle}>Menu</span>
                <button
                  className={styles.menuClose}
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>

              <nav className={styles.mobileNav} aria-label="Mobile navigation">
                {navEntries.map(({ section, label, Icon, href }) => {
                  const isActive = section === active;

                  return (
                    <Link
                      className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ""}`}
                      href={href}
                      key={section}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Icon size={21} strokeWidth={2} aria-hidden="true" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
              <UserCard userName={userName} userRole={userRole} stars={stars} mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
