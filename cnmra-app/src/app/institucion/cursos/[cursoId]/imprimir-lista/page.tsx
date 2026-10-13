"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null };

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

export default function ImprimirListaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data: cursoData } = await supabase
      .from("cursos")
      .select("id, grado, turno, ciclo, enfasis")
      .eq("id", cursoId)
      .single();
    setCurso(cursoData ?? null);

    const { data: seccionesData } = await supabase.from("secciones").select("id").eq("curso_id", cursoId);
    const seccionIds = (seccionesData ?? []).map((s) => s.id);

    const { data: estudiantesData } = seccionIds.length
      ? await supabase
          .from("estudiantes")
          .select("id, nombre_completo, cedula")
          .in("seccion_id", seccionIds)
          .eq("estado", "activo")
          .order("nombre_completo")
      : { data: [] };
    setEstudiantes(estudiantesData ?? []);
    setCargando(false);
  }, [cursoId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

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
        <div className="mb-4">
          <div className="font-display text-xl">
            {curso?.grado}
            {curso?.enfasis ? ` — Énfasis en ${curso.enfasis}` : ""}
          </div>
          <div className="text-xs text-text-soft mt-1">
            {curso ? `${etiquetaTurno[curso.turno] ?? curso.turno} · ${curso.ciclo}` : ""}
          </div>
          <div className="text-xs text-text-soft mt-1">Lista de estudiantes — {estudiantes.length} en total</div>
        </div>

        <table className="text-sm border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 border-b border-border w-10">N°</th>
              <th className="text-left py-2 pr-3 border-b border-border">Nombre y apellido</th>
              <th className="text-left py-2 border-b border-border">Cédula</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((e, i) => (
              <tr key={e.id}>
                <td className="py-2 pr-3 border-b border-border text-text-soft">{i + 1}</td>
                <td className="py-2 pr-3 border-b border-border">{e.nombre_completo}</td>
                <td className="py-2 border-b border-border">{e.cedula ?? "—"}</td>
              </tr>
            ))}
            {estudiantes.length === 0 && (
              <tr>
                <td className="py-3 text-text-soft" colSpan={3}>
                  Sin estudiantes activos en este curso.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
