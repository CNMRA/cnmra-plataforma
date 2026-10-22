"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null };

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

export default function ListaEstudiantesImprimir({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = use(params);
  const supabase = createClient();
  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cursoData } = await supabase
        .from("cursos")
        .select("id, grado, turno, enfasis")
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
    })();
  }, [cursoId, supabase]);

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (!curso) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        No se encontró este curso.{" "}
        <Link href="/institucion/cursos" className="text-teal font-medium">
          Volver a Cursos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
          body { background: #fff; }
        }
      `}</style>

      <div className="no-imprimir flex items-center justify-between flex-wrap gap-2">
        <Link href={`/institucion/cursos/${cursoId}`} className="text-xs text-teal font-medium">
          ← Volver al curso
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5"
        >
          Imprimir / Descargar
        </button>
      </div>

      <div>
        <h1 className="font-display text-2xl">
          {curso.grado}
          {curso.enfasis ? ` — Énfasis en ${curso.enfasis}` : ""}
        </h1>
        <p className="text-sm text-text-soft mt-1">{etiquetaTurno[curso.turno] ?? curso.turno}</p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b-2 border-border">
            <th className="py-2 pr-4 font-semibold">#</th>
            <th className="py-2 pr-4 font-semibold">Nombre y apellido</th>
            <th className="py-2 font-semibold">Cédula</th>
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((e, i) => (
            <tr key={e.id} className="border-b border-border">
              <td className="py-2 pr-4 text-text-soft">{i + 1}</td>
              <td className="py-2 pr-4">{e.nombre_completo}</td>
              <td className="py-2">{e.cedula ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {estudiantes.length === 0 && (
        <p className="text-sm text-text-soft">Todavía no hay estudiantes activos cargados en este curso.</p>
      )}
    </div>
  );
}
