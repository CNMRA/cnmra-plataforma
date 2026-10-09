"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Estudiante = { id: string; nombre_completo: string };
type Registro = { id: string; fecha: string; categoria: string; descripcion: string };
type Asistencia = { id: string; fecha: string; estado: string };

export default function SeguimientoInstitucional() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [tab, setTab] = useState<"anecdotico" | "asistencia">("anecdotico");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);

  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("atencion");
  const [estadoAsistencia, setEstadoAsistencia] = useState("presente");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from("estudiantes")
      .select("id, nombre_completo")
      .order("nombre_completo")
      .then(({ data }) => setEstudiantes(data ?? []));
  }, [supabase]);

  const cargarDetalle = useCallback(async () => {
    if (!estudianteId) return;
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase
        .from("registros_anecdoticos")
        .select("id, fecha, categoria, descripcion")
        .eq("estudiante_id", estudianteId)
        .order("fecha", { ascending: false }),
      supabase
        .from("asistencias")
        .select("id, fecha, estado")
        .eq("estudiante_id", estudianteId)
        .order("fecha", { ascending: false }),
    ]);
    setRegistros(r ?? []);
    setAsistencias(a ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargarDetalle();
  }, [cargarDetalle]);

  async function agregarRegistro(e: React.FormEvent) {
    e.preventDefault();
    if (!estudianteId || !descripcion) return;
    setGuardando(true);
    await supabase.from("registros_anecdoticos").insert({
      estudiante_id: estudianteId,
      categoria,
      descripcion,
    });
    setDescripcion("");
    setGuardando(false);
    cargarDetalle();
  }

  async function marcarAsistencia() {
    if (!estudianteId) return;
    setGuardando(true);
    const hoy = new Date().toISOString().slice(0, 10);
    await supabase
      .from("asistencias")
      .upsert(
        { estudiante_id: estudianteId, fecha: hoy, estado: estadoAsistencia },
        { onConflict: "estudiante_id,fecha" }
      );
    setGuardando(false);
    cargarDetalle();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Seguimiento del estudiante</h1>
        <p className="text-sm text-text-soft mt-1">Registro anecdótico y asistencia, con historial visible para la familia.</p>
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
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("anecdotico")}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold ${tab === "anecdotico" ? "bg-navy text-white" : "bg-card border border-border text-text-soft"}`}
            >
              Registro anecdótico
            </button>
            <button
              onClick={() => setTab("asistencia")}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold ${tab === "asistencia" ? "bg-navy text-white" : "bg-card border border-border text-text-soft"}`}
            >
              Asistencia
            </button>
          </div>

          {tab === "anecdotico" ? (
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <form onSubmit={agregarRegistro} className="flex flex-col gap-3">
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="h-10 rounded-lg border border-border px-3 text-sm bg-card w-fit"
                >
                  <option value="positivo">Positivo</option>
                  <option value="atencion">A tener en cuenta</option>
                  <option value="conducta">Conducta</option>
                </select>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción del registro…"
                  className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-20"
                  required
                />
                <button disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-5">
                  {guardando ? "Guardando…" : "Cargar registro"}
                </button>
              </form>

              <div className="flex flex-col border-t border-border pt-3">
                {registros.map((r) => (
                  <div key={r.id} className="py-2 border-b border-border last:border-none text-sm">
                    <div className="text-xs text-text-soft">{r.fecha} · {r.categoria}</div>
                    <div>{r.descripcion}</div>
                  </div>
                ))}
                {registros.length === 0 && <p className="text-sm text-text-soft">Sin registros todavía.</p>}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <select
                  value={estadoAsistencia}
                  onChange={(e) => setEstadoAsistencia(e.target.value)}
                  className="h-10 rounded-lg border border-border px-3 text-sm bg-card"
                >
                  <option value="presente">Presente</option>
                  <option value="ausente">Ausente</option>
                  <option value="tardanza">Tardanza</option>
                  <option value="justificado">Justificado</option>
                </select>
                <button onClick={marcarAsistencia} disabled={guardando} className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5">
                  {guardando ? "Guardando…" : "Cargar asistencia de hoy"}
                </button>
              </div>

              <div className="flex flex-col border-t border-border pt-3">
                {asistencias.map((a) => (
                  <div key={a.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
                    <span>{a.fecha}</span>
                    <span className="text-text-soft">{a.estado}</span>
                  </div>
                ))}
                {asistencias.length === 0 && <p className="text-sm text-text-soft">Sin asistencia cargada todavía.</p>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
