"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Disciplina = { id: string; nombre: string; orden: number };
type Curso = {
  id: string;
  turno: string;
  ciclo: string;
  enfasis: string | null;
  grado: string;
  orden: number;
  secciones: { id: string; nombre: string }[];
  disciplinas: Disciplina[];
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
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevaDisciplina, setNuevaDisciplina] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("cursos")
      .select("id, turno, ciclo, enfasis, grado, orden, secciones(id, nombre), disciplinas(id, nombre, orden)")
      .order("orden");
    const lista = (data as Curso[] | null) ?? [];
    lista.forEach((c) => c.disciplinas.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)));
    setCursos(lista);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function agregarDisciplina(cursoId: string) {
    const nombre = (nuevaDisciplina[cursoId] ?? "").trim();
    if (!nombre) return;
    setGuardando(cursoId);
    await supabase.from("disciplinas").insert({ curso_id: cursoId, nombre });
    setNuevaDisciplina((prev) => ({ ...prev, [cursoId]: "" }));
    setGuardando(null);
    cargar();
  }

  async function eliminarDisciplina(disciplinaId: string) {
    setGuardando(disciplinaId);
    await supabase.from("disciplinas").delete().eq("id", disciplinaId);
    setGuardando(null);
    cargar();
  }

  const porTurno: Record<string, Curso[]> = {};
  cursos.forEach((c) => {
    porTurno[c.turno] = porTurno[c.turno] ?? [];
    porTurno[c.turno].push(c);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Cursos, secciones y disciplinas</h1>
        <p className="text-sm text-text-soft mt-1 max-w-xl">
          Oferta académica cargada en la base de datos — alimenta los selectores de
          Inscripción, Seguimiento, Calificaciones y Alertas. Hacé clic en un curso
          para ver y editar sus disciplinas (materias).
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
                      <div key={c.id} className="bg-bg rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left"
                        >
                          <span className="font-medium">{c.grado}</span>
                          <span className="text-text-soft text-xs flex items-center gap-2">
                            {c.secciones.length > 0
                              ? `Secciones ${c.secciones.map((s) => s.nombre).sort().join(" · ")}`
                              : "Sin secciones"}
                            <span className="text-navy">
                              {c.disciplinas.length} disciplina{c.disciplinas.length === 1 ? "" : "s"}
                              {abierto === c.id ? " ▲" : " ▼"}
                            </span>
                          </span>
                        </button>

                        {abierto === c.id && (
                          <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border/60 pt-2">
                            {c.disciplinas.length === 0 && (
                              <p className="text-xs text-text-soft">Sin disciplinas cargadas todavía.</p>
                            )}
                            {c.disciplinas.map((d) => (
                              <div key={d.id} className="flex items-center justify-between text-sm bg-card rounded-md px-2.5 py-1.5">
                                <span>{d.nombre}</span>
                                <button
                                  type="button"
                                  disabled={guardando === d.id}
                                  onClick={() => eliminarDisciplina(d.id)}
                                  className="text-xs text-danger hover:underline disabled:opacity-50"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                agregarDisciplina(c.id);
                              }}
                              className="flex gap-2 mt-1"
                            >
                              <input
                                value={nuevaDisciplina[c.id] ?? ""}
                                onChange={(e) =>
                                  setNuevaDisciplina((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                placeholder="Nueva disciplina…"
                                className="h-9 flex-1 rounded-md border border-border px-2.5 text-sm bg-card"
                              />
                              <button
                                disabled={guardando === c.id}
                                className="h-9 rounded-md bg-navy text-white text-xs font-semibold px-3 disabled:opacity-50"
                              >
                                Agregar
                              </button>
                            </form>
                          </div>
                        )}
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
          Todavía no hay cursos cargados en la base de datos. Ejecutá la migración
          inicial (<code>supabase/migrations/0001_init.sql</code>) para cargar la
          estructura del PEI.
        </div>
      )}
    </div>
  );
}
