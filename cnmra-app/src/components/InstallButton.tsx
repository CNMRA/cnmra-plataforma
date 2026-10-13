"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Plataforma = "ios" | "android" | "desktop";

const INSTRUCCIONES: Record<Plataforma, { titulo: string; pasos: React.ReactNode[] }> = {
  ios: {
    titulo: "Instalar en iPhone / iPad",
    pasos: [
      <>
        Tocá el botón <strong>Compartir</strong> (el cuadradito con la flecha
        hacia arriba) en Safari.
      </>,
      <>
        Deslizá y elegí <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
      </>,
      <>
        Tocá <strong>&quot;Agregar&quot;</strong> arriba a la derecha.
      </>,
    ],
  },
  android: {
    titulo: "Instalar en Android",
    pasos: [
      <>
        Tocá el menú de tres puntitos <strong>⋮</strong> arriba a la derecha
        del navegador.
      </>,
      <>
        Elegí <strong>&quot;Instalar app&quot;</strong> o{" "}
        <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
      </>,
      <>Confirmá tocando &quot;Instalar&quot; o &quot;Agregar&quot;.</>,
    ],
  },
  desktop: {
    titulo: "Instalar en la computadora",
    pasos: [
      <>
        Buscá el ícono de instalación (una pantalla con una flecha) en la
        barra de direcciones, a la derecha.
      </>,
      <>Si no lo ves, abrí el menú del navegador (⋮ o ≡).</>,
      <>
        Elegí <strong>&quot;Instalar CNMRA&quot;</strong> o{" "}
        <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
      </>,
    ],
  },
};

function detectarPlataforma(): Plataforma {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma>("desktop");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // Ya instalada / abierta como app
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- detectar si ya corre instalada al montar
      setInstalled(true);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- detectar plataforma al montar
    setPlataforma(detectarPlataforma());

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
    // Si el navegador ofrece el instalador nativo (Chrome/Edge/Android en
    // algunos casos), lo usamos directamente.
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    // En cualquier otro caso (iPhone, Safari, Firefox, navegadores que no
    // disparan el instalador automático, etc.) mostramos el paso a paso
    // según la plataforma detectada, así el botón siempre sirve para algo.
    setShowHelp(true);
  }

  const info = INSTRUCCIONES[plataforma];

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

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-card rounded-xl max-w-sm w-full p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg mb-2">{info.titulo}</h3>
            <ol className="text-sm text-text-soft list-decimal list-inside space-y-1.5">
              {info.pasos.map((paso, i) => (
                <li key={i}>{paso}</li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
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
