"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Estudiante = { id: string; nombre_completo: string };
type Asistencia = { id: string; fecha: string; estado: string };

export default function AsistenciaFamilia() {
  const supabase = createClient();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteId, setEstudianteId] = useState("");
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: familia } = await supabase.from("familias").select("id").eq("tutor_perfil_id", user.id).maybeSingle();
      if (!familia) return;
      const { data } = await supabase
        .from("estudiantes")
        .select("id, nombre_completo")
        .eq("familia_id", familia.id);
      setEstudiantes(data ?? []);
      if (data && data.length > 0) setEstudianteId(data[0].id);
    })();
  }, [supabase]);

  const cargar = useCallback(async () => {
    if (!estudianteId) return;
    const { data } = await supabase
      .from("asistencias")
      .select("id, fecha, estado")
      .eq("estudiante_id", estudianteId)
      .order("fecha", { ascending: false });
    setAsistencias(data ?? []);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Asistencia</h1>
      </div>

      {estudiantes.length > 1 && (
        <select
          value={estudianteId}
          onChange={(e) => setEstudianteId(e.target.value)}
          className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs"
        >
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_completo}
            </option>
          ))}
        </select>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        {asistencias.length === 0 ? (
          <p className="text-sm text-text-soft">Sin asistencia cargada todavía.</p>
        ) : (
          asistencias.map((a) => (
            <div key={a.id} className="flex justify-between py-2 border-b border-border last:border-none text-sm">
              <span>{a.fecha}</span>
              <span className="text-text-soft">{a.estado}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
