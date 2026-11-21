"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Award, Bell, Building2, CalendarDays, ChevronRight, CircleHelp, Database, Gauge, Globe2, LayoutDashboard, LogOut, Menu, RefreshCw, Search, ShieldCheck, Shield, Trophy, Users, X, Zap } from "lucide-react";

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
  if (typeof value === "object") return JSON.stringify(value);
  const raw = String(value);
  const date = new Date(raw);
  if (/\d{4}-\d\d-\d\dT/.test(raw) && !Number.isNaN(date.getTime())) return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return raw.length > 110 ? `${raw.slice(0, 107)}…` : raw;
}
function labelize(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()); }

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
  const current = headings[section];
  const navGroups = useMemo(() => [...new Set(nav.map((item) => item.group))], []);

  const load = useCallback(async (target = section, search = query, page = dataPage) => {
    setBusy(true); setError("");
    try {
      const tasks: Promise<any>[] = [jsonFetch("/api/admin/overview")];
      const item = nav.find((entry) => entry.id === target);
      if (item?.data) tasks.push(jsonFetch(`/api/admin/data?section=${item.data}&q=${encodeURIComponent(search)}&page=${page}`));
      const [summary, rows] = await Promise.all(tasks);
      setOverview(summary); setDataset(rows ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load admin data"); }
    finally { setBusy(false); }
  }, [section, query, dataPage]);

  useEffect(() => { void load(section, query); }, [section]);
  useEffect(() => { setDataPage(0); const timer = setTimeout(() => { if (nav.find((item) => item.id === section)?.data) void load(section, query, 0); }, 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { if (nav.find((item) => item.id === section)?.data) void load(section, query, dataPage); }, [dataPage]);
  useEffect(() => { const timer = setInterval(() => { if (section === "overview" || section === "system") void load(section, query); }, 30_000); return () => clearInterval(timer); }, [section, query, load]);

  const changeSection = (target: Section) => { setSection(target); setQuery(""); setDataPage(0); setDataset(null); setMobileMenu(false); };
  const runAction = async (action: "sync" | "rebuild-scores") => {
    const prompt = action === "sync"
      ? "Run a provider sync now? This calls the configured football provider and may use its request quota."
      : "Recalculate match scores and leaderboard totals now? Existing predictions are preserved, but score totals can change.";
    if (!window.confirm(prompt)) return;
    setBusy(true); setError("");
    try {
      const result = await jsonFetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      setToast(action === "sync" ? "Sync completed. Review the run summary." : "Score rebuild completed.");
      setDataset({ section: action, total: 1, rows: [{ action, result: result.result, completedAt: new Date().toISOString() }] });
      await load("overview", query);
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
      await load("users", query);
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
      await load(reload, query);
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
      <div className="lb-admin-header-actions"><span className="lb-admin-live"><i /> Live data</span><button aria-label="Refresh data" className="lb-admin-icon-btn" onClick={() => void load()}><RefreshCw size={17} className={busy ? "lb-spin" : ""} /></button><button className="lb-admin-avatar" title={username}>{username.slice(0, 1).toUpperCase()}</button></div>
    </header>
    {error && <div className="lb-admin-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    {toast && <div className="lb-admin-toast"><ShieldCheck size={17}/>{toast}</div>}
    {section === "overview" ? <Overview overview={overview} busy={busy} runAction={runAction} onNavigate={changeSection} /> : <DataSection section={section} dataset={dataset} overview={overview} busy={busy} query={query} setQuery={setQuery} page={dataPage} onPageChange={setDataPage} onNavigate={changeSection} onAction={runAction} onUserAdmin={changeUserAdmin} onAdminAction={performAction} onExport={exportData} />}
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

function DataSection({ section, dataset, overview, busy, query, setQuery, page, onPageChange, onNavigate, onAction, onUserAdmin, onAdminAction, onExport }: any) {
  const item = nav.find((entry) => entry.id === section);
  const rows = dataset?.rows ?? [];
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => key !== "_id").slice(0, 9) : [];
  const act = (row: any) => {
    if (section === "matches") return onAdminAction({ action: "set-match-visibility", matchId: row.providerMatchId ?? row.matchId, hidden: row.adminHiddenFromListings !== true }, "UPDATE MATCH VISIBILITY", `${row.adminHiddenFromListings ? "Restore" : "Hide"} ${row.homeTeamName ?? row.homeTeam?.name ?? "Home"} vs ${row.awayTeamName ?? row.awayTeam?.name ?? "Away"} in the user matches list. Predictions remain intact.`);
    if (section === "clubs") {
      const name = window.prompt("Club name", row.name); if (name === null) return;
      const visibility = window.prompt("Visibility: PUBLIC or PRIVATE", row.visibility ?? "PUBLIC"); if (visibility === null || !["PUBLIC", "PRIVATE"].includes(visibility.toUpperCase())) return;
      const discoveryMode = window.prompt("Discovery: INVITE_ONLY or RECRUITING", row.discoveryMode ?? "INVITE_ONLY"); if (discoveryMode === null || !["INVITE_ONLY", "RECRUITING"].includes(discoveryMode.toUpperCase())) return;
      return onAdminAction({ action: "set-club-settings", clubId: row._id, name, visibility: visibility.toUpperCase(), discoveryMode: discoveryMode.toUpperCase() }, "UPDATE CLUB", `Update settings for ${row.name}.`);
    }
    if (section === "notifications") {
      if (row.status === "PENDING" || row.status === "PROCESSING" || row.status === "DONE" || row.status === "CANCELLED") return;
      const retry = row.status !== "PENDING";
      return onAdminAction({ action: retry ? "retry-notification" : "cancel-notification", jobId: row._id }, retry ? "RETRY JOB" : "CANCEL JOB", `${retry ? "Retry" : "Cancel"} notification job ${row.jobKey ?? row._id}.`);
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
  const rowAction = (row: any) => {
    if (["matches", "clubs", "notifications", "awards", "teams", "superleague", "users"].includes(section)) return <button className="lb-admin-row-action" disabled={busy || actionLabel(row) === "—"} onClick={() => void act(row)}>{actionLabel(row)}</button>;
    return <button className="lb-admin-row-action" onClick={() => window.alert(JSON.stringify(row, null, 2))}>Inspect</button>;
  };
  return <>
    {section === "analytics" ? <Analytics onNavigate={onNavigate}/> : null}
    {section === "system" ? <SystemStatus overview={overview} onNavigate={onNavigate}/> : null}
    {section !== "analytics" && section !== "system" && <section className="lb-admin-card lb-admin-table-card">
      <div className="lb-admin-table-toolbar"><div><span className="lb-admin-card-eyebrow">{item?.group?.toUpperCase()}</span><h3>{dataset?.total?.toLocaleString?.() ?? "—"} records</h3></div><div className="lb-admin-table-tools">{section === "sync" && <><button className="lb-admin-button" disabled={busy} onClick={() => onAction("sync")}><RefreshCw size={15}/> Sync now</button><button className="lb-admin-button primary" disabled={busy} onClick={() => onAction("rebuild-scores")}><Trophy size={15}/> Rebuild scores</button></>}{section === "superleague" && <button className="lb-admin-button primary" disabled={busy} onClick={() => onAdminAction({ action: "h2h-generate" }, "GENERATE CURRENT WEEK", "Generate or refresh the current Super League week.")}>Generate current week</button>}{rows.length > 0 && <button className="lb-admin-button" onClick={onExport}>Export CSV</button>}<label className="lb-admin-search"><Search size={15}/><input placeholder="Search records" value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>⌘ K</kbd></label></div></div>
      {(section === "users" || section === "matches" || section === "sync" || section === "superleague" || section === "clubs") && <div className="lb-admin-filter-row"><span>All records <b>{dataset?.total ?? 0}</b></span>{section === "matches" && <><button className="selected">All fixtures</button><button onClick={() => setQuery("LIVE")}>Live</button><button onClick={() => setQuery("FINISHED")}>Finished</button></>}<span className="lb-admin-filter-end">Showing up to 40 · Search to narrow results</span></div>}
      {busy && !dataset ? <div className="lb-admin-loading"><RefreshCw size={18} className="lb-spin"/>Loading records…</div> : rows.length === 0 ? <div className="lb-admin-empty"><div className="lb-admin-empty-icon"><Database size={22}/></div><b>{dataset ? "No records to show" : "Connect this section"}</b><span>{dataset ? "Try a different search or refresh." : "This section is specified for the admin panel and will appear here as its data source is connected."}</span></div> : <>
        <div className="lb-admin-table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{labelize(column)}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row: any, index: number) => <tr key={row._id ?? row.code ?? `${index}`}><>{columns.map((column) => <td key={column}><span className={column.toLowerCase().includes("status") || column === "outcome" ? `lb-admin-status-chip ${String(row[column]).toLowerCase()}` : ""}>{pretty(row[column])}</span></td>)}</><td><div className="lb-admin-row-actions">{section === "users" && <button className="lb-admin-row-action" disabled={busy} onClick={() => void onUserAdmin(row)}>{row.isAdmin || row.role === "ADMIN" || row.role === "admin" ? "Revoke admin" : "Grant admin"}</button>}{rowAction(row)}{section === "tournaments" && <span className="lb-admin-readonly">Code-managed</span>}</div></td></tr>)}</tbody></table></div>
        <div className="lb-admin-mobile-records">{rows.map((row: any, index: number) => <article key={row._id ?? row.code ?? index}><header><b>{pretty(row[columns[0]])}</b><div className="lb-admin-row-actions">{section === "users" && <button disabled={busy} onClick={() => void onUserAdmin(row)}>{row.isAdmin || row.role === "ADMIN" || row.role === "admin" ? "Revoke admin" : "Grant admin"}</button>}{rowAction(row)}</div></header>{columns.slice(1, 6).map((column) => <div key={column}><span>{labelize(column)}</span><b>{pretty(row[column])}</b></div>)}</article>)}</div>
        <div className="lb-admin-table-footer"><span>Page {page + 1} of {Math.max(1, Math.ceil((dataset?.total ?? 0) / (dataset?.limit ?? 40)))} · {rows.length} shown of {dataset.total}</span><div className="lb-admin-page-actions"><button disabled={busy || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</button><button disabled={busy || (page + 1) * (dataset?.limit ?? 40) >= dataset.total} onClick={() => onPageChange(page + 1)}>Next</button></div></div>
      </>}
    </section>}
    {section === "users" && <div className="lb-admin-note"><Shield size={16}/><span>Granting or revoking admin access requires confirmation. Changes are recorded in the audit log; you cannot revoke your own active admin access here.</span></div>}
  </>;
}

function Analytics({ onNavigate }: any) {
  return <div className="lb-admin-stats lb-admin-analytics-cards">{[{ title: "Player growth", section: "users", icon: Users }, { title: "Prediction activity", section: "matches", icon: Trophy }, { title: "Club participation", section: "clubs", icon: Building2 }, { title: "Competition coverage", section: "tournaments", icon: Globe2 }].map((item) => { const Icon = item.icon; return <button key={item.title} className="lb-admin-stat lb-admin-analytics-link" onClick={() => onNavigate(item.section)}><div className="lb-admin-stat-icon mint"><Icon size={18}/></div><div className="lb-admin-stat-label">Open report</div><strong className="lb-admin-analytics-title">{item.title}</strong><small>View source records <ChevronRight size={12}/></small></button>; })}<div className="lb-admin-note full"><Activity size={16}/> Product analytics are limited to available operational collections. Event-level engagement analytics are not currently persisted by the app.</div></div>;
}

function SystemStatus({ overview, onNavigate }: any) {
  return <section className="lb-admin-card lb-admin-system-card"><div className="lb-admin-card-heading"><div><span className="lb-admin-card-eyebrow">PRODUCTION STATUS</span><h3>Service checks</h3></div></div><div className="lb-admin-system-grid">{[{ label: "MongoDB", value: overview?.health?.database ?? "Loading", ok: true }, { label: "Super League", value: overview?.health?.h2hEnabled ? "Enabled" : "Disabled", ok: overview?.health?.h2hEnabled }, { label: "Pending score work", value: overview?.counts?.unscoredPredictions ?? "—", ok: !overview?.counts?.unscoredPredictions }, { label: "Notification queue", value: overview?.health?.pendingNotifications ?? 0, ok: !overview?.health?.pendingNotifications }].map((item) => <div key={item.label}><span className={`lb-admin-health-dot ${item.ok ? "" : "amber"}`}/><small>{item.label}</small><b>{item.value}</b></div>)}</div><button className="lb-admin-button" onClick={() => onNavigate("sync")}><RefreshCw size={15}/> Review sync history</button></section>;
}
