type MiniAppSdk = {
  initData: string;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
};

interface Window {
  Telegram?: { WebApp?: MiniAppSdk };
  Bale?: { WebApp?: MiniAppSdk };
}
