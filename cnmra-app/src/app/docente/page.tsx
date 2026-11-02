"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BUCKET_DOCENTES,
  DIAS_CONSERVACION_PLANES,
  etiquetaTipo,
  fechaDeBorrado,
  formatoFecha,
  formatoTamano,
  type ArchivoDocumento,
} from "@/lib/docentes";

type Documento = {
  id: string;
  tipo: string;
  titulo: string;
  materia: string | null;
  fecha: string;
  creado_en: string;
  archivos: ArchivoDocumento[];
  cursos: { grado: string; turno: string; ciclo: string } | null;
};

export default function MisDocumentosPage() {
  const supabase = createClient();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("documentos_docentes")
      .select("id, tipo, titulo, materia, fecha, creado_en, archivos, cursos(grado, turno, ciclo)")
      .order("creado_en", { ascending: false });
    if (error) setMensaje("No se pudieron cargar tus documentos: " + error.message);
    setDocumentos((data as unknown as Documento[]) ?? []);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de documentos del docente
    cargar();
  }, [cargar]);

  async function abrirArchivo(path: string) {
    const ventana = window.open("", "_blank");
    const { data, error } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      ventana?.close();
      setMensaje("No se pudo abrir el archivo.");
      return;
    }
    if (ventana) ventana.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  async function eliminar(doc: Documento) {
    if (!window.confirm(`¿Eliminar "${doc.titulo}" y sus archivos? Esto no se puede deshacer.`)) return;
    setMensaje(null);
    const paths = (doc.archivos ?? []).map((a) => a.path);
    if (paths.length > 0) {
      const { error: errArchivos } = await supabase.storage.from(BUCKET_DOCENTES).remove(paths);
      if (errArchivos) {
        setMensaje("No se pudieron borrar los archivos: " + errArchivos.message);
        return;
      }
    }
    const { error } = await supabase.from("documentos_docentes").delete().eq("id", doc.id);
    if (error) {
      setMensaje("No se pudo eliminar: " + error.message);
      return;
    }
    cargar();
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Mis documentos</h1>
          <p className="text-sm text-text-soft mt-1">
            Los planes diarios y semanales se eliminan solos a los {DIAS_CONSERVACION_PLANES} días. Los planes anuales
            y proyectos se conservan.
          </p>
        </div>
        <Link href="/docente/subir" className="h-10 rounded-lg bg-navy text-white font-semibold text-sm px-5 flex items-center">
          + Subir documento
        </Link>
      </div>

      {mensaje && <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{mensaje}</div>}

      {documentos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-text-soft">
          Todavía no subiste ningún documento.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documentos.map((doc) => {
            const borrado = fechaDeBorrado(doc.tipo, doc.creado_en);
            return (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[15px]">{doc.titulo}</div>
                    <div className="text-xs text-text-soft mt-0.5">
                      {etiquetaTipo(doc.tipo)}
                      {doc.materia ? ` · ${doc.materia}` : ""}
                      {doc.cursos ? ` · ${doc.cursos.grado} (${doc.cursos.turno})` : ""}
                      {" · "}
                      {formatoFecha(new Date(doc.fecha + "T00:00:00"))}
                    </div>
                  </div>
                  <button onClick={() => eliminar(doc)} className="text-xs text-danger font-medium">
                    Eliminar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(doc.archivos ?? []).map((a) => (
                    <button
                      key={a.path}
                      onClick={() => abrirArchivo(a.path)}
                      className="text-xs bg-bg border border-border rounded-full px-3 py-1 text-left"
                    >
                      {a.nombre} · {formatoTamano(a.bytes)}
                    </button>
                  ))}
                </div>

                {borrado && (
                  <div className="text-[11px] text-text-soft">Se eliminará automáticamente el {formatoFecha(borrado)}.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
