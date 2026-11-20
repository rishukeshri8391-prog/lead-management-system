"use client";

import { useEffect, useMemo, useState } from "react";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/types/lead";

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  notes: string;
  status: LeadStatus;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  notes: "",
  status: "new",
};

const statusStyles: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-purple-50 text-purple-700 border-purple-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-gray-100 text-gray-600 border-gray-200",
};

const verifyStyles: Record<string, string> = {
  unverified: "bg-gray-100 text-gray-600",
  valid: "bg-green-100 text-green-700",
  invalid: "bg-red-100 text-red-700",
  risky: "bg-amber-100 text-amber-700",
  unknown: "bg-slate-100 text-slate-600",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data as T;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Lead[]>("/api/leads")
      .then((data) => {
        if (!cancelled) {
          setLeads(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(errMsg(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const count = (s: string) =>
      leads.filter((l) => l.verification_status === s).length;
    return {
      total: leads.length,
      valid: count("valid"),
      invalid: count("invalid"),
      risky: count("risky"),
      unverified: count("unverified"),
    };
  }, [leads]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, filter]);

  function replaceLead(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setForm({
      name: lead.name,
      email: lead.email,
      company: lead.company ?? "",
      phone: lead.phone ?? "",
      notes: lead.notes ?? "",
      status: lead.status,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const payload: Record<string, string> = {
          name: form.name,
          company: form.company,
          phone: form.phone,
          notes: form.notes,
          status: form.status,
        };
        // Only send email if it changed, so an unchanged email keeps its verification result
        if (form.email.trim().toLowerCase() !== editing.email) {
          payload.email = form.email;
        }
        const updated = await api<Lead>(`/api/leads/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        replaceLead(updated);
      } else {
        const created = await api<Lead>("/api/leads", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setLeads((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(lead: Lead, status: LeadStatus) {
    setError(null);
    try {
      const updated = await api<Lead>(`/api/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      replaceLead(updated);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function verify(lead: Lead) {
    setVerifyingId(lead.id);
    setError(null);
    try {
      const updated = await api<Lead>(`/api/leads/${lead.id}/verify`, {
        method: "POST",
      });
      replaceLead(updated);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setVerifyingId(null);
    }
  }

  async function remove(lead: Lead) {
    if (!window.confirm(`Delete ${lead.name}?`)) return;
    setError(null);
    try {
      await api(`/api/leads/${lead.id}`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lead Management</h1>
            <p className="text-sm text-gray-600">
              Track leads and verify their email addresses
            </p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add lead
          </button>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Total leads", stats.total, "text-gray-900"],
            ["Valid emails", stats.valid, "text-green-600"],
            ["Invalid emails", stats.invalid, "text-red-600"],
            ["Risky emails", stats.risky, "text-amber-600"],
            ["Unverified", stats.unverified, "text-gray-500"],
          ].map(([label, value, color]) => (
            <div
              key={label as string}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {label}
              </p>
              <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or company"
            className={inputCls}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | LeadStatus)}
            className={`${inputCls} sm:w-48`}
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 flex items-start justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-medium">
              Dismiss
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Email verification</th>
                <th className="hidden px-4 py-3 lg:table-cell">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Loading leads...
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    {leads.length === 0
                      ? "No leads yet. Click “Add lead” to create one."
                      : "No leads match your search."}
                  </td>
                </tr>
              )}
              {visible.map((lead) => (
                <tr key={lead.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-gray-600">{lead.email}</div>
                    {(lead.company || lead.phone) && (
                      <div className="text-xs text-gray-500">
                        {[lead.company, lead.phone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        changeStatus(lead, e.target.value as LeadStatus)
                      }
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${statusStyles[lead.status]}`}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${verifyStyles[lead.verification_status]}`}
                    >
                      {lead.verification_status}
                    </span>
                    {lead.verification_reason && (
                      <div className="mt-1 max-w-xs text-xs text-gray-500">
                        {lead.verification_reason}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => verify(lead)}
                        disabled={verifyingId === lead.id}
                        className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {verifyingId === lead.id ? "Verifying..." : "Verify"}
                      </button>
                      <button
                        onClick={() => openEdit(lead)}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(lead)}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-full w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-white p-6 text-gray-900 shadow-xl"
          >
            <h2 className="text-lg font-semibold">
              {editing ? "Edit lead" : "Add lead"}
            </h2>
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
            <input
              required
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
            <input
              required
              type="email"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
            />
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as LeadStatus })
              }
              className={inputCls}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Add lead"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}