"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Curso = {
  id: string;
  turno: string;
  ciclo: string;
  enfasis: string | null;
  grado: string;
  orden: number;
  secciones: { id: string; nombre: string }[];
};

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

export default function CursosPage() {
  const supabase = createClient();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("cursos")
      .select("id, turno, ciclo, enfasis, grado, orden, secciones(id, nombre)")
      .order("orden");
    setCursos((data as Curso[] | null) ?? []);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  const porTurno: Record<string, Curso[]> = {};
  cursos.forEach((c) => {
    porTurno[c.turno] = porTurno[c.turno] ?? [];
    porTurno[c.turno].push(c);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Cursos</h1>
        <p className="text-sm text-text-soft mt-1 max-w-xl">
          Elegí un curso para cargar asistencia, registro anecdótico o calificaciones. Tocá el ícono de impresora para bajar la lista del curso.
        </p>
      </div>

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
                    {cursosCiclo.map((c) => (
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
                    ))}
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
