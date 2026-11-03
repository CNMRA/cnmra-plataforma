"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DOCENTES, formatoFecha, type ArchivoDocumento } from "@/lib/docentes";

type DocenteBasico = { id: string; nombre_completo: string };

function sinTildes(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type CursoInfo = { id: string; grado: string; turno: string; enfasis: string | null };
type DocPlan = {
  id: string;
  docente_id: string;
  tipo: string;
  titulo: string;
  materia: string | null;
  curso_id: string | null;
  fecha: string;
  archivos: ArchivoDocumento[] | null;
};
type LegajoMaterias = { docente_id: string; asignaciones: { curso_id: string; materia: string }[] | null };
type DatosPlanes = {
  docentes: DocenteBasico[];
  legajos: LegajoMaterias[];
  cursos: CursoInfo[];
  docs: DocPlan[];
};
type ItemMateria = { clave: string; curso: string; materia: string; docs: DocPlan[]; enLegajo: boolean };

export default function PlanesLista({ tipos, nombre }: { tipos: string[]; nombre: string }) {
  const supabase = createClient();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosPlanes | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "entrego" | "no">("todos");

  const clavesTipos = tipos.join(",");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [d, l, c, p] = await Promise.all([
        supabase.from("perfiles").select("id, nombre_completo").eq("rol", "docente").order("nombre_completo"),
        supabase.from("legajos_docentes").select("docente_id, asignaciones"),
        supabase.from("cursos").select("id, grado, turno, enfasis"),
        supabase
          .from("documentos_docentes")
          .select("id, docente_id, tipo, titulo, materia, curso_id, fecha, archivos")
          .in("tipo", clavesTipos.split(","))
          .order("fecha", { ascending: false }),
      ]);
      if (!vivo) return;
      const fallo = d.error || l.error || c.error || p.error;
      if (fallo) setError(fallo.message);
      else
        setDatos({
          docentes: (d.data as DocenteBasico[]) ?? [],
          legajos: (l.data as LegajoMaterias[]) ?? [],
          cursos: (c.data as CursoInfo[]) ?? [],
          docs: (p.data as DocPlan[]) ?? [],
        });
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, clavesTipos]);

  const filas = useMemo(() => {
    if (!datos) return [];
    const etiquetaCurso = new Map<string, string>();
    datos.cursos.forEach((c) =>
      etiquetaCurso.set(c.id, `${c.grado} · ${c.turno}${c.enfasis ? " · " + c.enfasis : ""}`)
    );
    return datos.docentes.map((doc) => {
      const asign = datos.legajos.find((l) => l.docente_id === doc.id)?.asignaciones ?? [];
      const misDocs = datos.docs.filter((x) => x.docente_id === doc.id);
      const items = new Map<string, ItemMateria>();
      asign.forEach((a) => {
        const clave = `${a.curso_id}|${a.materia}`;
        items.set(clave, {
          clave,
          curso: etiquetaCurso.get(a.curso_id) ?? "Curso",
          materia: a.materia,
          docs: [],
          enLegajo: true,
        });
      });
      misDocs.forEach((x) => {
        const clave = `${x.curso_id}|${x.materia}`;
        const it = items.get(clave) ?? {
          clave,
          curso: x.curso_id ? (etiquetaCurso.get(x.curso_id) ?? "Curso") : "—",
          materia: x.materia ?? "(sin materia)",
          docs: [],
          enLegajo: false,
        };
        it.docs.push(x);
        items.set(clave, it);
      });
      const lista = Array.from(items.values());
      const requeridas = lista.filter((i) => i.enLegajo);
      const entregadas = requeridas.filter((i) => i.docs.length > 0).length;
      const estado: "sin_materias" | "entrego" | "no" =
        requeridas.length === 0
          ? "sin_materias"
          : entregadas === requeridas.length
            ? "entrego"
            : "no";
      return { doc, lista, requeridas: requeridas.length, entregadas, estado };
    });
  }, [datos]);

  async function abrirArchivo(path: string) {
    const ventana = window.open("", "_blank");
    const { data, error: e } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 120);
    if (e || !data) {
      ventana?.close();
      window.alert("No se pudo abrir el archivo.");
      return;
    }
    if (ventana) ventana.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  const visibles = filas.filter((f) => {
    if (filtro === "entrego" && f.estado !== "entrego") return false;
    if (filtro === "no" && f.estado !== "no" && f.estado !== "sin_materias") return false;
    const q = busqueda.trim().toLowerCase();
    return !q || sinTildes(f.doc.nombre_completo.toLowerCase()).includes(sinTildes(q));
  });

  const nEntrego = filas.filter((f) => f.estado === "entrego").length;
  const nNo = filas.filter((f) => f.estado === "no" || f.estado === "sin_materias").length;

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  const ETQ = {
    entrego: { t: "Entregó", c: "bg-green-50 text-teal border-green-200" },
    no: { t: "No entregó", c: "bg-red-50 text-danger border-red-200" },
    sin_materias: { t: "Sin materias cargadas", c: "bg-bg text-text-soft border-border" },
  };

  const boton = (v: typeof filtro, t: string, n: number) => (
    <button
      key={v}
      onClick={() => setFiltro(v)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium border ${
        filtro === v ? "bg-navy text-white border-navy" : "bg-card border-border text-text-soft"
      }`}
    >
      {t} ({n})
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-soft">
        {nombre}: {nEntrego} de {filas.length} docentes entregaron todas sus materias.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {boton("todos", "Todos", filas.length)}
        {boton("entrego", "Entregaron", nEntrego)}
        {boton("no", "No entregaron", nNo)}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="h-9 rounded-lg border border-border px-3 text-sm bg-bg ml-auto w-full sm:w-56"
        />
      </div>

      <div className="flex flex-col gap-2">
        {visibles.map((f) => {
          const e = ETQ[f.estado];
          const abre = abierto === f.doc.id;
          return (
            <div key={f.doc.id} className="bg-card border border-border rounded-xl">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-sm">{f.doc.nombre_completo}</div>
                  {f.requeridas > 0 && (
                    <div className="text-xs text-text-soft">
                      {f.entregadas} de {f.requeridas} materias con entrega
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${e.c}`}>{e.t}</span>
                <button
                  onClick={() => setAbierto(abre ? null : f.doc.id)}
                  className="text-xs text-navy font-semibold"
                >
                  {abre ? "Cerrar" : "Ver plan"}
                </button>
              </div>
              {abre && (
                <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
                  {f.lista.length === 0 && (
                    <p className="text-sm text-text-soft">Este docente todavía no cargó materias en su legajo.</p>
                  )}
                  {f.lista.map((it) => (
                    <div key={it.clave} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{it.materia}</span>
                        <span className="text-xs text-text-soft">{it.curso}</span>
                        <span
                          className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${
                            it.docs.length > 0
                              ? "bg-green-50 text-teal border-green-200"
                              : "bg-red-50 text-danger border-red-200"
                          }`}
                        >
                          {it.docs.length > 0 ? `${it.docs.length} entregado${it.docs.length > 1 ? "s" : ""}` : "No entregó"}
                        </span>
                      </div>
                      {it.docs.map((d) => (
                        <div key={d.id} className="mt-1.5 ml-3 pl-3 border-l-2 border-border">
                          <div className="text-[13px]">
                            {d.titulo}{" "}
                            <span className="text-xs text-text-soft">
                              · {d.tipo === "plan_semanal" ? "Semanal · " : tipos.length > 1 ? "Diario · " : ""}
                              {formatoFecha(new Date(d.fecha + "T00:00:00"))}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(d.archivos ?? []).map((a) => (
                              <button
                                key={a.path}
                                onClick={() => abrirArchivo(a.path)}
                                className="text-xs border border-border rounded-lg px-2.5 py-1 text-navy"
                              >
                                Abrir {a.nombre}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {visibles.length === 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-6 text-center text-sm text-text-soft">
            No hay docentes para mostrar.
          </div>
        )}
      </div>
    </div>
  );
}
