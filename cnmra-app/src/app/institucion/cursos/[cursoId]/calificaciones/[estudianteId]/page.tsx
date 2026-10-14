"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type Instancia,
  type NotasPorInstancia,
  ETIQUETA_INSTANCIA,
  evaluarMateria,
} from "@/lib/calificaciones";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null };
type Disciplina = { id: string; nombre: string; orden: number; plan: string };
type CalifRow = { disciplina_id: string; instancia: Instancia; nota: number | null };

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

const etiquetaPlan: Record<string, string> = {
  comun: "Plan Común",
  especifico: "Plan Específico",
  optativo: "Plan Optativo",
};

export default function LibretaCalificacionesPage({ params }: { params: Promise<{ cursoId: string; estudianteId: string }> }) {
  const { cursoId, estudianteId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [califs, setCalifs] = useState<CalifRow[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data: cursoData } = await supabase
      .from("cursos")
      .select("id, grado, turno, ciclo, enfasis")
      .eq("id", cursoId)
      .single();
    setCurso(cursoData ?? null);

    const { data: estudianteData } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula")
      .eq("id", estudianteId)
      .single();
    setEstudiante(estudianteData ?? null);

    const { data: disciplinasData } = await supabase
      .from("disciplinas")
      .select("id, nombre, orden, plan")
      .eq("curso_id", cursoId)
      .order("plan")
      .order("orden");
    setDisciplinas(disciplinasData ?? []);

    const { data: califsData } = await supabase
      .from("calificaciones")
      .select("disciplina_id, instancia, nota")
      .eq("estudiante_id", estudianteId);
    setCalifs((califsData as unknown as CalifRow[]) ?? []);

    setCargando(false);
  }, [cursoId, estudianteId, supabase]);

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

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/institucion/cursos/${cursoId}`} className="text-xs text-teal font-medium">
          ← Volver al curso
        </Link>
        <button onClick={() => window.print()} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5">
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <EncabezadoDocumento
          titulo={esEEB ? "BOLETÍN DE CALIFICACIONES" : "BOLETÍN DE CALIFICACIONES DE BACHILLERATO CIENTÍFICO"}
          datos={[
            { label: "Estudiante", value: estudiante?.nombre_completo ?? "" },
            { label: "Cédula", value: estudiante?.cedula ?? "—" },
            { label: "Curso/Grado", value: curso?.grado ?? "" },
            { label: "Turno", value: curso ? etiquetaTurno[curso.turno] ?? curso.turno : "" },
            { label: "Ciclo", value: curso?.ciclo ?? "" },
            { label: "Énfasis", value: curso?.enfasis ?? "—" },
          ]}
        />

        <table className="text-xs border-collapse w-full">
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
                {!esEEB && <td className="py-1.5 pr-2 border-b border-border text-text-soft">{etiquetaPlan[disciplina.plan] ?? disciplina.plan}</td>}
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
                  Este curso todavía no tiene materias cargadas.
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

        <div className="mt-10 grid grid-cols-3 gap-6 text-xs text-center">
          <div className="border-t border-border pt-1.5">Firma de Secretario/a</div>
          <div className="border-t border-border pt-1.5">Firma del Padre/Madre</div>
          <div className="border-t border-border pt-1.5">Firma del Director/a</div>
        </div>
      </div>
    </div>
  );
}
