"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAnioLectivo, ANIO_LECTIVO_ACTIVO } from "@/lib/anio-lectivo";

type Curso = {
  id: string;
  turno: string;
  ciclo: string;
  enfasis: string | null;
  grado: string;
  orden: number;
  secciones: { id: string; nombre: string }[];
};

type MatriculadoFila = {
  id: string;
  estado: string;
  curso_solicitado_id: string | null;
  estudiantes: { nombre_completo: string } | null;
  secciones: { nombre: string } | null;
};

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

export default function CursosPage() {
  const supabase = createClient();
  const { anio } = useAnioLectivo();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [matriculados, setMatriculados] = useState<MatriculadoFila[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from("cursos")
      .select("id, turno, ciclo, enfasis, grado, orden, secciones(id, nombre)")
      .order("orden");
    setCursos((data as Curso[] | null) ?? []);

    if (anio !== ANIO_LECTIVO_ACTIVO) {
      const { data: inscripcionesData } = await supabase
        .from("inscripciones")
        .select("id, estado, curso_solicitado_id, estudiantes(nombre_completo), secciones:seccion_asignada_id(nombre)")
        .eq("anio_lectivo", anio)
        .eq("estado", "aprobada");
      setMatriculados((inscripcionesData as unknown as MatriculadoFila[]) ?? []);
    } else {
      setMatriculados([]);
    }

    setCargando(false);
  }, [supabase, anio]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  const porTurno: Record<string, Curso[]> = {};
  cursos.forEach((c) => {
    porTurno[c.turno] = porTurno[c.turno] ?? [];
    porTurno[c.turno].push(c);
  });

  const esAnioActivo = anio === ANIO_LECTIVO_ACTIVO;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="font-display text-2xl">Cursos</h1>
        <span className="text-xs font-bold text-white bg-navy px-2.5 py-1 rounded-full">Año {anio}</span>
      </div>

      {esAnioActivo ? (
        <p className="text-sm text-text-soft max-w-xl">
          Elegí un curso para cargar asistencia, registro anecdótico o calificaciones. Tocá el ícono de impresora para bajar la lista del curso.
        </p>
      ) : (
        <div className="bg-[#EAF0FF] border border-[#C9D8FF] rounded-lg p-3.5 text-[13px] text-navy leading-relaxed max-w-xl">
          Estos son los cursos con los estudiantes ya matriculados para <strong>{anio}</strong>. Todavía no se puede
          cargar asistencia ni notas acá — eso se habilita recién con el pase de año oficial.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {Object.entries(porTurno).map(([turno, lista]) => {
          const porCiclo: Record<string, Curso[]> = {};
          lista.forEach((c) => {
            const clave = c.enfasis ? `${c.ciclo} — Énfasis en ${c.enfasis}` : c.ciclo;
            porCiclo[clave] = porCiclo[clave] ?? [];
            porCiclo[clave].push(c);
          });

          return (
            <div key={turno} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="text-[11px] font-bold tracking-wide text-navy bg-[#E7EAFB] inline-flex w-fit px-2.5 py-1 rounded-full uppercase">
                {etiquetaTurno[turno] ?? turno}
              </div>
              {Object.entries(porCiclo).map(([ciclo, cursosCiclo]) => (
                <div key={ciclo}>
                  <div className="text-[12.5px] font-semibold mb-2">{ciclo}</div>
                  <div className="flex flex-col gap-1.5">
                    {cursosCiclo.map((c) => {
                      if (esAnioActivo) {
                        return (
                          <div
                            key={c.id}
                            className="bg-bg rounded-lg px-3 py-2.5 text-sm flex items-center justify-between gap-2 hover:bg-[#ECEAE1]"
                          >
                            <Link
                              href={`/institucion/cursos/${c.id}`}
                              className="flex-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                            >
                              <span className="font-medium">{c.grado}</span>
                              <span className="text-text-soft text-xs">
                                {c.secciones.length > 0
                                  ? `Secciones ${c.secciones.map((s) => s.nombre).sort().join(" · ")}`
                                  : "Sin secciones"}
                              </span>
                            </Link>
                            <Link
                              href={`/institucion/cursos/${c.id}/imprimir-lista`}
                              title="Imprimir lista del curso"
                              className="flex-none w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-soft hover:text-navy hover:border-navy bg-card"
                            >
                              🖨️
                            </Link>
                          </div>
                        );
                      }

                      const delCurso = matriculados.filter((m) => m.curso_solicitado_id === c.id);
                      return (
                        <div key={c.id} className="bg-bg rounded-lg px-3 py-2.5 text-sm flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{c.grado}</span>
                            <span className="text-text-soft text-xs">
                              {delCurso.length === 0 ? "Sin matriculados todavía" : `${delCurso.length} matriculado(s)`}
                            </span>
                          </div>
                          {delCurso.length > 0 && (
                            <div className="flex flex-col gap-0.5 pl-0.5">
                              {delCurso.map((m) => (
                                <div key={m.id} className="text-xs text-text-soft flex items-center justify-between gap-2">
                                  <span>{m.estudiantes?.nombre_completo ?? "—"}</span>
                                  <span>{m.secciones?.nombre ? `Sección ${m.secciones.nombre}` : "sin sección"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!cargando && cursos.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          Todavía no hay cursos cargados en la base de datos.
        </div>
      )}
    </div>
  );
}
