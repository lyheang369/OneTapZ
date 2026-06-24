// Minimal typing for the Telegram Mini App WebApp SDK (telegram-web-app.js),
// loaded via a <script> in index.html when running inside Telegram.
interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand?: () => void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
