"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Estudiante = {
  id: string;
  nombre_completo: string;
  secciones: { curso_id: string } | null;
};
type Disciplina = { id: string; nombre: string };
type Calificacion = {
  id: string;
  etapa: number;
  nota: number | null;
  disciplina_id: string | null;
  disciplinas: { nombre: string } | null;
};

export default function CalificacionesInstitucional() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [etapa, setEtapa] = useState(1);
  const [nota, setNota] = useState("");
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from("estudiantes")
      .select("id, nombre_completo, secciones(curso_id)")
      .order("nombre_completo")
      .then(({ data }) => setEstudiantes((data as unknown as Estudiante[]) ?? []));
  }, [supabase]);

  const cursoIdActual = useMemo(() => {
    const est = estudiantes.find((e) => e.id === estudianteId);
    return est?.secciones?.curso_id ?? null;
  }, [estudiantes, estudianteId]);

  useEffect(() => {
    if (!cursoIdActual) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar selector al cambiar de estudiante
      setDisciplinas([]);
      return;
    }
    supabase
      .from("disciplinas")
      .select("id, nombre")
      .eq("curso_id", cursoIdActual)
      .order("orden")
      .then(({ data }) => {
        setDisciplinas(data ?? []);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- preseleccionar la primera disciplina del curso
        setDisciplinaId((data ?? [])[0]?.id ?? "");
      });
  }, [cursoIdActual, supabase]);

  const cargar = useCallback(async () => {
    if (!estudianteId) return;
    const { data } = await supabase
      .from("calificaciones")
      .select("id, etapa, nota, disciplina_id, disciplinas(nombre)")
      .eq("estudiante_id", estudianteId)
      .order("etapa");
    setCalificaciones((data as unknown as Calificacion[]) ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!estudianteId || !disciplinaId || !nota) return;
    setGuardando(true);
    await supabase.from("calificaciones").upsert(
      { estudiante_id: estudianteId, disciplina_id: disciplinaId, etapa, nota: Number(nota) },
      { onConflict: "estudiante_id,disciplina_id,etapa" }
    );
    setNota("");
    setGuardando(false);
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Calificaciones</h1>
        <p className="text-sm text-text-soft mt-1">Cargá notas por estudiante, disciplina y etapa.</p>
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
          {disciplinas.length === 0 ? (
            <p className="text-sm text-text-soft">
              Este estudiante todavía no tiene un curso con disciplinas cargadas. Cargá las
              disciplinas desde la pantalla de Cursos primero.
            </p>
          ) : (
            <form onSubmit={guardar} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Disciplina
                <select
                  value={disciplinaId}
                  onChange={(e) => setDisciplinaId(e.target.value)}
                  className="h-10 rounded-lg border border-border px-3 text-sm bg-card min-w-[12rem]"
                >
                  {disciplinas.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
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
          )}

          <div className="flex flex-col border-t border-border pt-3">
            {calificaciones.map((c) => (
              <div key={c.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
                <span>{c.disciplinas?.nombre ?? "—"} — {c.etapa}ª etapa</span>
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
