"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Platform = "telegram" | "bale";

export function PlatformBootstrap(){
  const router=useRouter();
  const [boot,setBoot]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const authenticate=useCallback(async(provider:Platform,raw:string)=>{
    setBoot(true); setError(null);
    const controller=new AbortController(); const timeout=window.setTimeout(()=>controller.abort(),12_000);
    try{
      const response=await fetch(`/api/auth/platform/${provider}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:raw}),signal:controller.signal});
      const data=await response.json().catch(()=>null) as {ok?:boolean;error?:string}|null;
      if(data?.ok){router.replace("/matches");router.refresh();return;}
      if(data?.error==="LINK_REQUIRED"){router.replace(`/platform-link?provider=${provider}`);return;}
      setError(data?.error==="PLATFORM_AUTH_EXPIRED"?"Telegram session expired. Close and reopen the Mini App.":"LowBlock could not verify this platform session.");
    }catch(reason){setError(reason instanceof DOMException&&reason.name==="AbortError"?"LowBlock took too long to connect. Please try again.":"LowBlock could not connect. Please try again.");}
    finally{window.clearTimeout(timeout);setBoot(false);}
  },[router]);
  useEffect(()=>{
    const w=window as Window & {Telegram?:{WebApp?:{initData?:string;ready?:()=>void;expand?:()=>void}};Bale?:{WebApp?:{initData?:string}}};
    const tg=w.Telegram?.WebApp; const bale=w.Bale?.WebApp;
    if(tg?.initData){tg.ready?.();tg.expand?.();void authenticate("telegram",tg.initData);return;}
    if(bale?.initData){void authenticate("bale",bale.initData);}
  },[authenticate]);
  if(error&&!boot)return <div className="fixed inset-0 z-[200] grid place-items-center bg-[#09110c] px-6"><div className="w-full max-w-sm rounded-3xl border border-red-300/20 bg-[#101a14] p-7 text-center"><img src="/lowblock.png" alt="LowBlock" className="mx-auto h-16 w-16"/><h1 className="mt-5 text-lg font-black text-white">Couldn’t open LowBlock</h1><p className="mt-3 text-sm leading-6 text-white/60">{error}</p><button type="button" onClick={()=>window.location.reload()} className="mt-6 w-full rounded-xl bg-brand px-4 py-3 font-black text-[#07100b]">Try again</button></div></div>;
  return boot?<div className="fixed inset-0 z-[200] grid place-items-center bg-[#09110c] px-6"><div className="text-center"><img src="/lowblock.png" alt="LowBlock" className="mx-auto h-16 w-16 animate-pulse"/><p className="mt-5 text-sm font-bold text-white/70">Checking your LowBlock account…</p></div></div>:null;
}
