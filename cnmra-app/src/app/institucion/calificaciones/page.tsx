"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type Instancia,
  type NotasPorInstancia,
  ETIQUETA_INSTANCIA,
  calcularOrdinaria,
  evaluarMateria,
  tieneRegularizacion,
  aprueba,
} from "@/lib/calificaciones";

type Estudiante = {
  id: string;
  nombre_completo: string;
  secciones: { curso_id: string; cursos: { grado: string } | null } | null;
};
type Disciplina = { id: string; nombre: string };
type CalifRow = { id: string; disciplina_id: string; instancia: Instancia; nota: number | null };

export default function CalificacionesInstitucional() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [califs, setCalifs] = useState<CalifRow[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [etapa1, setEtapa1] = useState("");
  const [etapa2, setEtapa2] = useState("");
  const [complementario, setComplementario] = useState("");
  const [regularizacion, setRegularizacion] = useState("");

  useEffect(() => {
    supabase
      .from("estudiantes")
      .select("id, nombre_completo, secciones(curso_id, cursos(grado))")
      .order("nombre_completo")
      .then(({ data }) => setEstudiantes((data as unknown as Estudiante[]) ?? []));
  }, [supabase]);

  const cursoIdActual = useMemo(() => {
    const est = estudiantes.find((e) => e.id === estudianteId);
    return est?.secciones?.curso_id ?? null;
  }, [estudiantes, estudianteId]);

  const gradoActual = useMemo(() => {
    const est = estudiantes.find((e) => e.id === estudianteId);
    return est?.secciones?.cursos?.grado ?? null;
  }, [estudiantes, estudianteId]);

  useEffect(() => {
    if (!cursoIdActual) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar selector al cambiar de estudiante
      setDisciplinas([]);
      return;
    }
    supabase
      .from("disciplinas")
      .select("id, nombre")
      .eq("curso_id", cursoIdActual)
      .order("orden")
      .then(({ data }) => {
        setDisciplinas(data ?? []);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- preseleccionar la primera disciplina del curso
        setDisciplinaId((data ?? [])[0]?.id ?? "");
      });
  }, [cursoIdActual, supabase]);

  const cargarCalificaciones = useCallback(async () => {
    if (!estudianteId) return;
    const { data } = await supabase
      .from("calificaciones")
      .select("id, disciplina_id, instancia, nota")
      .eq("estudiante_id", estudianteId);
    setCalifs((data as unknown as CalifRow[]) ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargarCalificaciones();
  }, [cargarCalificaciones]);

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

  const notasDisciplinaActual = useMemo(
    () => notasPorDisciplina.get(disciplinaId) ?? {},
    [notasPorDisciplina, disciplinaId]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precargar los campos con lo ya guardado al cambiar de disciplina
    setEtapa1(notasDisciplinaActual.etapa1?.toString() ?? "");
    setEtapa2(notasDisciplinaActual.etapa2?.toString() ?? "");
    setComplementario(notasDisciplinaActual.complementario?.toString() ?? "");
    setRegularizacion(notasDisciplinaActual.regularizacion?.toString() ?? "");
  }, [notasDisciplinaActual]);

  const resultadoActual = evaluarMateria(notasDisciplinaActual, gradoActual);

  async function guardarEtapas(e: React.FormEvent) {
    e.preventDefault();
    if (!estudianteId || !disciplinaId) return;
    const e1 = etapa1 ? Number(etapa1) : null;
    const e2 = etapa2 ? Number(etapa2) : null;
    if (e1 === null && e2 === null) return;

    setGuardando(true);
    const filas: { estudiante_id: string; disciplina_id: string; instancia: Instancia; nota: number }[] = [];
    if (e1 !== null) filas.push({ estudiante_id: estudianteId, disciplina_id: disciplinaId, instancia: "etapa1", nota: e1 });
    if (e2 !== null) filas.push({ estudiante_id: estudianteId, disciplina_id: disciplinaId, instancia: "etapa2", nota: e2 });
    if (e1 !== null && e2 !== null) {
      filas.push({
        estudiante_id: estudianteId,
        disciplina_id: disciplinaId,
        instancia: "ordinaria",
        nota: calcularOrdinaria(e1, e2),
      });
    }
    await supabase.from("calificaciones").upsert(filas, { onConflict: "estudiante_id,disciplina_id,instancia" });
    setGuardando(false);
    cargarCalificaciones();
  }

  async function guardarInstanciaUnica(instancia: "complementario" | "regularizacion", valor: string) {
    if (!estudianteId || !disciplinaId || !valor) return;
    setGuardando(true);
    await supabase.from("calificaciones").upsert(
      { estudiante_id: estudianteId, disciplina_id: disciplinaId, instancia, nota: Number(valor) },
      { onConflict: "estudiante_id,disciplina_id,instancia" }
    );
    setGuardando(false);
    cargarCalificaciones();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Calificaciones</h1>
        <p className="text-sm text-text-soft mt-1">
          Cargá las notas de Etapa 1 y Etapa 2 de cada disciplina. El sistema calcula
          la ordinaria automáticamente y habilita Complementario / Regularización
          solo cuando corresponde.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium max-w-sm">
        Estudiante
        <select
          value={estudianteId}
          onChange={(e) => setEstudianteId(e.target.value)}
          className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
        >
          <option value="">Seleccionar estudiante…</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_completo}
            </option>
          ))}
        </select>
      </label>

      {estudianteId && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          {disciplinas.length === 0 ? (
            <p className="text-sm text-text-soft">
              Este estudiante todavía no tiene un curso con disciplinas cargadas. Cargá las
              disciplinas desde la pantalla de Cursos primero.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:max-w-sm">
                Disciplina
                <select
                  value={disciplinaId}
                  onChange={(e) => setDisciplinaId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card"
                >
                  {disciplinas.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </label>

              {disciplinaId && (
                <div className="flex flex-col gap-4 border-t border-border pt-4">
                  <form onSubmit={guardarEtapas} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
                      Etapa 1
                      <input
                        type="number" min={1} max={5} step={1}
                        value={etapa1}
                        onChange={(e) => setEtapa1(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
                      Etapa 2
                      <input
                        type="number" min={1} max={5} step={1}
                        value={etapa2}
                        onChange={(e) => setEtapa2(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card"
                      />
                    </label>
                    <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full sm:w-auto">
                      {guardando ? "Guardando…" : "Guardar etapas"}
                    </button>
                  </form>

                  {notasDisciplinaActual.ordinaria !== undefined && (
                    <div className="text-sm">
                      Ordinaria: <span className="font-semibold">{notasDisciplinaActual.ordinaria}</span>{" "}
                      <span className={aprueba(notasDisciplinaActual.ordinaria) ? "text-success" : "text-danger"}>
                        {aprueba(notasDisciplinaActual.ordinaria) ? "— Aprobada" : "— No aprobada"}
                      </span>
                    </div>
                  )}

                  {notasDisciplinaActual.ordinaria !== undefined && !aprueba(notasDisciplinaActual.ordinaria) && (
                    <div className="bg-bg rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
                        Complementario
                        <input
                          type="number" min={1} max={5} step={1}
                          value={complementario}
                          onChange={(e) => setComplementario(e.target.value)}
                          className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => guardarInstanciaUnica("complementario", complementario)}
                        className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full sm:w-auto"
                      >
                        Guardar complementario
                      </button>
                    </div>
                  )}

                  {notasDisciplinaActual.complementario !== undefined &&
                    !aprueba(notasDisciplinaActual.complementario) &&
                    tieneRegularizacion(gradoActual) && (
                      <div className="bg-bg rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="flex flex-col gap-1.5 text-[13px] font-medium w-full sm:w-28">
                          Regularización
                          <input
                            type="number" min={1} max={5} step={1}
                            value={regularizacion}
                            onChange={(e) => setRegularizacion(e.target.value)}
                            className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={guardando}
                          onClick={() => guardarInstanciaUnica("regularizacion", regularizacion)}
                          className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 w-full sm:w-auto"
                        >
                          Guardar regularización
                        </button>
                      </div>
                    )}

                  {resultadoActual && (
                    <div
                      className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                        resultadoActual.aprobado ? "bg-[#E7F3EB] text-success" : "bg-[#FBEAE8] text-danger"
                      }`}
                    >
                      Nota final ({ETIQUETA_INSTANCIA[resultadoActual.instanciaFinal]}): {resultadoActual.notaFinal} —{" "}
                      {resultadoActual.aprobado ? "Aprobada" : "No aprobada — repite esta materia"}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col border-t border-border pt-3">
                {disciplinas.map((d) => {
                  const notas = notasPorDisciplina.get(d.id) ?? {};
                  const r = evaluarMateria(notas, gradoActual);
                  return (
                    <div key={d.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
                      <span>{d.nombre}</span>
                      <span
                        className={
                          r === null
                            ? "text-text-soft"
                            : r.aprobado
                            ? "text-success font-semibold"
                            : "text-danger font-semibold"
                        }
                      >
                        {r ? `${r.notaFinal} (${ETIQUETA_INSTANCIA[r.instanciaFinal]})` : "Sin notas"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
