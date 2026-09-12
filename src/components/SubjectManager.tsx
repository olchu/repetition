"use client";

import { useState, type FormEvent } from "react";
import { useSubjects } from "./SubjectsProvider";
import { SubjectIcon } from "./SubjectCard";
import type { SubjectRecord } from "@/lib/subjects";
import styles from "@/app/admin/page.module.css";

const blank = { slug: "", name: "", icon: "", color: "#2f6fed", backgroundColor: "#eaf2fe", textColor: "#163d82", sortOrder: 0, archived: false };

export function SubjectManager() {
  const { subjects, icons, refresh } = useSubjects();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function edit(subject: SubjectRecord) {
    setEditingId(subject.id);
    setForm({ ...subject, icon: subject.icon ?? "" });
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/v1/admin/subjects/${editingId}` : "/api/v1/admin/subjects", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, icon: form.icon.trim() || null }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Unable to save subject.");
      }
      await refresh();
      setEditingId(null);
      setForm(blank);
      setMessage("Subject saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save subject.");
    } finally { setSaving(false); }
  }

  return <section className={styles.controlSection} aria-labelledby="subjects-heading">
    <div className={styles.controlHeader}><div><p className={styles.eyebrow}>Learning catalog</p><h1 id="subjects-heading">Subjects</h1></div><span>{subjects.length} subjects</span></div>
    <form className={styles.createForm} onSubmit={save}>
      <h2>{editingId ? "Edit subject" : "Create subject"}</h2>
      <fieldset disabled={saving} style={{ border: 0 }}>
        <div className={styles.formGrid}>
          <label>Name<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Permanent slug<input required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={Boolean(editingId)} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="e.g. mathematics" /></label>
          <label>Icon<select value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })}><option value="">Default book icon</option>{icons.map((icon) => <option key={icon} value={icon}>{icon.split("/").pop()}</option>)}</select></label>
          <label>Display order<input type="number" min={0} max={100000} required value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
          <label>Accent color<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label>
          <label>Background color<input type="color" value={form.backgroundColor} onChange={(event) => setForm({ ...form, backgroundColor: event.target.value })} /></label>
          <label>Text color<input type="color" value={form.textColor} onChange={(event) => setForm({ ...form, textColor: event.target.value })} /></label>
          <label><span><input type="checkbox" checked={form.archived} onChange={(event) => setForm({ ...form, archived: event.target.checked })} /> Archived</span>Existing assignments and results are preserved.</label>
        </div>
        <div className={styles.filterActions}><button type="submit" className={styles.action}>{saving ? "Saving…" : "Save subject"}</button>{editingId && <button type="button" className={styles.textButton} onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}</div>
      </fieldset>
    </form>
    {message && <p className={styles.notice} role="status">{message}</p>}
    <div className={styles.controlList}>
      <div className={styles.controlListHeader}><span>Subject</span><span>Order</span><span>Status</span><span>Action</span></div>
      {subjects.map((subject) => <div className={styles.controlRow} key={subject.id} data-subject={subject.slug}>
        <div><span style={{ color: subject.textColor, background: subject.backgroundColor, padding: 8, borderRadius: 8, width: 52 }}><SubjectIcon subject={subject.slug} size={32} /></span><strong>{subject.name}</strong><span>{subject.slug}</span></div>
        <span>{subject.sortOrder}</span><span className={styles.pill}>{subject.archived ? "Archived" : "Active"}</span><span className={styles.rowActions}><button className={styles.textButton} type="button" onClick={() => edit(subject)}>Edit</button></span>
      </div>)}
    </div>
  </section>;
}
