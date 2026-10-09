"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    // Ya instalada / abierta como app
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setInstalled(true);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    if (isIos) {
      setShowIosHelp(true);
    }
  }

  // No mostramos nada si no hay forma de instalar (ni prompt disponible ni iOS)
  if (!deferredPrompt && !isIos) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-navy shadow-sm hover:bg-bg transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Instalar app
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="bg-card rounded-xl max-w-sm w-full p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg mb-2">Instalar en iPhone</h3>
            <ol className="text-sm text-text-soft list-decimal list-inside space-y-1.5">
              <li>
                Tocá el botón <strong>Compartir</strong> (el cuadradito con la
                flecha hacia arriba) en Safari.
              </li>
              <li>
                Deslizá y elegí <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
              </li>
              <li>
                Tocá <strong>&quot;Agregar&quot;</strong> arriba a la derecha.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="mt-4 w-full h-10 rounded-lg bg-navy text-white text-sm font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
