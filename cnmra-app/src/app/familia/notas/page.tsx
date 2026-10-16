"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
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
type Calificacion = {
  id: string;
  instancia: Instancia;
  nota: number | null;
  disciplina_id: string | null;
  disciplinas: { nombre: string } | null;
};

const ORDEN_INSTANCIAS: Instancia[] = ["etapa1", "etapa2", "ordinaria", "complementario", "regularizacion"];

export default function NotasFamilia() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);

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
    const { data } = await supabase
      .from("calificaciones")
      .select("id, instancia, nota, disciplina_id, disciplinas(nombre)")
      .eq("estudiante_id", estudianteId);
    setCalificaciones((data as unknown as Calificacion[]) ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Notas</h1>
        {estudianteId && (
          <Link
            href={`/familia/notas/${estudianteId}/imprimir`}
            className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 flex items-center"
          >
            Descargar / Imprimir
          </Link>
        )}
      </div>

      {estudiantes.length > 1 && (
        <select
          value={estudianteId}
          onChange={(e) => setEstudianteId(e.target.value)}
          className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs"
        >
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_completo}
            </option>
          ))}
        </select>
      )}

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
        {notasPorDisciplina.size === 0 ? (
          <p className="text-sm text-text-soft">Sin calificaciones cargadas todavía.</p>
        ) : (
          Array.from(notasPorDisciplina.entries()).map(([id, { nombre, notas }]) => {
            const r = evaluarMateria(notas, gradoActual);
            return (
              <div key={id} className="flex flex-col gap-2 py-3 border-b border-border last:border-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{nombre}</span>
                  {r ? (
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        r.aprobado ? "bg-[#E7F3EB] text-success" : "bg-[#FBEAE8] text-danger"
                      }`}
                    >
                      {r.notaFinal} · {ETIQUETA_INSTANCIA[r.instanciaFinal]} {r.aprobado ? "· Aprobada" : "· No aprobada"}
                    </span>
                  ) : (
                    <span className="text-xs text-text-soft">Evaluación en curso</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-text-soft">
                  {ORDEN_INSTANCIAS.filter((inst) => notas[inst] !== undefined).map((inst) => (
                    <span key={inst}>
                      {ETIQUETA_INSTANCIA[inst]}: <strong className="text-text">{notas[inst]}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
