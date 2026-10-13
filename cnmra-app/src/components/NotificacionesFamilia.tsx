"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Estado = "desconocido" | "no_disponible" | "inactivas" | "activando" | "activas" | "error";

export default function NotificacionesFamilia() {
  const supabase = createClient();
  const [estado, setEstado] = useState<Estado>("desconocido");

  useEffect(() => {
    async function revisar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no_disponible");
        return;
      }
      try {
        const registro = await navigator.serviceWorker.register("/sw.js");
        const sub = await registro.pushManager.getSubscription();
        setEstado(sub ? "activas" : "inactivas");
      } catch {
        setEstado("no_disponible");
      }
    }
    revisar();
  }, []);

  async function activar() {
    setEstado("activando");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("inactivas");
        return;
      }

      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setEstado("error");
        return;
      }

      const sub = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const { data: sesion } = await supabase.auth.getSession();
      if (!sesion.session) {
        setEstado("error");
        return;
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setEstado(res.ok ? "activas" : "error");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "desconocido" || estado === "no_disponible" || estado === "activas") return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <div className="font-semibold">Activá las notificaciones</div>
        <p className="text-text-soft mt-0.5">
          Recibí un aviso en el celular apenas se carga una ausencia, una llegada tardía, un
          registro o una nota.
        </p>
      </div>
      <button
        onClick={activar}
        disabled={estado === "activando"}
        className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 disabled:opacity-60 shrink-0"
      >
        {estado === "activando" ? "Activando…" : estado === "error" ? "Reintentar" : "Activar"}
      </button>
    </div>
  );
}
