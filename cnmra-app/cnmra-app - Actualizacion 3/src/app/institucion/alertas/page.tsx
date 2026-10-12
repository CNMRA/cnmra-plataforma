"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Estudiante = { id: string; nombre_completo: string };
type Alerta = {
  id: string;
  tipo: string;
  severidad: string;
  mensaje: string;
  creado_en: string;
  estudiantes: { nombre_completo: string } | null;
};

export default function AlertasInstitucional() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [tipo, setTipo] = useState("inasistencia");
  const [severidad, setSeveridad] = useState("media");
  const [mensaje, setMensaje] = useState("");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from("estudiantes")
      .select("id, nombre_completo")
      .order("nombre_completo")
      .then(({ data }) => setEstudiantes(data ?? []));
  }, [supabase]);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("alertas")
      .select("id, tipo, severidad, mensaje, creado_en, estudiantes(nombre_completo)")
      .order("creado_en", { ascending: false })
      .limit(20);
    setAlertas((data as unknown as Alerta[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!estudianteId || !mensaje) return;
    setGuardando(true);
    await supabase.from("alertas").insert({
      estudiante_id: estudianteId,
      tipo,
      severidad,
      mensaje,
    });
    setMensaje("");
    setGuardando(false);
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Alertas y comunicación</h1>
        <p className="text-sm text-text-soft mt-1">La familia la ve apenas ingresa a su cuenta.</p>
      </div>

      <form onSubmit={enviar} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
        <div className="grid md:grid-cols-3 gap-3">
          <select value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card">
            <option value="">Estudiante…</option>
            {estudiantes.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre_completo}</option>
            ))}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card">
            <option value="inasistencia">Inasistencia</option>
            <option value="academica">Académica</option>
            <option value="conducta">Conducta</option>
            <option value="acuerdo_pendiente">Acuerdo pendiente</option>
            <option value="otro">Otro</option>
          </select>
          <select value={severidad} onChange={(e) => setSeveridad(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </div>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Mensaje para la familia…"
          className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-20"
          required
        />
        <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6">
          {guardando ? "Enviando…" : "Enviar alerta"}
        </button>
      </form>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display text-lg mb-3">Historial</h3>
        <div className="flex flex-col">
          {alertas.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-none text-sm">
              <span className={`w-2 h-2 rounded-full flex-none ${a.severidad === "alta" ? "bg-danger" : a.severidad === "media" ? "bg-warning" : "bg-gold"}`} />
              <div className="flex-1">
                <div className="font-medium">{a.estudiantes?.nombre_completo ?? "—"}</div>
                <div className="text-xs text-text-soft">{a.mensaje}</div>
              </div>
              <span className="text-xs text-text-soft">{new Date(a.creado_en).toLocaleDateString("es-PY")}</span>
            </div>
          ))}
          {alertas.length === 0 && <p className="text-sm text-text-soft">Sin alertas todavía.</p>}
        </div>
      </div>
    </div>
  );
}
