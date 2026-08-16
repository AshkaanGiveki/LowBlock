import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink:"#ffffff", panel:"#111114", brand:"#ca103f", "brand-hover":"#e11d51", line:"#29292f" }, boxShadow:{ glow:"0 0 0 1px rgba(202,16,63,.2),0 25px 90px rgba(0,0,0,.45)" } } }, plugins:[] };
export default config;
