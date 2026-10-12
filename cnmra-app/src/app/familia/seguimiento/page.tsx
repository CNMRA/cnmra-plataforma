"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type Instancia,
  type NotasPorInstancia,
  ETIQUETA_INSTANCIA,
  evaluarMateria,
} from "@/lib/calificaciones";

type Estudiante = {
  id: string;
  nombre_completo: string;
  secciones: { cursos: { grado: string } | null } | null;
};
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
  instancia: Instancia;
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
      const { data } = await supabase
        .from("estudiantes")
        .select("id, nombre_completo, secciones(cursos(grado))")
        .eq("familia_id", familia.id);
      setEstudiantes((data as unknown as Estudiante[]) ?? []);
      if (data && data.length > 0) setEstudianteId(data[0].id);
    })();
  }, [supabase]);

  const gradoActual = useMemo(() => {
    const est = estudiantes.find((e) => e.id === estudianteId);
    return est?.secciones?.cursos?.grado ?? null;
  }, [estudiantes, estudianteId]);

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
        .select("id, instancia, nota, disciplina_id, disciplinas(nombre)")
        .eq("estudiante_id", estudianteId),
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

  const notasPorDisciplina = useMemo(() => {
    const mapa = new Map<string, { nombre: string; notas: NotasPorInstancia }>();
    calificaciones.forEach((c) => {
      if (!c.disciplina_id || c.nota === null) return;
      const actual = mapa.get(c.disciplina_id) ?? { nombre: c.disciplinas?.nombre ?? "—", notas: {} };
      actual.notas[c.instancia] = c.nota;
      mapa.set(c.disciplina_id, actual);
    });
    return mapa;
  }, [calificaciones]);

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
          (notasPorDisciplina.size === 0 ? (
            <p className="text-sm text-text-soft">Sin calificaciones cargadas todavía.</p>
          ) : (
            Array.from(notasPorDisciplina.entries()).map(([id, { nombre, notas }]) => {
              const r = evaluarMateria(notas, gradoActual);
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-border last:border-none text-sm">
                  <span>{nombre}</span>
                  {r && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.aprobado ? "bg-[#E7F3EB] text-success" : "bg-[#FBEAE8] text-danger"}`}>
                      {r.notaFinal} · {ETIQUETA_INSTANCIA[r.instanciaFinal]} {r.aprobado ? "· Aprobada" : "· No aprobada"}
                    </span>
                  )}
                </div>
              );
            })
          ))}
      </div>
    </div>
  );
}
