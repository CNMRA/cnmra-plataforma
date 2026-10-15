"use client";

import { useEffect } from "react";

// Registra el service worker apenas se abre cualquier página de la plataforma
// (no solo al entrar a /familia). Esto es necesario para que el navegador
// considere que la app se puede "instalar" (botón Instalar app / Agregar a
// pantalla de inicio) incluso antes de que la persona inicie sesión.
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla (navegador viejo, modo privado, etc.) no hacemos nada:
        // la plataforma sigue funcionando igual, solo no se podrá instalar.
      });
    }
  }, []);

  return null;
}
