"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Estudiante = { id: string; nombre_completo: string };
type Calificacion = { id: string; materia: string; etapa: number; nota: number | null };

export default function CalificacionesInstitucional() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [materia, setMateria] = useState("Matemática");
  const [etapa, setEtapa] = useState(1);
  const [nota, setNota] = useState("");
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from("estudiantes")
      .select("id, nombre_completo")
      .order("nombre_completo")
      .then(({ data }) => setEstudiantes(data ?? []));
  }, [supabase]);

  const cargar = useCallback(async () => {
    if (!estudianteId) return;
    const { data } = await supabase
      .from("calificaciones")
      .select("id, materia, etapa, nota")
      .eq("estudiante_id", estudianteId)
      .order("etapa");
    setCalificaciones(data ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!estudianteId || !materia || !nota) return;
    setGuardando(true);
    await supabase.from("calificaciones").upsert(
      { estudiante_id: estudianteId, materia, etapa, nota: Number(nota) },
      { onConflict: "estudiante_id,materia,etapa" }
    );
    setNota("");
    setGuardando(false);
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Calificaciones</h1>
        <p className="text-sm text-text-soft mt-1">Cargá notas por estudiante, materia y etapa.</p>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium max-w-sm">
        Estudiante
        <select
          value={estudianteId}
          onChange={(e) => setEstudianteId(e.target.value)}
          className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
        >
          <option value="">Seleccionar estudiante…</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_completo}
            </option>
          ))}
        </select>
      </label>

      {estudianteId && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <form onSubmit={guardar} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Materia
              <input value={materia} onChange={(e) => setMateria(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Etapa
              <select value={etapa} onChange={(e) => setEtapa(Number(e.target.value))} className="h-10 rounded-lg border border-border px-3 text-sm bg-card">
                <option value={1}>1ª etapa</option>
                <option value={2}>2ª etapa</option>
                <option value={3}>3ª etapa</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Nota
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-sm bg-card w-24"
                required
              />
            </label>
            <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5">
              {guardando ? "Guardando…" : "Guardar nota"}
            </button>
          </form>

          <div className="flex flex-col border-t border-border pt-3">
            {calificaciones.map((c) => (
              <div key={c.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
                <span>{c.materia} — {c.etapa}ª etapa</span>
                <span className="font-semibold">{c.nota ?? "—"}</span>
              </div>
            ))}
            {calificaciones.length === 0 && <p className="text-sm text-text-soft">Sin calificaciones cargadas todavía.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
