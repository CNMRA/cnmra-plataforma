"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type DocenteBasico = { id: string; nombre_completo: string };
type Legajo = {
  docente_id: string;
  enviado: boolean;
  enviado_en: string | null;
  habilitado_por_direccion: boolean;
  asignaciones: { curso_id: string; materia: string }[] | null;
};
type PlanAnual = { docente_id: string; curso_id: string | null; materia: string | null };

type FilaLegajo = {
  docente: DocenteBasico;
  estado: "sin_empezar" | "borrador" | "enviado";
  habilitado: boolean;
  materias: number;
  anuales: number;
  enviadoEn: string | null;
};

const ETIQUETA_ESTADO = {
  sin_empezar: { texto: "Sin empezar", clase: "bg-red-50 text-danger border-red-200" },
  borrador: { texto: "Borrador", clase: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  enviado: { texto: "Enviado", clase: "bg-green-50 text-teal border-green-200" },
};

export default function LegajosLista({ soloLectura }: { soloLectura: boolean }) {
  const supabase = createClient();
  const [cargando, setCargando] = useState(true);
  const [esDirector, setEsDirector] = useState(false);
  const [filas, setFilas] = useState<FilaLegajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sin_empezar" | "borrador" | "enviado">("todos");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: perfil } = await supabase.from("perfiles").select("rol, acompanamiento").eq("id", user.id).single();
    const permitido = perfil?.rol === "director" || (perfil?.rol === "carga_datos" && perfil?.acompanamiento === true);
    if (!permitido) {
      setEsDirector(false);
      setCargando(false);
      return;
    }
    setEsDirector(true);

    const [{ data: docentes }, { data: legajos }, { data: planes }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre_completo").eq("rol", "docente").order("nombre_completo"),
      supabase
        .from("legajos_docentes")
        .select("docente_id, enviado, enviado_en, habilitado_por_direccion, asignaciones"),
      supabase.from("documentos_docentes").select("docente_id, curso_id, materia").eq("tipo", "plan_anual"),
    ]);

    const legajoDe = new Map<string, Legajo>();
    ((legajos as Legajo[] | null) ?? []).forEach((l) => legajoDe.set(l.docente_id, l));

    const anualesDe = new Map<string, Set<string>>();
    ((planes as PlanAnual[] | null) ?? []).forEach((p) => {
      const set = anualesDe.get(p.docente_id) ?? new Set<string>();
      set.add(`${p.curso_id}|${p.materia}`);
      anualesDe.set(p.docente_id, set);
    });

    const lista: FilaLegajo[] = ((docentes as DocenteBasico[] | null) ?? []).map((d) => {
      const l = legajoDe.get(d.id);
      const asignaciones = l?.asignaciones ?? [];
      const claves = new Set(asignaciones.map((a) => `${a.curso_id}|${a.materia}`));
      const subidos = anualesDe.get(d.id) ?? new Set<string>();
      let anuales = 0;
      claves.forEach((c) => {
        if (subidos.has(c)) anuales++;
      });
      return {
        docente: d,
        estado: !l ? "sin_empezar" : l.enviado ? "enviado" : "borrador",
        habilitado: Boolean(l && (l.enviado || l.habilitado_por_direccion)),
        materias: claves.size,
        anuales,
        enviadoEn: l?.enviado_en ?? null,
      };
    });
    setFilas(lista);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de legajos
    cargar();
  }, [cargar]);

  async function habilitar(f: FilaLegajo) {
    if (
      !window.confirm(
        `¿Habilitar a ${f.docente.nombre_completo} para subir planes sin que termine su legajo?`
      )
    )
      return;
    setMensaje(null);
    const { error } = await supabase
      .from("legajos_docentes")
      .upsert(
        { docente_id: f.docente.id, habilitado_por_direccion: true, actualizado_en: new Date().toISOString() },
        { onConflict: "docente_id" }
      );
    if (error) {
      setMensaje("No se pudo habilitar: " + error.message);
      return;
    }
    cargar();
  }

  const visibles = useMemo(() => {
    const q = busqueda
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return filas.filter((f) => {
      if (filtro !== "todos" && f.estado !== filtro) return false;
      if (!q) return true;
      return f.docente.nombre_completo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q);
    });
  }, [filas, busqueda, filtro]);

  const total = filas.length;
  const enviados = filas.filter((f) => f.estado === "enviado").length;
  const borradores = filas.filter((f) => f.estado === "borrador").length;
  const sinEmpezar = filas.filter((f) => f.estado === "sin_empezar").length;

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;
  if (!esDirector) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm">
        Solo Dirección puede ver esta sección.
      </div>
    );
  }

  const botonFiltro = (valor: typeof filtro, texto: string, cantidad: number) => (
    <button
      key={valor}
      onClick={() => setFiltro(valor)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium border ${
        filtro === valor ? "bg-navy text-white border-navy" : "bg-card border-border text-text-soft"
      }`}
    >
      {texto} ({cantidad})
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-soft">
        {enviados} de {total} legajos enviados.
      </p>

      {mensaje && <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{mensaje}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {botonFiltro("todos", "Todos", total)}
        {botonFiltro("enviado", "Enviados", enviados)}
        {botonFiltro("borrador", "Borrador", borradores)}
        {botonFiltro("sin_empezar", "Sin empezar", sinEmpezar)}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="h-9 rounded-lg border border-border px-3 text-sm bg-bg ml-auto w-full sm:w-56"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-text-soft bg-bg">
            <tr>
              <th className="px-4 py-2.5">Docente</th>
              <th className="px-4 py-2.5">Legajo</th>
              <th className="px-4 py-2.5">Materias</th>
              <th className="px-4 py-2.5">Planes anuales</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const e = ETIQUETA_ESTADO[f.estado];
              return (
                <tr key={f.docente.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{f.docente.nombre_completo}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${e.clase}`}>
                      {e.texto}
                    </span>
                    {f.estado !== "enviado" && f.habilitado && (
                      <span className="text-[11px] text-text-soft ml-2">habilitado por Dirección</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{f.materias}</td>
                  <td className="px-4 py-2.5">
                    {f.materias === 0 ? "—" : `${f.anuales} de ${f.materias}`}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {!f.habilitado && !soloLectura && (
                      <button onClick={() => habilitar(f)} className="text-xs text-navy font-medium mr-3">
                        Habilitar
                      </button>
                    )}
                    <Link href={`/institucion/legajos/${f.docente.id}`} className="text-xs text-navy font-semibold">
                      Ver legajo →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-soft">
                  No hay docentes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
