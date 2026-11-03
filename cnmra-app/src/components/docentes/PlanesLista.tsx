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
        supabase.from("perfiles").select("id, nombre_completo").eq("rol", "docente").eq("activo", true).order("nombre_completo"),
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
    entrego: { t:
