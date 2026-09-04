"use client";

import Image from "next/image";
import { ArrowRight, Eye, EyeOff, GraduationCap, Lock, School, Settings, User } from "lucide-react";
import { FormEvent, useState } from "react";
import styles from "./page.module.css";

type Role = "child" | "admin";

const roleCopy: Record<Role, { title: string; description: string }> = {
  child: {
    title: "Pick up where you left off",
    description: "Your lessons, your pace, your progress.",
  },
  admin: {
    title: "Shape the learning journey",
    description: "Manage children, tests, and their progress.",
  },
};

export default function Home() {
  const [role, setRole] = useState<Role>("child");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
        body: JSON.stringify({ login, password, role, rememberMe }),
      });
      const payload = (await response.json().catch(() => null)) as {
        user?: { role?: string };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Unable to sign in right now.");
      }

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
      <section className={styles.artPanel} aria-label="Learning with Repetition">
        <Image
          alt=""
          className={styles.heroImage}
          fill
          priority
          sizes="(max-width: 720px) 0px, (max-width: 1120px) 100vw, 55vw"
          src="/images/auth-hero.webp"
        />
        <Image
          alt=""
          className={styles.heroImageMobile}
          width={1882}
          height={3344}
          priority
          sizes="(max-width: 720px) 100vw, 0px"
          src="/images/auth-hero-mobile.webp"
        />
        <div className={styles.imageShade} aria-hidden="true" />
      </section>

      <section className={styles.auth} aria-labelledby="welcome-title">

        <div className={styles.formWrap}>
          <div className={styles.formIntro}>
            <h1 id="welcome-title">{roleCopy[role].title}</h1>
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
              <GraduationCap className={styles.roleIcon} aria-hidden="true" size={20} strokeWidth={2.1} />
              I&apos;m a student
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
              <Settings className={styles.roleIcon} aria-hidden="true" size={20} strokeWidth={2.1} />
              Admin sign in
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label htmlFor="login">Username</label>
            <div className={styles.field}>
              <User className={styles.fieldIcon} aria-hidden="true" size={20} strokeWidth={1.8} />
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                placeholder={role === "child" ? "for example, alex2008" : "for example, admin"}
                value={login}
                onChange={(event) => {
                  setLogin(event.target.value);
                  setFeedback(null);
                }}
                required
              />
            </div>

            <label className={styles.passwordLabel} htmlFor="password">Password</label>
            <div className={styles.field}>
              <Lock className={styles.fieldIcon} aria-hidden="true" size={20} strokeWidth={1.8} />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFeedback(null);
                }}
                required
              />
              <button
                className={styles.passwordToggle}
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <EyeOff size={20} strokeWidth={1.8} />
                ) : (
                  <Eye size={20} strokeWidth={1.8} />
                )}
              </button>
            </div>

            <div className={styles.formOptions}>
              <label className={styles.remember}>
                <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
                Remember me
              </label>
              <span className={styles.helpText}>Password help? Ask your administrator.</span>
            </div>

            <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Continue"}
              <ArrowRight className={styles.submitIcon} aria-hidden="true" size={20} strokeWidth={2.25} />
            </button>
          </form>

          {feedback && (
            <p className={`${styles.feedback} ${feedback.tone === "error" ? styles.feedbackError : ""}`} role={feedback.tone === "error" ? "alert" : "status"}>
              {feedback.text}
            </p>
          )}

          <div className={styles.mobileSwitch}>
            <div className={styles.mobileDivider} role="presentation">
              <span>OR</span>
            </div>
            <button
              type="button"
              className={styles.mobileSwitchButton}
              onClick={() => {
                setRole((current) => (current === "admin" ? "child" : "admin"));
                setFeedback(null);
              }}
            >
              {role === "admin" ? (
                <GraduationCap size={20} strokeWidth={2.1} />
              ) : (
                <School size={20} strokeWidth={2.1} />
              )}
              {role === "admin" ? "I'm a student" : "Admin sign in"}
              <ArrowRight size={18} strokeWidth={2.25} />
            </button>
          </div>

          <p className={styles.tagline}>
            Learn <span aria-hidden="true">•</span> Grow <span aria-hidden="true">•</span> Create your future
          </p>
        </div>

      </section>
    </main>
  );
}
