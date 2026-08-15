import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink:"#07110d", panel:"#0b1712", brand:"#22c77a", line:"#1d3428" }, boxShadow:{ glow:"0 0 0 1px rgba(34,199,122,.1),0 20px 70px rgba(0,0,0,.22)" } } }, plugins:[] };
export default config;
