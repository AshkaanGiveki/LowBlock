export function matchRoute(matchId: string) {
  return `/matches/${encodeURIComponent(matchId)}`;
}

export function openMatchRoute(matchId: string, origin: string) {
  window.history.pushState({ lowblockMatchOrigin: origin }, "", matchRoute(matchId));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function closeMatchRoute(fallback = "/matches") {
  const origin = window.history.state?.lowblockMatchOrigin;
  const destination = typeof origin === "string" && origin.startsWith("/") ? origin : fallback;
  window.history.replaceState({}, "", destination);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
