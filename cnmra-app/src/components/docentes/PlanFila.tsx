"use client";

import { formatoFecha, type ArchivoDocumento } from "@/lib/docentes";

export type DocenteBasico = { id: string; nombre_completo: string };
export type DocPlan = {
  id: string;
  docente_id: string;
  tipo: string;
  titulo: string;
  materia: string | null;
  curso_id: string | null;
  fecha: string;
  archivos: ArchivoDocumento[] | null;
};
export type ItemMateria = { clave: string; curso: string; materia: string; docs: DocPlan[]; enLegajo: boolean };
export type FilaPlan = {
  doc: DocenteBasico;
  lista: ItemMateria[];
  requeridas: number;
  entregadas: number;
  estado: "sin_materias" | "entrego" | "no";
};

const ETQ = {
  entrego: { t: "Entregó", c: "bg-green-50 text-teal border-green-200" },
  no: { t: "No entregó", c: "bg-red-50 text-danger border-red-200" },
  sin_materias: { t: "Sin materias cargadas", c: "bg-bg text-text-soft border-border" },
};

export default function PlanFila({
  fila,
  abierto,
  alternar,
  abrirArchivo,
  tipos,
}: {
  fila: FilaPlan;
  abierto: boolean;
  alternar: () => void;
  abrirArchivo: (path: string) => void;
  tipos: string[];
}) {
  const e = ETQ[fila.estado];
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-[180px]">
          <div className="font-medium text-sm">{fila.doc.nombre_completo}</div>
          {fila.requeridas > 0 && (
            <div className="text-xs text-text-soft">
              {fila.entregadas} de {fila.requeridas} materias con entrega
            </div>
          )}
        </div>
        <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${e.c}`}>{e.t}</span>
        <button onClick={alternar} className="text-xs text-navy font-semibold">
          {abierto ? "Cerrar" : "Ver plan"}
        </button>
      </div>
      {abierto && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
          {fila.lista.length === 0 && (
            <p className="text-sm text-text-soft">Este docente todavía no cargó materias en su legajo.</p>
          )}
          {fila.lista.map((it) => (
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
}
