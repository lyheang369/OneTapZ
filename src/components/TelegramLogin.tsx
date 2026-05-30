import { useEffect, useRef, useState } from 'react';
import type { TelegramLoginPayload } from '../context/AuthContext';

declare global {
  interface Window {
    onOneTapZTelegramAuth?: (payload: TelegramLoginPayload) => void;
  }
}

export function TelegramLogin({ onAuth }: { onAuth: (payload: TelegramLoginPayload) => Promise<void> }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME as string | undefined;

  useEffect(() => {
    if (!botName || !mountRef.current) return;

    window.onOneTapZTelegramAuth = async (payload) => {
      setMessage('');
      try {
        await onAuth(payload);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Telegram login failed.');
      }
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName.replace('@', ''));
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onOneTapZTelegramAuth(user)');
    mountRef.current.replaceChildren(script);

    return () => {
      delete window.onOneTapZTelegramAuth;
    };
  }, [botName, onAuth]);

  if (!botName) {
    return (
      <div className="telegram-login-fallback">
        Telegram login is ready after setting <span>VITE_TELEGRAM_BOT_NAME</span> and <span>TELEGRAM_BOT_TOKEN</span>.
      </div>
    );
  }

  return (
    <div className="telegram-login-box">
      <div ref={mountRef} />
      {message && <p className="alert">{message}</p>}
    </div>
  );
}
