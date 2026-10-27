"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";
import { ANIO_LECTIVO_ACTIVO } from "@/lib/anio-lectivo";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string };
type Registro = {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  disciplinas: { nombre: string } | null;
};

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

const etiquetaCategoria: Record<string, string> = {
  positivo: "Positivo",
  atencion: "A tener en cuenta",
  conducta: "Conducta",
};

export default function InformeAnecdoticoPage({ params }: { params: Promise<{ cursoId: string; estudianteId: string }> }) {
  const { cursoId, estudianteId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
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
      .select("id, nombre_completo")
      .eq("id", estudianteId)
      .single();
    setEstudiante(estudianteData ?? null);

    const { data: registrosData } = await supabase
      .from("registros_anecdoticos")
      .select("id, fecha, categoria, descripcion, disciplinas(nombre)")
      .eq("estudiante_id", estudianteId)
      .order("fecha", { ascending: false });
    setRegistros((registrosData as unknown as Registro[]) ?? []);
    setCargando(false);
  }, [cursoId, estudianteId, supabase]);

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
        <EncabezadoDocumento
          titulo="REGISTRO ANECDÓTICO"
          datos={[
            { label: "Año lectivo", value: String(ANIO_LECTIVO_ACTIVO) },
            { label: "Estudiante", value: estudiante?.nombre_completo ?? "" },
            { label: "Curso/Grado", value: curso?.grado ?? "" },
            { label: "Turno", value: curso ? etiquetaTurno[curso.turno] ?? curso.turno : "" },
            { label: "Énfasis", value: curso?.enfasis ?? "—" },
          ]}
        />

        <div className="flex flex-col gap-3">
          {registros.map((r) => (
            <div key={r.id} className="border-b border-border pb-2.5">
              <div className="text-xs text-text-soft">
                {r.fecha} · {etiquetaCategoria[r.categoria] ?? r.categoria}
                {r.disciplinas?.nombre ? ` · ${r.disciplinas.nombre}` : " · General"}
              </div>
              <div className="text-sm mt-0.5">{r.descripcion}</div>
            </div>
          ))}
          {registros.length === 0 && <p className="text-sm text-text-soft">Sin registros cargados todavía.</p>}
        </div>
      </div>
    </div>
  );
}
