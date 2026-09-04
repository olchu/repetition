"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Role = "child" | "admin";

const roleCopy: Record<Role, { title: string; description: string }> = {
  child: {
    title: "Pick up where you left off.",
    description: "Your assigned tests, your pace, your progress.",
  },
  admin: {
    title: "Keep learning moving.",
    description: "Manage children, publish tests, and follow every milestone.",
  },
};

export default function Home() {
  const [role, setRole] = useState<Role>("child");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, role }),
      });
      const payload = (await response.json().catch(() => null)) as {
        user?: { role?: string };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Unable to sign in right now.");
      }

      setFeedback({
        tone: "success",
        text: `Signed in as ${payload?.user?.role ?? role}. Your 30-day session is active.`,
      });
      window.location.assign(role === "admin" ? "/admin" : "/dashboard");
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to sign in right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="Repetition introduction">
        <div className={styles.storyTop}>
          <Link className={styles.brand} href="/" aria-label="Repetition home">
            <span className={styles.brandMark} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>repetition</span>
          </Link>
          <span className={styles.privateLabel}>Private learning room</span>
        </div>

        <div className={styles.orbit} aria-hidden="true">
          <div className={styles.orbitRing} />
          <div className={styles.orbitRing} />
          <div className={styles.orbitDot} />
          <span className={styles.orbitNumber}>04</span>
        </div>

        <div className={styles.storyContent}>
          <p className={styles.eyebrow}>A little further, every day</p>
          <h1>
            Small steps.
            <br />
            Real progress.
          </h1>
          <p className={styles.storyDescription}>
            A calm space for curious minds to practice, learn, and see how far
            they&apos;ve come.
          </p>
        </div>

        <div className={styles.storyFooter}>
          <span>Built for steady learning</span>
          <span className={styles.footerLine} />
          <span>01 / 04 subjects</span>
        </div>
      </section>

      <section className={styles.auth} aria-labelledby="welcome-title">
        <div className={styles.authHeader}>
          <span className={styles.authKicker}>Welcome back</span>
          <span className={styles.secureNote}>
            <span className={styles.secureDot} aria-hidden="true" />
            Secure sign in
          </span>
        </div>

        <div className={styles.formWrap}>
          <div className={styles.formIntro}>
            <h2 id="welcome-title">{roleCopy[role].title}</h2>
            <p>{roleCopy[role].description}</p>
          </div>

          <div className={styles.roleSwitch} aria-label="Choose account type">
            <button
              className={role === "child" ? styles.roleActive : ""}
              type="button"
              aria-pressed={role === "child"}
              onClick={() => {
                setRole("child");
                setFeedback(null);
              }}
            >
              I&apos;m a child
            </button>
            <button
              className={role === "admin" ? styles.roleActive : ""}
              type="button"
              aria-pressed={role === "admin"}
              onClick={() => {
                setRole("admin");
                setFeedback(null);
              }}
            >
              I&apos;m an admin
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label htmlFor="login">Username</label>
            <input
              id="login"
              name="login"
              type="text"
              autoComplete="username"
              placeholder={role === "child" ? "e.g. alex" : "e.g. olchu"}
              value={login}
              onChange={(event) => {
                setLogin(event.target.value);
                setFeedback(null);
              }}
              required
            />

            <div className={styles.passwordLabel}>
              <label htmlFor="password">Password</label>
              <span>Keep it safe</span>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFeedback(null);
              }}
              required
            />

            <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Continue"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          {feedback && (
            <p
              className={`${styles.feedback} ${feedback.tone === "error" ? styles.feedbackError : ""}`}
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              {feedback.text}
            </p>
          )}

          <p className={styles.formNote}>
            No public sign-ups. Your administrator creates your account.
          </p>
        </div>
      </section>
    </main>
  );
}
