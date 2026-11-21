"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, Award, Bell, Building2, CalendarDays, ChevronRight, CircleHelp, Database, Gauge, Globe2, LayoutDashboard, LogOut, Menu, RefreshCw, Search, ShieldCheck, Shield, Trophy, Users, X, Zap } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";

type Section = "overview" | "matches" | "sync" | "superleague" | "tournaments" | "users" | "clubs" | "teams" | "notifications" | "awards" | "analytics" | "system" | "access";
const nav: Array<{ id: Section; label: string; icon: any; data?: string; group: string }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { id: "matches", label: "Matches", icon: CalendarDays, data: "matches", group: "Football" },
  { id: "sync", label: "Provider & sync", icon: RefreshCw, data: "sync", group: "Football" },
  { id: "superleague", label: "Super League", icon: Trophy, data: "superleague", group: "Competition" },
  { id: "tournaments", label: "Tournaments", icon: Globe2, data: "tournaments", group: "Competition" },
  { id: "users", label: "Users & access", icon: Users, data: "users", group: "Community" },
  { id: "clubs", label: "Clubs", icon: Building2, data: "clubs", group: "Community" },
  { id: "teams", label: "Team ratings", icon: ShieldCheck, data: "teams", group: "Competition" },
  { id: "notifications", label: "Notifications", icon: Bell, data: "notifications", group: "Community" },
  { id: "awards", label: "Awards", icon: Award, data: "awards", group: "Community" },
  { id: "analytics", label: "Analytics", icon: Activity, group: "System" },
  { id: "system", label: "System health", icon: Gauge, group: "System" },
  { id: "access", label: "Audit & access", icon: Shield, data: "audit", group: "System" },
];
const headings: Record<Section, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "LOWBLOCK / OPERATIONS", title: "Operations overview", description: "A live view of fixtures, players, scoring, and the jobs keeping LowBlock up to date." },
  matches: { eyebrow: "FOOTBALL / FIXTURES", title: "Match control", description: "Inspect imported fixtures and their current result state." },
  sync: { eyebrow: "FOOTBALL / PROVIDER", title: "Provider & sync", description: "Review recent synchronization runs and their completion status." },
  superleague: { eyebrow: "COMPETITION / H2H", title: "Super League operations", description: "Review week lifecycle, schedule records, and prediction-safe controls." },
  tournaments: { eyebrow: "COMPETITION / CATALOG", title: "Tournament catalog", description: "Supported competitions and the ways they feed LowBlock standings." },
  users: { eyebrow: "COMMUNITY / ACCOUNTS", title: "Users & access", description: "Review player accounts. Admin role changes require an explicit confirmation." },
  clubs: { eyebrow: "COMMUNITY / CLUBS", title: "Club directory", description: "Inspect club ownership, visibility, and configuration." },
  teams: { eyebrow: "COMPETITION / TEAM DATA", title: "Team ratings", description: "Adjust bounded Super League team ratings with an audited manual override." },
  notifications: { eyebrow: "COMMUNITY / DELIVERY", title: "Notification queue", description: "Review queued messages and delivery outcomes." },
  awards: { eyebrow: "COMMUNITY / REWARDS", title: "Awards & rewards", description: "Review awards, reveal state, and source records." },
  analytics: { eyebrow: "SYSTEM / INSIGHTS", title: "Product analytics", description: "Operational usage indicators from current production collections." },
  system: { eyebrow: "SYSTEM / HEALTH", title: "System health", description: "Database, scoring backlog, sync activity, and queued work." },
  access: { eyebrow: "SYSTEM / GOVERNANCE", title: "Audit & access", description: "Review admin actions and account access state." },
};

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

function pretty(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "—";
  const raw = String(value);
  const date = new Date(raw);
  if (/\d{4}-\d\d-\d\dT/.test(raw) && !Number.isNaN(date.getTime())) return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return raw.length > 110 ? `${raw.slice(0, 107)}…` : raw;
}
function labelize(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()); }
function first(...values: any[]) { return values.find((value) => value !== undefined && value !== null && value !== ""); }
function displayText(value: any, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((part) => displayText(part, "")).filter(Boolean).join(", ") || fallback;
  if (value && typeof value === "object") {
    const localized = first(value.en, value.fa, value.name, value.shortName, value.displayName);
    return localized === undefined ? fallback : displayText(localized, fallback);
  }
  return fallback;
}
function TeamBadge({ name, logo }: { name: any; logo?: string }) {
  const label = displayText(name, "Team");
  return <span className="lb-admin-identity-logo">{logo ? <img src={logo} alt="" /> : <b>{label.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</b>}</span>;
}
function StatusPill({ value }: { value: any }) {
  const raw = String(value ?? "UNKNOWN").toUpperCase();
  const label: Record<string, string> = { NS: "Upcoming", NOT_STARTED: "Upcoming", FT: "Finished", FINISHED: "Finished", LIVE: "Live", IN_PLAY: "Live", POSTPONED: "Postponed", CANCELLED: "Cancelled", FAILED: "Failed", SUCCESS: "Completed", COMPLETED: "Completed", PENDING: "Pending", PROCESSING: "Processing", DEAD: "Needs attention", PUBLIC: "Public", PRIVATE: "Private", OPEN: "Open", CLOSED: "Closed" };
  const tone = ["FAILED", "DEAD", "CANCELLED", "POSTPONED"].includes(raw) ? "warn" : ["FT", "FINISHED", "COMPLETED", "SUCCESS", "PUBLIC", "OPEN"].includes(raw) ? "good" : ["LIVE", "IN_PLAY"].includes(raw) ? "live" : "";
  return <span className={`lb-admin-friendly-status ${tone}`}>{label[raw] ?? labelize(raw)}</span>;
}

export function AdminConsole({ username }: { username: string }) {
  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [dataset, setDataset] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dataPage, setDataPage] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [showManualMatchForm, setShowManualMatchForm] = useState(false);
  const [showSlateAssignment, setShowSlateAssignment] = useState(false);
  const requestSequence = useRef(0);
  const current = headings[section];
  const navGroups = useMemo(() => [...new Set(nav.map((item) => item.group))], []);

  const load = useCallback(async (target: Section, search: string, page: number) => {
    const requestId = ++requestSequence.current;
    setBusy(true); setError("");
    const item = nav.find((entry) => entry.id === target);
    const summaryTask = jsonFetch("/api/admin/overview").then((summary) => {
      if (requestId === requestSequence.current) setOverview(summary);
    }).catch((cause) => {
      if (requestId === requestSequence.current && ["overview", "system", "analytics"].includes(target)) setError(cause instanceof Error ? cause.message : "Could not load the overview");
    });
    if (!item?.data) {
      await summaryTask;
      if (requestId === requestSequence.current) setBusy(false);
      return;
    }
    try {
      const rows = await jsonFetch(`/api/admin/data?section=${item.data}&q=${encodeURIComponent(search)}&page=${page}`);
      if (requestId === requestSequence.current) setDataset(rows ?? null);
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "Could not load this page");
    } finally {
      if (requestId === requestSequence.current) setBusy(false);
    }
    // Directory pages render as soon as their own records arrive; overview data
    // remains a separate request and cannot hold the Matches screen in loading.
    void summaryTask;
  }, []);

  // One request cycle per visible state. Previously section, query, page and
  // polling effects could overlap and let an older response clear a newer
  // loading state or replace its data.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(section, query, dataPage), query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [section, query, dataPage, load]);

  useEffect(() => {
    if (section !== "overview" && section !== "system") return;
    const timer = window.setInterval(() => void load(section, query, dataPage), 30_000);
    return () => window.clearInterval(timer);
  }, [section, query, dataPage, load]);

  const changeSection = (target: Section) => { setSection(target); setQuery(""); setDataPage(0); setDataset(null); setMobileMenu(false); if (target !== "matches") { setSelectedMatchIds([]); setShowManualMatchForm(false); setShowSlateAssignment(false); } };
  const runAction = async (action: "sync" | "rebuild-scores") => {
    const confirmation = action === "sync" ? "SYNC PROVIDER" : "REBUILD SCORES";
    const prompt = action === "sync"
      ? "Run a provider sync now? This calls the configured football provider and may use its request quota. Type SYNC PROVIDER to continue."
      : "Recalculate match scores and leaderboard totals now? Existing predictions are preserved, but score totals can change. Type REBUILD SCORES to continue.";
    if (window.prompt(prompt) !== confirmation) return;
    setBusy(true); setError("");
    try {
      const result = await jsonFetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmText: confirmation }) });
      setToast(action === "sync" ? "Sync completed. Review the run summary." : "Score rebuild completed.");
      setDataset({ section: action, total: 1, rows: [{ action, result: result.result, completedAt: new Date().toISOString() }] });
      await load("overview", query, 0);
      window.setTimeout(() => setToast(""), 5000);
    } catch (e) { setError(e instanceof Error ? e.message : "Operation failed"); }
    finally { setBusy(false); }
  };

  const changeUserAdmin = async (row: any) => {
    const enabled = !(row.isAdmin === true || row.role === "ADMIN" || row.role === "admin");
    const phrase = enabled ? "GRANT ADMIN" : "REVOKE ADMIN";
    if (window.prompt(`${enabled ? "Grant administrator access to" : "Revoke administrator access from"} ${row.username ?? "this account"}? Type ${phrase} to continue.`) !== phrase) return;
    setBusy(true); setError("");
    try {
      await jsonFetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-admin", userId: row._id, enabled, confirmText: phrase }) });
      setToast(enabled ? "Administrator access granted." : "Administrator access revoked.");
      await load("users", query, 0);
      window.setTimeout(() => setToast(""), 4000);
    } catch (e) { setError(e instanceof Error ? e.message : "Role update failed"); }
    finally { setBusy(false); }
  };

  const performAction = async (payload: any, phrase: string, label: string, reload = section) => {
    if (window.prompt(`${label}\nType ${phrase} to continue.`) !== phrase) return;
    setBusy(true); setError("");
    try {
      await jsonFetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, confirmText: phrase }) });
      setToast(`${label} completed.`);
      await load(reload, query, dataPage);
      window.setTimeout(() => setToast(""), 4500);
    } catch (e) { setError(e instanceof Error ? e.message : "Operation failed"); }
    finally { setBusy(false); }
  };

  const exportData = () => {
    if (!dataset?.rows?.length) return;
    const fields = Object.keys(dataset.rows[0]);
    const cell = (value: any) => `"${String(typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "").replaceAll('"', '""')}"`;
    const csv = [fields.map(cell).join(","), ...dataset.rows.map((row: any) => fields.map((field) => cell(row[field])).join(","))].join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `lowblock-${section}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const content = <>
    <header className="lb-admin-header">
      <div className="lb-admin-heading"><div className="lb-admin-eyebrow">{current.eyebrow}</div><h1>{current.title}</h1><p>{current.description}</p></div>
      <div className="lb-admin-header-actions"><span className="lb-admin-live"><i /> Live data</span><button aria-label="Refresh data" className="lb-admin-icon-btn" onClick={() => void load(section, query, dataPage)}><RefreshCw size={17} className={busy ? "lb-spin" : ""} /></button><button className="lb-admin-avatar" title={username}>{username.slice(0, 1).toUpperCase()}</button></div>
    </header>
    {error && <div className="lb-admin-error" role="alert">{error}<button onClick={() => void load(section, query, dataPage)}>Retry</button></div>}
    {toast && <div className="lb-admin-toast"><ShieldCheck size={17}/>{toast}</div>}
    {section === "overview" ? <Overview overview={overview} busy={busy} runAction={runAction} onNavigate={changeSection} /> : <DataSection section={section} dataset={dataset} overview={overview} busy={busy} query={query} setQuery={setQuery} page={dataPage} onPageChange={setDataPage} onNavigate={changeSection} onAction={runAction} onUserAdmin={changeUserAdmin} onAdminAction={performAction} onExport={exportData} selectedMatchIds={selectedMatchIds} setSelectedMatchIds={setSelectedMatchIds} showManualMatchForm={showManualMatchForm} setShowManualMatchForm={setShowManualMatchForm} showSlateAssignment={showSlateAssignment} setShowSlateAssignment={setShowSlateAssignment} reload={(search?: string, page?: number) => load(section, search ?? query, page ?? dataPage)} />}
    <footer className="lb-admin-footer"><span>Admin actions are recorded in the audit log.</span><span>Updated {overview?.generatedAt ? pretty(overview.generatedAt) : "—"}</span></footer>
  </>;

  return <div className="lb-admin-shell">
    <button className="lb-admin-mobile-trigger" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open admin menu">{mobileMenu ? <X size={20}/> : <Menu size={20}/>}<b>LowBlock Admin</b><span className="lb-admin-mobile-current">{current.title}</span></button>
    {mobileMenu && <button className="lb-admin-mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu"/>}
    <aside className={`lb-admin-sidebar ${mobileMenu ? "is-open" : ""}`}>
      <div className="lb-admin-brand"><div className="lb-admin-mark">L<span>.</span></div><div><b>LOWBLOCK</b><small>ADMIN CONSOLE</small></div><button className="lb-admin-close" onClick={() => setMobileMenu(false)}><X size={18}/></button></div>
      <div className="lb-admin-workspace"><div className="lb-admin-workspace-mark">LB</div><div><b>LowBlock</b><small>Production workspace</small></div><ChevronRight size={15}/></div>
      <nav className="lb-admin-nav" aria-label="Admin sections">{navGroups.map((group) => <div className="lb-admin-nav-group" key={group}><span className="lb-admin-nav-label">{group}</span>{nav.filter((item) => item.group === group).map((item) => { const Icon = item.icon; return <button key={item.id} className={`lb-admin-nav-item ${section === item.id ? "active" : ""}`} onClick={() => changeSection(item.id)}><Icon size={17}/><span>{item.label}</span>{item.id === "system" && overview?.counts?.unscoredPredictions > 0 && <i className="lb-admin-nav-dot"/>}</button>; })}</div>)}</nav>
      <div className="lb-admin-sidebar-bottom"><div className="lb-admin-secure"><ShieldCheck size={17}/><span><b>Admin access active</b><small>Verified for this session</small></span></div><a href="/" className="lb-admin-nav-item"><LogOut size={17}/><span>Back to LowBlock</span></a></div>
    </aside>
    <main className="lb-admin-main">{content}</main>
  </div>;
}

function Overview({ overview, busy, runAction, onNavigate }: any) {
  const c = overview?.counts;
  return <>
    <div className="lb-admin-welcome"><div><div className="lb-admin-welcome-kicker"><Zap size={14}/> OPERATIONS CENTER <span>•</span> {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div><h2>Good to have you back<span>.</span></h2><p>Here’s what’s happening across your football prediction platform.</p></div><div className="lb-admin-welcome-orb"><Activity size={29}/></div></div>
    <div className="lb-admin-stats">{[
      { label: "Registered players", value: c?.users, detail: "All accounts", icon: Users, color: "mint" },
      { label: "Fixtures tracked", value: c?.matches, detail: `${c?.upcoming ?? "—"} upcoming`, icon: CalendarDays, color: "blue" },
      { label: "Predictions stored", value: c?.predictions, detail: `${c?.unscoredPredictions ?? 0} awaiting scoring`, icon: Trophy, color: "amber" },
      { label: "Active clubs", value: c?.clubs, detail: "Community spaces", icon: Building2, color: "violet" },
    ].map((stat) => { const Icon = stat.icon; return <div className="lb-admin-stat" key={stat.label}><div className={`lb-admin-stat-icon ${stat.color}`}><Icon size={18}/></div><div className="lb-admin-stat-label">{stat.label}</div><strong>{stat.value?.toLocaleString?.() ?? (busy ? "···" : "—")}</strong><small>{stat.detail}</small></div>; })}</div>
    <div className="lb-admin-overview-grid">
      <section className="lb-admin-card lb-admin-sync-card"><div className="lb-admin-card-heading"><div><span className="lb-admin-card-eyebrow">DATA PIPELINE</span><h3>Provider syncs</h3></div><button className="lb-admin-text-btn" onClick={() => onNavigate("sync")}>History <ChevronRight size={15}/></button></div><div className="lb-admin-sync-state"><div className={`lb-admin-sync-icon ${overview?.syncRuns?.[0]?.status === "FAILED" ? "is-warn" : ""}`}><RefreshCw size={19}/></div><div><b>{overview?.syncRuns?.[0]?.status ?? "No sync runs yet"}</b><small>{overview?.syncRuns?.[0]?.startedAt ? `Last attempt · ${pretty(overview.syncRuns[0].startedAt)}` : "Trigger a provider sync when fixtures need a refresh."}</small></div><span className={`lb-admin-status ${overview?.syncRuns?.[0]?.status === "FAILED" ? "warn" : "ok"}`}>{overview?.syncRuns?.[0]?.status === "FAILED" ? "Needs attention" : "Provider"}</span></div><div className="lb-admin-pipeline"><div className="lb-admin-pipeline-line"><i/></div>{["Discover fixtures", "Persist changes", "Score finished games"].map((step, i) => <div className="lb-admin-pipeline-step" key={step}><span className={i < 2 ? "done" : ""}>{i < 2 ? "✓" : i + 1}</span><b>{step}</b></div>)}</div><div className="lb-admin-card-actions"><button className="lb-admin-button primary" disabled={busy} onClick={() => runAction("sync")}><RefreshCw size={15}/> Sync fixtures</button><button className="lb-admin-button" disabled={busy} onClick={() => runAction("rebuild-scores")}><Trophy size={15}/> Rebuild scores</button></div></section>
      <section className="lb-admin-card lb-admin-health-card"><div className="lb-admin-card-heading"><div><span className="lb-admin-card-eyebrow">SERVICE HEALTH</span><h3>System pulse</h3></div><button className="lb-admin-icon-btn" onClick={() => onNavigate("system")}><ChevronRight size={16}/></button></div><div className="lb-admin-health-row"><span className="lb-admin-health-dot"/><span>Application database</span><b>{overview?.health?.database ?? (busy ? "Checking" : "—")}</b></div><div className="lb-admin-health-row"><span className={`lb-admin-health-dot ${overview?.health?.h2hEnabled ? "" : "muted"}`}/><span>Super League engine</span><b>{overview?.health?.h2hEnabled ? "Enabled" : "Disabled"}</b></div><div className="lb-admin-health-row"><span className={`lb-admin-health-dot ${overview?.health?.pendingNotifications ? "amber" : ""}`}/><span>Queued notifications</span><b>{overview?.health?.pendingNotifications ?? 0}</b></div><div className="lb-admin-health-foot"><Database size={15}/> Production data connection <span>·</span> Monitored</div></section>
      <section className="lb-admin-card lb-admin-h2h-card"><div className="lb-admin-card-heading"><div><span className="lb-admin-card-eyebrow">HEAD-TO-HEAD</span><h3>Super League weeks</h3></div><button className="lb-admin-text-btn" onClick={() => onNavigate("superleague")}>Manage <ChevronRight size={15}/></button></div>{overview?.h2hWeeks?.length ? <div className="lb-admin-week-list">{overview.h2hWeeks.slice(0, 4).map((week: any) => <div className="lb-admin-week-row" key={week._id}><div className="lb-admin-week-icon"><Trophy size={16}/></div><div><b>{week.weekKey}</b><small>{pretty(week.startsAt)} — {pretty(week.endsAt)}</small></div><span className={`lb-admin-status ${String(week.status).toLowerCase() === "completed" ? "ok" : "neutral"}`}>{week.status}</span></div>)}</div> : <div className="lb-admin-empty-inline">{busy ? "Loading week records…" : "No Super League week records found."}</div>}</section>
      <section className="lb-admin-card lb-admin-attention-card"><div className="lb-admin-card-heading"><div><span className="lb-admin-card-eyebrow">NEEDS A LOOK</span><h3>Data follow-up</h3></div><CircleHelp size={18} className="lb-admin-muted-icon"/></div>{[
        { title: "Predictions needing scores", value: c?.unscoredPredictions ?? 0, onClick: () => onNavigate("matches") },
        { title: "Live matches", value: c?.live ?? 0, onClick: () => onNavigate("matches") },
        { title: "Failed recent syncs", value: overview?.syncRuns?.filter((r: any) => r.status === "FAILED").length ?? 0, onClick: () => onNavigate("sync") },
      ].map((item) => <button className="lb-admin-attention-row" key={item.title} onClick={item.onClick}><span>{item.title}</span><b className={item.value ? "attention" : ""}>{item.value}</b><ChevronRight size={15}/></button>)}</section>
    </div>
    <div className="lb-admin-shortcuts"><span>QUICK ACCESS</span>{[{ label: "Supported tournaments", section: "tournaments" as Section, icon: Globe2 }, { label: "User directory", section: "users" as Section, icon: Users }, { label: "Action audit", section: "access" as Section, icon: Shield }].map((x) => { const Icon = x.icon; return <button key={x.section} onClick={() => onNavigate(x.section)}><Icon size={16}/>{x.label}<ChevronRight size={14}/></button>; })}</div>
  </>;
}

function DataSection({ section, dataset, overview, busy, query, setQuery, page, onPageChange, onNavigate, onAction, onUserAdmin, onAdminAction, onExport, selectedMatchIds, setSelectedMatchIds, showManualMatchForm, setShowManualMatchForm, showSlateAssignment, setShowSlateAssignment, reload }: any) {
  const item = nav.find((entry) => entry.id === section);
  const rows = dataset?.rows ?? [];
  const act = (row: any) => {
    if (section === "matches") return onAdminAction({ action: "set-match-visibility", matchId: row.providerMatchId ?? row.matchId, hidden: row.adminHiddenFromListings !== true }, "UPDATE MATCH VISIBILITY", `${row.adminHiddenFromListings ? "Restore" : "Hide"} ${row.homeTeamName ?? row.homeTeam?.name ?? "Home"} vs ${row.awayTeamName ?? row.awayTeam?.name ?? "Away"} in the user matches list. Predictions remain intact.`);
    if (section === "clubs") {
      const name = window.prompt("Club name", row.name); if (name === null) return;
      const visibility = window.prompt("Visibility: PUBLIC or PRIVATE", row.visibility ?? "PUBLIC"); if (visibility === null || !["PUBLIC", "PRIVATE"].includes(visibility.toUpperCase())) return;
      const discoveryMode = window.prompt("Discovery: INVITE_ONLY or RECRUITING", row.discoveryMode ?? "INVITE_ONLY"); if (discoveryMode === null || !["INVITE_ONLY", "RECRUITING"].includes(discoveryMode.toUpperCase())) return;
      return onAdminAction({ action: "set-club-settings", clubId: row._id, name, visibility: visibility.toUpperCase(), discoveryMode: discoveryMode.toUpperCase() }, "UPDATE CLUB", `Update settings for ${row.name}.`);
    }
    if (section === "notifications") {
      if (["PROCESSING", "DONE", "CANCELLED"].includes(row.status)) return;
      const retry = row.status !== "PENDING";
      return onAdminAction({ action: retry ? "retry-notification" : "cancel-notification", jobId: row._id }, retry ? "RETRY JOB" : "CANCEL JOB", `${retry ? "Retry" : "Cancel"} notification ${row.jobKey ?? row._id}.`);
    }
    if (section === "awards") return onAdminAction({ action: "set-award-revealed", awardId: row._id, revealed: !row.revealedAt }, "UPDATE AWARD", `${row.revealedAt ? "Reset reveal state for" : "Reveal"} ${row.title ?? row.type ?? "this award"}.`);
    if (section === "teams") {
      const rating = window.prompt(`Set Super League rating for ${row.names?.en ?? row.centralTeamId} (1–100). Current: ${row.h2hRating ?? "unset"}`, String(row.h2hRating ?? 50));
      if (rating === null || !/^\d+$/.test(rating) || Number(rating) < 1 || Number(rating) > 100) return;
      return onAdminAction({ action: "set-team-rating", centralTeamId: row.centralTeamId, rating: Number(rating) }, "UPDATE TEAM RATING", `Set the Super League rating for ${row.names?.en ?? row.centralTeamId} to ${rating}.`);
    }
    if (section === "superleague") return onAdminAction({ action: "h2h-settle", weekKey: row.weekKey }, `SETTLE ${row.weekKey}`, `Recalculate and finalize Super League week ${row.weekKey}. This updates member points.`);
    if (section === "users") return onAdminAction({ action: "revoke-sessions", userId: row._id }, "REVOKE SESSIONS", `Sign out all sessions for ${row.username ?? "this player"}.`);
  };
  const actionLabel = (row: any) => {
    if (section === "matches") return row.adminHiddenFromListings ? "Restore listing" : "Hide listing";
    if (section === "clubs") return "Edit settings";
    if (section === "notifications") return ["FAILED", "DEAD"].includes(row.status) ? "Retry job" : ["PENDING"].includes(row.status) ? "Cancel job" : "—";
    if (section === "awards") return row.revealedAt ? "Reset reveal" : "Reveal award";
    if (section === "teams") return "Edit rating";
    if (section === "superleague") return "Settle week";
    if (section === "users") return "Revoke sessions";
    return "Inspect";
  };
  const rowAction = (row: any) => ["matches", "clubs", "notifications", "awards", "teams", "superleague", "users"].includes(section)
    ? <button className="lb-admin-row-action" disabled={busy || actionLabel(row) === "—"} onClick={() => void act(row)}>{actionLabel(row)}</button>
    : null;
  const recordTitle = (row: any) => {
    if (section === "matches") return `${displayText(first(row.homeTeamName, row.homeTeam?.name), "Home")} vs ${displayText(first(row.awayTeamName, row.awayTeam?.name), "Away")}`;
    if (section === "users") return first(row.displayName, row.username, "Player");
    if (section === "clubs") return first(row.name, "Unnamed club");
    if (section === "teams") return first(row.names?.en, row.names?.fa, row.centralTeamId, "Team");
    if (section === "superleague") return first(row.weekKey, "Super League week");
    if (section === "tournaments") return first(row.name, row.faName, "Tournament");
    if (section === "sync") return `${first(row.provider, "Football provider")} sync`;
    if (section === "notifications") return first(row.type, row.jobKey, "Notification");
    if (section === "awards") return first(row.title, row.type, "Award");
    if (section === "access") return first(row.summary, row.action, "Admin activity");
    return "Record";
  };
  const cardDetail = (row: any) => {
    if (section === "matches") return displayText(first(row.tournamentName, row.tournament), "Fixture");
    if (section === "users") return first(row.username ? `@${row.username}` : "Player account", row.platform);
    if (section === "clubs") return `${row.code ? `Code ${row.code} · ` : ""}${row.discoveryMode === "RECRUITING" ? "Recruiting members" : "Invite only"}`;
    if (section === "teams") return `${row.names?.fa ? `${row.names.fa} · ` : ""}${row.isNational ? "National team" : "Club team"}`;
    if (section === "superleague") return `${first(row.weekKey, "Week")} · ${row.startsAt ? pretty(row.startsAt) : "Schedule not set"}`;
    if (section === "tournaments") return first(row.faName, row.code, "Supported tournament");
    if (section === "sync") return `${first(row.mode, "Fixture refresh")} · ${row.startedAt ? pretty(row.startedAt) : "Time unavailable"}`;
    if (section === "notifications") return first(row.jobKey, "Message delivery");
    if (section === "awards") return `${row.weekKey ? `Week ${row.weekKey} · ` : ""}${row.source ?? "Player award"}`;
    if (section === "access") return first(row.actor?.username ? `By ${row.actor.username}` : "Admin action", row.target);
    return "";
  };
  const image = (row: any) => section === "matches" ? null : section === "tournaments" ? row.logo : section === "teams" ? first(row.logoUrl, row.logo) : null;
  return <>
    {section === "analytics" ? <Analytics overview={overview} onNavigate={onNavigate}/> : null}
    {section === "system" ? <SystemStatus overview={overview} onNavigate={onNavigate}/> : null}
    {section !== "analytics" && section !== "system" && <section className="lb-admin-card lb-admin-directory">
      <div className="lb-admin-directory-toolbar"><div><span className="lb-admin-card-eyebrow">{item?.group?.toUpperCase()}</span><h3>{dataset?.total?.toLocaleString?.() ?? "—"} {section === "matches" ? "fixtures" : section === "users" ? "players" : section === "clubs" ? "clubs" : section === "tournaments" ? "supported competitions" : section === "teams" ? "teams" : section === "superleague" ? "weeks" : section === "sync" ? "sync runs" : section === "notifications" ? "messages" : section === "awards" ? "awards" : "admin actions"}</h3><p>{section === "matches" ? "Browse fixtures, add a missing match, or build a manual slate." : "Browse and manage LowBlock records in plain language."}</p></div><div className="lb-admin-table-tools">{section === "matches" && <><button className="lb-admin-button" onClick={() => setShowManualMatchForm(!showManualMatchForm)}>＋ Add match manually</button><button className="lb-admin-button primary" disabled={selectedMatchIds.length < 4 || selectedMatchIds.length > 5} onClick={() => setShowSlateAssignment(!showSlateAssignment)}>Assign {selectedMatchIds.length || "selected"} to Super League</button></>}{section === "sync" && <><button className="lb-admin-button" disabled={busy} onClick={() => onAction("sync")}><RefreshCw size={15}/> Sync fixtures</button><button className="lb-admin-button primary" disabled={busy} onClick={() => onAction("rebuild-scores")}><Trophy size={15}/> Recalculate scores</button></>}{section === "superleague" && <button className="lb-admin-button primary" disabled={busy} onClick={() => onAdminAction({ action: "h2h-generate" }, "GENERATE CURRENT WEEK", "Generate or refresh the current Super League week.")}>Create current week</button>}{rows.length > 0 && <button className="lb-admin-button" onClick={onExport}>Download list</button>}<label className="lb-admin-search"><Search size={15}/><input aria-label="Search records" placeholder={`Search ${item?.label.toLowerCase() ?? "records"}`} value={query} onChange={(e) => { onPageChange(0); setQuery(e.target.value); }}/></label></div></div>
      {section === "matches" && showManualMatchForm && <ManualMatchForm onCancel={() => setShowManualMatchForm(false)} onCreated={async () => { setShowManualMatchForm(false); setQuery(""); onPageChange(0); await reload("", 0); }} />}
      {section === "matches" && showSlateAssignment && <ManualSlateAssignment selectedMatchIds={selectedMatchIds} weeks={overview?.h2hWeeks ?? []} busy={busy} onCancel={() => setShowSlateAssignment(false)} onAssigned={async () => { setShowSlateAssignment(false); setSelectedMatchIds([]); await reload(); }} />}
      {busy && !dataset ? <div className="lb-admin-loading"><RefreshCw size={18} className="lb-spin"/>Loading…</div> : rows.length === 0 ? <div className="lb-admin-empty"><div className="lb-admin-empty-icon"><Database size={22}/></div><b>{dataset ? "Nothing here yet" : "Could not load this page"}</b><span>{dataset ? "Try another search, or refresh to check again." : "Refresh this page to try again."}</span></div> : <div className="lb-admin-record-grid">{rows.map((row: any, index: number) => {
        const title = recordTitle(row);
        const logo = image(row);
        const matchId = String(row.providerMatchId ?? row.matchId ?? "");
        const matchStatus = String(row.status ?? "").toUpperCase();
        const isSlateEligible = section === "matches" && Boolean(LEAGUES.find((league) => league.code === row.leagueCode)?.h2h) && Boolean(matchId) && !row.adminHiddenFromListings && new Date(row.kickoffAt).getTime() > Date.now() + 45 * 60 * 1000 && !["FINISHED", "FT", "AET", "PEN", "CANCELLED", "POSTPONED", "VOID", "ABANDONED"].includes(matchStatus);
        return <article className={`lb-admin-record-card ${section === "matches" ? "match" : ""}`} key={row._id ?? row.code ?? index}>
          {section === "matches" ? <div className="lb-admin-match-identity"><div className="lb-admin-team-side"><TeamBadge name={first(row.homeTeamName, row.homeTeam?.name, "Home")} logo={row.homeTeam?.logoUrl ?? row.homeTeamLogo}/><b>{displayText(first(row.homeTeamName, row.homeTeam?.name), "Home")}</b></div><span className="lb-admin-match-versus">VS</span><div className="lb-admin-team-side"><TeamBadge name={first(row.awayTeamName, row.awayTeam?.name, "Away")} logo={row.awayTeam?.logoUrl ?? row.awayTeamLogo}/><b>{displayText(first(row.awayTeamName, row.awayTeam?.name), "Away")}</b></div></div> : <div className="lb-admin-record-title-row"><TeamBadge name={title} logo={logo}/><div className="lb-admin-record-heading"><h4>{displayText(title, "Record")}</h4><span>{displayText(cardDetail(row), "")}</span></div></div>}
          <div className="lb-admin-record-meta">
            {section === "matches" && <><span className="lb-admin-tournament-name">{displayText(cardDetail(row), "Fixture")}</span><span>{pretty(first(row.kickoffAt, row.date))}</span><StatusPill value={row.status}/>{first(row.homeGoals, row.homeScore, row.score?.home, row.score?.homeGoals) !== undefined && <b className="lb-admin-match-score">{displayText(first(row.homeGoals, row.homeScore, row.score?.home, row.score?.homeGoals), "0")} – {displayText(first(row.awayGoals, row.awayScore, row.score?.away, row.score?.awayGoals), "0")}</b>}</>}
            {section === "users" && <><StatusPill value={row.isAdmin || row.role === "ADMIN" ? "ADMIN" : "PLAYER"}/><span>{Number(first(row.globalPoints, row.points, 0)).toLocaleString()} points</span><span>Joined {pretty(row.createdAt)}</span></>}
            {section === "clubs" && <><StatusPill value={row.visibility ?? row.state}/><span>{first(row.discoveryMode, "Invite only")}</span><span>Created {pretty(row.createdAt)}</span></>}
            {section === "teams" && <><span>Super League rating</span><b className="lb-admin-rating">{first(row.h2hRating, "Not set")}</b><span>{row.h2hRatingUpdatedAt ? `Updated ${pretty(row.h2hRatingUpdatedAt)}` : "Default team data"}</span></>}
            {section === "tournaments" && <><StatusPill value={row.globalLeaderboard ? "GLOBAL" : "H2H"}/><span>{row.code}</span><span>{row.h2h ? "Eligible for Super League" : "Not used in Super League"}</span></>}
            {section === "superleague" && <><StatusPill value={row.status}/><span>{row.startsAt ? pretty(row.startsAt) : "Start not set"} – {row.endsAt ? pretty(row.endsAt) : "End not set"}</span><span>{first(row.matchCount, row.matches?.length, "Schedule available")}</span></>}
            {section === "sync" && <><StatusPill value={row.status}/><span>{first(row.matchesFetched, 0)} fixtures checked</span><span>{first(row.matchesUpserted, 0)} updated</span><span>{row.finishedAt ? `Finished ${pretty(row.finishedAt)}` : "Still running"}</span></>}
            {section === "notifications" && <><StatusPill value={row.status}/><span>{first(row.attempts, 0)} attempts</span><span>Scheduled {pretty(first(row.runAt, row.createdAt))}</span>{row.lastError && <span className="lb-admin-record-error">{row.lastError}</span>}</>}
            {section === "awards" && <><StatusPill value={row.revealedAt ? "REVEALED" : "PENDING"}/><span>{row.userId ? `Player ${String(row.userId).slice(-6)}` : "Player award"}</span><span>{pretty(row.createdAt)}</span></>}
            {section === "access" && <><StatusPill value={row.outcome}/><span>{row.actor?.username ? `By ${row.actor.username}` : "Admin activity"}</span><span>{pretty(row.createdAt)}</span></>}
          </div>
          <div className="lb-admin-record-footer">{section === "users" && <button className="lb-admin-row-action" disabled={busy} onClick={() => void onUserAdmin(row)}>{row.isAdmin || row.role === "ADMIN" || row.role === "admin" ? "Remove admin access" : "Make administrator"}</button>}{rowAction(row)}{section === "tournaments" && <span className="lb-admin-readonly">Tournament rules are configured in the app</span>}{section === "matches" && <><button className={`lb-admin-row-action lb-admin-select-match ${selectedMatchIds.includes(matchId) ? "selected" : ""}`} disabled={!isSlateEligible && !selectedMatchIds.includes(matchId)} title={isSlateEligible ? "Select this fixture for an unpublished Super League slate" : "Only future fixtures from Super League supported tournaments can be assigned"} onClick={() => { const id = matchId; setSelectedMatchIds((current: string[]) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 5 ? [...current, id] : current); }}>{selectedMatchIds.includes(matchId) ? "✓ Selected for slate" : isSlateEligible ? "Select for slate" : "Not eligible"}</button><span className="lb-admin-record-footnote">{row.adminCreated ? "Manually added" : `${first(row.predictionsCount, 0)} predictions`} · {row.adminHiddenFromListings ? "Hidden from player listings" : "visible to players"}</span></>}</div>
        </article>;
      })}</div>}
      {!!rows.length && <div className="lb-admin-table-footer"><span>Page {page + 1} of {Math.max(1, Math.ceil((dataset?.total ?? 0) / (dataset?.limit ?? 40)))} · Showing {rows.length} of {dataset.total}</span><div className="lb-admin-page-actions"><button disabled={busy || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</button><button disabled={busy || (page + 1) * (dataset?.limit ?? 40) >= dataset.total} onClick={() => onPageChange(page + 1)}>Next</button></div></div>}
    </section>}
    {section === "users" && <div className="lb-admin-note"><Shield size={16}/><span>Granting or revoking admin access requires confirmation. Changes are recorded in the audit log; you cannot revoke your own active admin access here.</span></div>}
  </>;
}

function friendlyOperationError(code: string) {
  const messages: Record<string, string> = {
    H2H_DISABLED: "Super League scheduling is currently disabled.",
    H2H_WEEK_NOT_FOUND: "That Super League week could not be found. Refresh and choose an available week.",
    H2H_NO_ACTIVE_LEAGUES: "There are no active club slates for that week yet. Create the current week first.",
    H2H_SLATE_ALREADY_PUBLISHED: "That matchday is already published. Published fixtures cannot be changed.",
    MATCH_NOT_FOUND: "One or more selected matches no longer exist. Refresh the Matches page and try again.",
    MATCH_NOT_ELIGIBLE: "Choose upcoming matches from supported tournaments on the selected day.",
    DUPLICATE_MATCH: "A matching fixture already exists in the schedule.",
    H2H_GOLD_PICK_ALREADY_EXISTS: "A golden pick already exists for one of these fixtures, so the slate was not changed.",
    H2H_MATCH_ALREADY_ASSIGNED: "One of these fixtures is already assigned to another Super League matchday.",
    UNSUPPORTED_TOURNAMENT: "Choose one of LowBlock’s supported tournaments.",
    KICKOFF_MUST_BE_FUTURE: "The kickoff time must be in the future.",
    TEAMS_MUST_BE_DIFFERENT: "Choose two different teams.",
    INVALID_REQUEST: "Some details are missing or invalid. Check the form and try again.",
  };
  return messages[code] ?? code.replaceAll("_", " ").toLowerCase();
}

function ManualMatchForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => Promise<void> }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [leagueCode, setLeagueCode] = useState<string>(LEAGUES[0]?.code ?? "");
  const [kickoffAt, setKickoffAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const league = LEAGUES.find((entry) => entry.code === leagueCode);
    if (!league || !home.trim() || !away.trim() || !kickoffAt) { setError("Enter both teams, a supported tournament, and a kickoff time."); return; }
    if (!window.confirm(`Add ${home.trim()} vs ${away.trim()} to ${league.enName}? The fixture will be visible to players and can receive predictions.`)) return;
    setSubmitting(true);
    try {
      await jsonFetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-manual-match", leagueCode, homeTeamName: home.trim(), awayTeamName: away.trim(), kickoffAt: new Date(kickoffAt).toISOString(), confirmText: "ADD MATCH" }) });
      await onCreated();
    } catch (cause) { setError(friendlyOperationError(cause instanceof Error ? cause.message : "Could not create fixture")); }
    finally { setSubmitting(false); }
  };
  return <form className="lb-admin-manual-form" onSubmit={submit}>
    <div className="lb-admin-form-heading"><div><b>Add a fixture</b><span>Only tournaments already supported by LowBlock are available here.</span></div><button type="button" onClick={onCancel} aria-label="Close form"><X size={17}/></button></div>
    {error && <p className="lb-admin-form-error" role="alert">{error}</p>}
    <div className="lb-admin-form-grid"><label>Home team<input required value={home} onChange={(e) => setHome(e.target.value)} placeholder="e.g. Persepolis" maxLength={80}/></label><label>Away team<input required value={away} onChange={(e) => setAway(e.target.value)} placeholder="e.g. Sepahan" maxLength={80}/></label><label>Tournament<select value={leagueCode} onChange={(e) => setLeagueCode(e.target.value)}>{LEAGUES.map((league) => <option key={league.code} value={league.code}>{league.enName} · {league.faName}</option>)}</select></label><label>Kickoff time<input required type="datetime-local" value={kickoffAt} onChange={(e) => setKickoffAt(e.target.value)}/></label></div>
    <div className="lb-admin-form-actions"><button type="button" className="lb-admin-button" onClick={onCancel}>Cancel</button><button className="lb-admin-button primary" disabled={submitting}>{submitting ? "Adding fixture…" : "Add fixture"}</button></div>
  </form>;
}

function ManualSlateAssignment({ selectedMatchIds, weeks, busy, onCancel, onAssigned }: { selectedMatchIds: string[]; weeks: any[]; busy: boolean; onCancel: () => void; onAssigned: () => Promise<void> }) {
  const choices = weeks.filter((week) => week.status === "ACTIVE");
  const [weekKey, setWeekKey] = useState(choices[0]?.weekKey ?? "");
  const [matchday, setMatchday] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (selectedMatchIds.length < 4 || selectedMatchIds.length > 5) { setError("Select four or five matches for a complete slate."); return; }
    if (!weekKey) { setError("Choose an active Super League week."); return; }
    if (!window.confirm(`Publish these ${selectedMatchIds.length} fixtures to Week ${weekKey}, matchday ${matchday}? A published slate is locked. Existing predictions and golden picks will not be replaced or deleted.`)) return;
    setSubmitting(true);
    try {
      await jsonFetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "h2h-assign-matches", weekKey, matchday: Number(matchday), matchIds: selectedMatchIds, confirmText: "ASSIGN MATCHES" }) });
      await onAssigned();
    } catch (cause) { setError(friendlyOperationError(cause instanceof Error ? cause.message : "Could not publish slate")); }
    finally { setSubmitting(false); }
  };
  return <form className="lb-admin-manual-form lb-admin-slate-form" onSubmit={submit}>
    <div className="lb-admin-form-heading"><div><b>Publish a manual Super League slate</b><span>Choose 4–5 future fixtures from the same schedule day, at least 45 minutes before kickoff. Published slates cannot be replaced.</span></div><button type="button" onClick={onCancel} aria-label="Close form"><X size={17}/></button></div>
    {error && <p className="lb-admin-form-error" role="alert">{error}</p>}
    {!choices.length ? <div className="lb-admin-inline-warning">No active Super League week is available. Create or activate a week from the Super League page.</div> : <div className="lb-admin-form-grid"><label>Week<select value={weekKey} onChange={(e) => setWeekKey(e.target.value)}>{choices.map((week) => <option key={week.weekKey} value={week.weekKey}>Week of {week.weekKey}</option>)}</select></label><label>Matchday<select value={matchday} onChange={(e) => setMatchday(e.target.value)}>{Array.from({ length: 7 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select></label><div className="lb-admin-selected-count">{selectedMatchIds.length} of 4–5 fixtures selected</div></div>}
    <div className="lb-admin-form-actions"><button type="button" className="lb-admin-button" onClick={onCancel}>Cancel</button><button className="lb-admin-button primary" disabled={submitting || busy || !choices.length || selectedMatchIds.length < 4 || selectedMatchIds.length > 5}>{submitting ? "Publishing slate…" : "Publish slate"}</button></div>
  </form>;
}

function Analytics({ overview, onNavigate }: any) {
  const c = overview?.counts;
  return <><div className="lb-admin-stats lb-admin-analytics-cards">{[
    { title: "Players", value: c?.users, detail: "Registered accounts", section: "users", icon: Users },
    { title: "Fixtures", value: c?.matches, detail: `${c?.upcoming ?? 0} upcoming`, section: "matches", icon: CalendarDays },
    { title: "Predictions", value: c?.predictions, detail: `${c?.unscoredPredictions ?? 0} need scoring`, section: "matches", icon: Trophy },
    { title: "Clubs", value: c?.clubs, detail: "Community spaces", section: "clubs", icon: Building2 },
  ].map((item) => { const Icon = item.icon; return <button key={item.title} className="lb-admin-stat lb-admin-analytics-link" onClick={() => onNavigate(item.section)}><div className="lb-admin-stat-icon mint"><Icon size={18}/></div><div className="lb-admin-stat-label">{item.title}</div><strong className="lb-admin-analytics-title">{item.value?.toLocaleString?.() ?? "—"}</strong><small>{item.detail} <ChevronRight size={12}/></small></button>; })}</div><div className="lb-admin-card lb-admin-analytics-note"><Activity size={18}/><div><b>About these numbers</b><span>These are live totals from LowBlock’s operational records. Engagement events such as page views are not currently collected.</span></div><button className="lb-admin-text-btn" onClick={() => onNavigate("tournaments")}>Review competitions <ChevronRight size={15}/></button></div></>;
}

function SystemStatus({ overview, onNavigate }: any) {
  return <section className="lb-admin-card lb-admin-system-card"><div className="lb-admin-card-heading"><div><span className="lb-admin-card-eyebrow">PRODUCTION STATUS</span><h3>Service checks</h3></div></div><div className="lb-admin-system-grid">{[{ label: "MongoDB", value: overview?.health?.database ?? "Loading", ok: true }, { label: "Super League", value: overview?.health?.h2hEnabled ? "Enabled" : "Disabled", ok: overview?.health?.h2hEnabled }, { label: "Pending score work", value: overview?.counts?.unscoredPredictions ?? "—", ok: !overview?.counts?.unscoredPredictions }, { label: "Notification queue", value: overview?.health?.pendingNotifications ?? 0, ok: !overview?.health?.pendingNotifications }].map((item) => <div key={item.label}><span className={`lb-admin-health-dot ${item.ok ? "" : "amber"}`}/><small>{item.label}</small><b>{item.value}</b></div>)}</div><button className="lb-admin-button" onClick={() => onNavigate("sync")}><RefreshCw size={15}/> Review sync history</button></section>;
}
