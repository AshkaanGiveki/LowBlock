"use client";

import { useEffect, useState } from "react";
import { DesktopHomeDashboard } from "@/components/DesktopHomeDashboard";
import H2HHomeMatchupCard from "@/components/H2HHomeMatchupCard";
import { HomeFixtureSlider } from "@/components/HomeFixtureSlider";

export default function HomeLiveData() {
  const [data, setData] = useState<any>();
  useEffect(() => { fetch("/api/home", { cache: "no-store" }).then((response) => response.json()).then(setData).catch(() => undefined); }, []);
  const value = data ?? { matches: [], predictions: {}, allPredicted: false, rows: [], username: "", rank: "—", points: 0, exact: 0, clubName: null };
  return <><div className="mt-6 min-h-24"><DesktopHomeDashboard matches={value.matches} predictions={value.predictions} allPredicted={value.allPredicted} rows={value.rows} username={value.username} rank={value.rank} points={value.points} exact={value.exact} clubName={value.clubName} /></div>{data?.h2hTodayMatch && <H2HHomeMatchupCard match={data.h2hTodayMatch} />}<section className="mt-8 pb-8"><div className="flex items-end justify-between"><div><p className="text-xs font-black tracking-[.16em] text-brand">UPCOMING MATCHES</p><h2 className="mt-2 text-2xl font-black">Upcoming predictions</h2></div><a href="/matches" className="text-xs font-bold text-brand">Predict</a></div><HomeFixtureSlider matches={value.matches} predictions={value.predictions} allPredicted={value.allPredicted} /></section></>;
}
