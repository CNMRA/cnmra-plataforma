"use client";

import { useState } from "react";

export default function FamiliaClave({ id, nombre }: { id: string; nombre: string }) {
  const [trabajando, setTrabajando] = useState(false);

  async function cambiar() {
    const clave = window.prompt(`Nueva clave para ${nombre} (mínimo 6 caracteres):`);
    if (clave === null) return;
    if (clave.trim().length < 6) {
      window.alert("La clave debe tener al menos 6 caracteres.");
      return;
    }
    setTrabajando(true);
    try {
      const r = await fetch("/api/familias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: clave.trim() }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      window.alert(r.ok ? `Listo. La clave de ${nombre} fue cambiada.` : (d.error ?? "No se pudo cambiar la clave."));
    } catch {
      window.alert("No se pudo conectar. Probá de nuevo.");
    }
    setTrabajando(false);
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      disabled={trabajando}
      className="text-xs text-navy font-medium border border-border rounded-md px-2.5 h-7 disabled:opacity-60"
    >
      {trabajando ? "Cambiando…" : "Cambiar clave"}
    </button>
  );
}
