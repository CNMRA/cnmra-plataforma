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
  estudiantes: { nombre_completo: string; cedula: string | null } | null;
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
  const [todos, setTodos] = useState<MatriculadoFila[]>([]);
  const [soloCurso, setSoloCurso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const matriculados = todos.filter((m) => m.estado === "aprobada");

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
        .select("id, estado, curso_solicitado_id, estudiantes(nombre_completo, cedula), secciones:seccion_asignada_id(nombre)")
        .eq("anio_lectivo", anio)
        .in("estado", ["aprobada", "pendiente"]);
      setTodos((inscripcionesData as unknown as MatriculadoFila[]) ?? []);
    } else {
      setTodos([]);
    }

    setCargando(false);
  }, [supabase, anio]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  useEffect(() => {
    const alTerminar = () => setSoloCurso(null);
    window.addEventListener("afterprint", alTerminar);
    return () => window.removeEventListener("afterprint", alTerminar);
  }, []);

  function imprimir(cursoId: string | null) {
    setSoloCurso(cursoId);
    setTimeout(() => window.print(), 150);
  }

  const porTurno: Record<string, Curso[]> = {};
  cursos.forEach((c) => {
    porTurno[c.turno] = porTurno[c.turno] ?? [];
    porTurno[c.turno].push(c);
  });

  const esAnioActivo = anio === ANIO_LECTIVO_ACTIVO;

  const nombreCurso = (c: Curso) =>
    `${c.grado}${c.enfasis ? ` — ${c.enfasis}` : ""} — ${etiquetaTurno[c.turno] ?? c.turno}`;
  const ordenar = (a: MatriculadoFila, b: MatriculadoFila) =>
    (a.estudiantes?.nombre_completo ?? "").localeCompare(b.estudiantes?.nombre_completo ?? "", "es");
  const idsCursos = new Set(cursos.map((c) => c.id));
  const bloquesImpresion = cursos
    .filter((c) => (soloCurso ? c.id === soloCurso : true))
    .map((c) => ({ titulo: nombreCurso(c), filas: todos.filter((m) => m.curso_solicitado_id === c.id).sort(ordenar) }))
    .filter((b) => (soloCurso ? true : b.filas.length > 0));
  const sinCurso = soloCurso
    ? []
    : todos.filter((m) => !m.curso_solicitado_id || !idsCursos.has(m.curso_solicitado_id)).sort(ordenar);
  if (sinCurso.length > 0) bloquesImpresion.push({ titulo: "Sin curso indicado", filas: sinCurso });
  const totalImpresion = bloquesImpresion.reduce((suma, b) => suma + b.filas.length, 0);
  const totalMatriculados = bloquesImpresion.reduce((suma, b) => suma + b.filas.filter((f) => f.estado === "aprobada").length, 0);
  const ahora = new Date().toLocaleString("es-PY", { timeZone: "America/Asuncion", dateStyle: "short", timeStyle: "short" });
  const celdaImp = { border: "1px solid #444", padding: "3px 6px", fontSize: "11px", textAlign: "left" as const };

  return (
    <>
    <div className="flex flex-col gap-6 print:hidden">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="font-display text-2xl">Cursos</h1>
        <span className="text-xs font-bold text-white bg-navy px-2.5 py-1 rounded-full">Año {anio}</span>
        {!esAnioActivo && (
          <button
            type="button"
            onClick={() => imprimir(null)}
            disabled={cargando || todos.length === 0}
            className="ml-auto h-9 rounded-lg bg-navy text-white font-semibold text-xs px-4 disabled:opacity-50"
          >
            🖨️ Imprimir lista de inscriptos
          </button>
        )}
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
                            <span className="flex items-center gap-2">
                              <span className="text-text-soft text-xs">
                                {delCurso.length === 0 ? "Sin matriculados todavía" : `${delCurso.length} matriculado(s)`}
                              </span>
                              <button
                                type="button"
                                title="Imprimir la lista de este curso"
                                onClick={() => imprimir(c.id)}
                                className="flex-none w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-soft hover:text-navy hover:border-navy bg-card"
                              >
                                🖨️
                              </button>
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

    <div className="hidden print:block" style={{ fontFamily: "Arial, sans-serif", color: "#000" }}>
      <div style={{ fontSize: "15px", fontWeight: 700 }}>Colegio Nacional Mariano Roque Alonso</div>
      <div style={{ fontSize: "13px", marginBottom: "2px" }}>
        Lista de inscriptos {anio}
        {soloCurso && bloquesImpresion[0] ? ` — ${bloquesImpresion[0].titulo}` : ""}
      </div>
      <div style={{ fontSize: "10px", marginBottom: "10px", color: "#444" }}>
        Al {ahora} · {totalImpresion} inscripto(s): {totalMatriculados} matriculado(s) y {totalImpresion - totalMatriculados} pendiente(s)
      </div>
      {bloquesImpresion.map((b) => (
        <div key={b.titulo} style={{ marginBottom: "14px", breakInside: "avoid" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "3px" }}>
            {b.titulo} ({b.filas.length})
          </div>
          {b.filas.length === 0 ? (
            <div style={{ fontSize: "11px", color: "#555" }}>Sin inscriptos todavía.</div>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...celdaImp, width: "28px" }}>N°</th>
                  <th style={celdaImp}>Apellido y nombre</th>
                  <th style={{ ...celdaImp, width: "90px" }}>Cédula</th>
                  <th style={{ ...celdaImp, width: "80px" }}>Sección</th>
                  <th style={{ ...celdaImp, width: "90px" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {b.filas.map((f, i) => (
                  <tr key={f.id}>
                    <td style={celdaImp}>{i + 1}</td>
                    <td style={celdaImp}>{f.estudiantes?.nombre_completo ?? "—"}</td>
                    <td style={celdaImp}>{f.estudiantes?.cedula ?? "—"}</td>
                    <td style={celdaImp}>{f.secciones?.nombre ?? "sin sección"}</td>
                    <td style={celdaImp}>{f.estado === "aprobada" ? "Matriculado" : "Pendiente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
    </>
  );
}
