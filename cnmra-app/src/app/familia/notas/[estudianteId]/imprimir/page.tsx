"use client";

import { use, useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";
import {
  type Instancia,
  type NotasPorInstancia,
  ETIQUETA_INSTANCIA,
  evaluarMateria,
} from "@/lib/calificaciones";

type Curso = { grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = {
  id: string;
  nombre_completo: string;
  secciones: { cursos: Curso | null } | null;
};
type Calificacion = {
  id: string;
  instancia: Instancia;
  nota: number | null;
  disciplina_id: string | null;
  disciplinas: { nombre: string } | null;
};

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

const ORDEN_INSTANCIAS: Instancia[] = ["etapa1", "etapa2", "ordinaria", "complementario", "regularizacion"];

export default function ImprimirNotasFamilia({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = use(params);
  const supabase = createClient();

  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data: estudianteData } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, secciones(cursos(grado, turno, ciclo, enfasis))")
      .eq("id", estudianteId)
      .single();
    setEstudiante((estudianteData as unknown as Estudiante) ?? null);

    const { data: califData } = await supabase
      .from("calificaciones")
      .select("id, instancia, nota, disciplina_id, disciplinas(nombre)")
      .eq("estudiante_id", estudianteId);
    setCalificaciones((califData as unknown as Calificacion[]) ?? []);
    setCargando(false);
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

  const curso = estudiante?.secciones?.cursos ?? null;

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href="/familia/notas" className="text-xs text-teal font-medium">
          ← Volver a notas
        </Link>
        <button onClick={() => window.print()} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5">
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <EncabezadoDocumento
          titulo="CALIFICACIONES"
          datos={[
            { label: "Estudiante", value: estudiante?.nombre_completo ?? "" },
            { label: "Curso/Grado", value: curso?.grado ?? "" },
            { label: "Turno", value: curso ? etiquetaTurno[curso.turno] ?? curso.turno : "" },
            { label: "Énfasis", value: curso?.enfasis ?? "—" },
          ]}
        />

        <div className="flex flex-col gap-3">
          {Array.from(notasPorDisciplina.entries()).map(([id, { nombre, notas }]) => {
            const r = evaluarMateria(notas, curso?.grado ?? null);
            return (
              <div key={id} className="border-b border-border pb-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{nombre}</span>
                  {r && (
                    <span className={`text-xs font-semibold ${r.aprobado ? "text-success" : "text-danger"}`}>
                      {r.notaFinal} ({ETIQUETA_INSTANCIA[r.instanciaFinal]}) {r.aprobado ? "— Aprobada" : "— No aprobada"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-text-soft mt-0.5">
                  {ORDEN_INSTANCIAS.filter((inst) => notas[inst] !== undefined).map((inst) => (
                    <span key={inst}>
                      {ETIQUETA_INSTANCIA[inst]}: {notas[inst]}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {notasPorDisciplina.size === 0 && <p className="text-sm text-text-soft">Sin calificaciones cargadas todavía.</p>}
        </div>
      </div>
    </div>
  );
}
