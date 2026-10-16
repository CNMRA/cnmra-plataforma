"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type Instancia,
  type NotasPorInstancia,
  evaluarMateria,
} from "@/lib/calificaciones";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = {
  id: string;
  nombre_completo: string;
  secciones: { cursos: Curso | null } | null;
};
type Disciplina = { id: string; nombre: string; orden: number; plan: string };
type CalifRow = { disciplina_id: string; instancia: Instancia; nota: number | null };

const etiquetaPlan: Record<string, string> = {
  comun: "Plan Común",
  especifico: "Plan Específico",
  optativo: "Plan Optativo",
};

export default function NotasFamilia() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [califs, setCalifs] = useState<CalifRow[]>([]);

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
        .select("id, nombre_completo, secciones(cursos(id, grado, turno, ciclo, enfasis))")
        .eq("familia_id", familia.id);
      setEstudiantes((data as unknown as Estudiante[]) ?? []);
      if (data && data.length > 0) setEstudianteId(data[0].id);
    })();
  }, [supabase]);

  const estudianteActual = useMemo(() => estudiantes.find((e) => e.id === estudianteId) ?? null, [estudiantes, estudianteId]);
  const curso = estudianteActual?.secciones?.cursos ?? null;

  const cargar = useCallback(async () => {
    if (!estudianteId) return;
    const { data: califsData } = await supabase
      .from("calificaciones")
      .select("disciplina_id, instancia, nota")
      .eq("estudiante_id", estudianteId);
    setCalifs((califsData as unknown as CalifRow[]) ?? []);

    if (curso) {
      const { data: disciplinasData } = await supabase
        .from("disciplinas")
        .select("id, nombre, orden, plan")
        .eq("curso_id", curso.id)
        .order("plan")
        .order("orden");
      setDisciplinas(disciplinasData ?? []);
    } else {
      setDisciplinas([]);
    }
  }, [estudianteId, curso, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  const notasPorDisciplina = useMemo(() => {
    const mapa = new Map<string, NotasPorInstancia>();
    califs.forEach((c) => {
      if (c.nota === null) return;
      const actual = mapa.get(c.disciplina_id) ?? {};
      actual[c.instancia] = c.nota;
      mapa.set(c.disciplina_id, actual);
    });
    return mapa;
  }, [califs]);

  const filas = useMemo(() => {
    return disciplinas.map((d) => {
      const notas = notasPorDisciplina.get(d.id) ?? {};
      const resultado = curso ? evaluarMateria(notas, curso.grado) : null;
      return { disciplina: d, notas, resultado };
    });
  }, [disciplinas, notasPorDisciplina, curso]);

  const esEEB = curso?.ciclo === "Tercer Ciclo EEB";

  const totalPuntos = filas.reduce((suma, f) => suma + (f.notas.ordinaria ?? 0), 0);
  const cantidadConNota = filas.filter((f) => f.notas.ordinaria !== undefined).length;
  const terminoMedio = cantidadConNota > 0 ? (totalPuntos / cantidadConNota).toFixed(1) : null;
  const todasCargadas = filas.length > 0 && filas.every((f) => f.resultado !== null);
  const todasAprobadas = todasCargadas && filas.every((f) => f.resultado?.aprobado);

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

      <div className="bg-card border border-border rounded-xl p-5 overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-[560px]">
          <thead>
            <tr>
              {!esEEB && <th className="text-left py-1.5 pr-2 border-b border-border font-medium">Plan</th>}
              <th className="text-left py-1.5 pr-2 border-b border-border font-medium">{esEEB ? "Áreas" : "Disciplinas"}</th>
              <th className="text-center py-1.5 px-2 border-b border-border font-medium">1ª Etapa</th>
              <th className="text-center py-1.5 px-2 border-b border-border font-medium">2ª Etapa</th>
              <th className="text-center py-1.5 px-2 border-b border-border font-medium">Calificación Final</th>
              <th className="text-center py-1.5 px-2 border-b border-border font-medium">Complementario</th>
              <th className="text-center py-1.5 px-2 border-b border-border font-medium">Regularización</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ disciplina, notas }) => (
              <tr key={disciplina.id}>
                {!esEEB && (
                  <td className="py-1.5 pr-2 border-b border-border text-text-soft">{etiquetaPlan[disciplina.plan] ?? disciplina.plan}</td>
                )}
                <td className="py-1.5 pr-2 border-b border-border">{disciplina.nombre}</td>
                <td className="text-center py-1.5 px-2 border-b border-border">{notas.etapa1 ?? ""}</td>
                <td className="text-center py-1.5 px-2 border-b border-border">{notas.etapa2 ?? ""}</td>
                <td className="text-center py-1.5 px-2 border-b border-border font-semibold">{notas.ordinaria ?? ""}</td>
                <td className="text-center py-1.5 px-2 border-b border-border">{notas.complementario ?? ""}</td>
                <td className="text-center py-1.5 px-2 border-b border-border">{notas.regularizacion ?? ""}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td className="py-3 text-text-soft" colSpan={esEEB ? 6 : 7}>
                  Todavía no hay materias cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-border pt-3">
          <div>
            <span className="text-text-soft">Total de puntos: </span>
            <span className="font-semibold">{cantidadConNota > 0 ? totalPuntos : "—"}</span>
          </div>
          <div>
            <span className="text-text-soft">Término medio general: </span>
            <span className="font-semibold">{terminoMedio ?? "—"}</span>
          </div>
          <div>
            <span className="text-text-soft">Promovido/a: </span>
            <span className="font-semibold">{todasCargadas ? (todasAprobadas ? "SÍ" : "NO") : "Pendiente"}</span>
          </div>
        </div>

        {!esEEB && filas.some((f) => f.resultado && !f.resultado.aprobado) && (
          <div className="mt-3 text-xs">
            <span className="font-semibold">Área(s) y/o disciplina(s) a regularizar: </span>
            {filas
              .filter((f) => f.resultado && !f.resultado.aprobado)
              .map((f) => f.disciplina.nombre)
              .join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
