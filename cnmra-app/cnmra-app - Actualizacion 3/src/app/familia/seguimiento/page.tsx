"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Estudiante = { id: string; nombre_completo: string };
type Registro = {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  disciplina_id: string | null;
  disciplinas: { nombre: string } | null;
};
type Asistencia = { id: string; fecha: string; estado: string };
type Calificacion = {
  id: string;
  etapa: number;
  nota: number | null;
  disciplina_id: string | null;
  disciplinas: { nombre: string } | null;
};

export default function SeguimientoFamilia() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [tab, setTab] = useState<"anecdotico" | "asistencia" | "notas">("anecdotico");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [filtroDisciplina, setFiltroDisciplina] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: familia } = await supabase.from("familias").select("id").eq("tutor_perfil_id", user.id).maybeSingle();
      if (!familia) return;
      const { data } = await supabase.from("estudiantes").select("id, nombre_completo").eq("familia_id", familia.id);
      setEstudiantes(data ?? []);
      if (data && data.length > 0) setEstudianteId(data[0].id);
    })();
  }, [supabase]);

  const cargar = useCallback(async () => {
    if (!estudianteId) return;
    const [{ data: r }, { data: a }, { data: c }] = await Promise.all([
      supabase
        .from("registros_anecdoticos")
        .select("id, fecha, categoria, descripcion, disciplina_id, disciplinas(nombre)")
        .eq("estudiante_id", estudianteId)
        .eq("visible_familia", true)
        .order("fecha", { ascending: false }),
      supabase.from("asistencias").select("id, fecha, estado").eq("estudiante_id", estudianteId).order("fecha", { ascending: false }),
      supabase
        .from("calificaciones")
        .select("id, etapa, nota, disciplina_id, disciplinas(nombre)")
        .eq("estudiante_id", estudianteId)
        .order("etapa"),
    ]);
    setRegistros((r as unknown as Registro[]) ?? []);
    setAsistencias(a ?? []);
    setCalificaciones((c as unknown as Calificacion[]) ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
    setFiltroDisciplina("");
  }, [cargar]);

  const disciplinasDisponibles = Array.from(
    new Map(
      registros
        .filter((r) => r.disciplinas?.nombre)
        .map((r) => [r.disciplina_id as string, r.disciplinas!.nombre])
    ).entries()
  );

  const registrosFiltrados = filtroDisciplina
    ? registros.filter((r) => r.disciplina_id === filtroDisciplina)
    : registros;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Seguimiento</h1>
      </div>

      {estudiantes.length > 1 && (
        <select value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs">
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre_completo}</option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        {[
          { id: "anecdotico", label: "Anecdótico" },
          { id: "asistencia", label: "Asistencia" },
          { id: "notas", label: "Notas" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold ${tab === t.id ? "bg-navy text-white" : "bg-card border border-border text-text-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        {tab === "anecdotico" && (
          <>
            {disciplinasDisponibles.length > 0 && (
              <label className="flex flex-col gap-1.5 text-[13px] font-medium max-w-xs mb-4">
                Ver solo…
                <select
                  value={filtroDisciplina}
                  onChange={(e) => setFiltroDisciplina(e.target.value)}
                  className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
                >
                  <option value="">Todas las disciplinas</option>
                  {disciplinasDisponibles.map(([id, nombre]) => (
                    <option key={id} value={id}>{nombre}</option>
                  ))}
                </select>
              </label>
            )}
            {registrosFiltrados.length === 0 ? (
              <p className="text-sm text-text-soft">Sin registros todavía.</p>
            ) : (
              registrosFiltrados.map((r) => (
                <div key={r.id} className="py-2 border-b border-border last:border-none text-sm">
                  <div className="text-xs text-text-soft">
                    {r.fecha} · {r.categoria}
                    {r.disciplinas?.nombre ? ` · ${r.disciplinas.nombre}` : ""}
                  </div>
                  <div>{r.descripcion}</div>
                </div>
              ))
            )}
          </>
        )}

        {tab === "asistencia" &&
          (asistencias.length === 0 ? (
            <p className="text-sm text-text-soft">Sin asistencia cargada todavía.</p>
          ) : (
            asistencias.map((a) => (
              <div key={a.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
                <span>{a.fecha}</span>
                <span className="text-text-soft">{a.estado}</span>
              </div>
            ))
          ))}

        {tab === "notas" &&
          (calificaciones.length === 0 ? (
            <p className="text-sm text-text-soft">Sin calificaciones cargadas todavía.</p>
          ) : (
            calificaciones.map((c) => (
              <div key={c.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
                <span>{c.disciplinas?.nombre ?? "—"} — {c.etapa}ª etapa</span>
                <span className="font-semibold">{c.nota ?? "—"}</span>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
