"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { useState } from "react";
import { makeStore } from "@/store/store";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { AwardReveal } from "@/components/AwardReveal";
import { PublicAwardsMount } from "@/components/PublicAwardsMount";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }));
  const [store] = useState(makeStore);
  return <Provider store={store}><QueryClientProvider client={queryClient}><LanguageProvider><ToastProvider>{children}<AwardReveal /><PublicAwardsMount /></ToastProvider></LanguageProvider></QueryClientProvider></Provider>;
}
