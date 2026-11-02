"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MiCuentaPage() {
  const supabase = createClient();
  const [usuario, setUsuario] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dato inicial del usuario
      setUsuario(email.split("@")[0]);
    });
  }, [supabase]);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    if (nueva.length < 6) {
      setMensaje({ tipo: "error", texto: "La contraseña nueva debe tener al menos 6 caracteres." });
      return;
    }
    if (nueva !== repetir) {
      setMensaje({ tipo: "error", texto: "Las dos contraseñas no coinciden." });
      return;
    }
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password: nueva });
    setGuardando(false);
    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudo cambiar la contraseña: " + error.message });
      return;
    }
    setNueva("");
    setRepetir("");
    setMensaje({ tipo: "ok", texto: "Contraseña cambiada. Desde ahora entrás con la nueva." });
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <div>
        <h1 className="font-display text-2xl">Mi cuenta</h1>
        <p className="text-sm text-text-soft mt-1">
          Tu usuario es <span className="font-semibold text-text">{usuario}</span>. Si querés, podés cambiar tu contraseña.
        </p>
      </div>

      <form onSubmit={cambiar} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Contraseña nueva
          <input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg focus:outline-none focus:border-teal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Repetí la contraseña nueva
          <input
            type="password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            className="h-11 rounded-lg border border-border px-3.5 text-sm bg-bg focus:outline-none focus:border-teal"
          />
        </label>

        {mensaje && (
          <div
            className={`text-sm rounded-lg px-3 py-2 border ${
              mensaje.tipo === "ok"
                ? "text-teal bg-green-50 border-green-200"
                : "text-danger bg-red-50 border-red-200"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="h-11 rounded-lg bg-navy text-white font-semibold text-sm disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
