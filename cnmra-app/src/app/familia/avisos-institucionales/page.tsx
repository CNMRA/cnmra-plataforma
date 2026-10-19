"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Aviso = {
  id: string;
  nivel: "colegio" | "curso";
  titulo: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  contenido: string;
  imagen_url: string | null;
  creado_en: string;
  cursos: { grado: string; turno: string; enfasis: string | null } | null;
};

export default function AvisosInstitucionalesFamilia() {
  const supabase = createClient();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("avisos")
      .select("id, nivel, titulo, fecha, hora, lugar, contenido, imagen_url, creado_en, cursos(grado, turno, enfasis)")
      .in("nivel", ["colegio", "curso"])
      .order("fecha", { ascending: false, nullsFirst: false })
      .order("creado_en", { ascending: false });
    setAvisos((data as unknown as Aviso[]) ?? []);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Avisos institucionales</h1>
        <p className="text-sm text-text-soft mt-1">Convocatorias, entrevistas y reuniones del colegio o del curso.</p>
      </div>

      {cargando ? (
        <p className="text-sm text-text-soft">Cargando…</p>
      ) : avisos.length === 0 ? (
        <p className="text-sm text-text-soft">Todavía no hay avisos.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {avisos.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#EAF0FF] text-navy w-fit">
                {a.nivel === "colegio"
                  ? "Todo el colegio"
                  : a.cursos
                  ? `${a.cursos.grado}${a.cursos.enfasis ? ` — ${a.cursos.enfasis}` : ""}`
                  : "Curso"}
              </span>
              <div className="font-semibold text-sm">{a.titulo}</div>
              <div className="text-xs text-text-soft">
                {a.fecha ?? "Sin fecha"} {a.hora ? `· ${a.hora}` : ""} {a.lugar ? `· ${a.lugar}` : ""}
              </div>
              <p className="text-sm">{a.contenido}</p>
              {a.imagen_url && (
                // eslint-disable-next-line @next/next/no-img-element -- imagen subida por la institución a Supabase Storage
                <img src={a.imagen_url} alt="" className="rounded-lg max-h-56 object-contain border border-border" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
