"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmarCompromiso({
  fichaId,
  estudianteId,
  estudianteNombre,
  volverHref,
}: {
  fichaId: string;
  estudianteId: string;
  estudianteNombre: string;
  volverHref: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    setGuardando(true);

    await supabase.from("fichas_matriculacion").update({ confirmacion_final_en: new Date().toISOString() }).eq("id", fichaId);

    // Firma también, de forma automática, el Acuerdo de Convivencia de este estudiante,
    // para que la familia no tenga que volver a firmarlo aparte.
    const anio = new Date().getFullYear();

    const { data: estudianteData } = await supabase.from("estudiantes").select("familia_id").eq("id", estudianteId).maybeSingle();

    let firmante = estudianteNombre;
    if (estudianteData?.familia_id) {
      const { data: familiaData } = await supabase
        .from("familias")
        .select("tutor_nombre")
        .eq("id", estudianteData.familia_id)
        .maybeSingle();
      if (familiaData?.tutor_nombre) firmante = familiaData.tutor_nombre;
    }

    const { data: acuerdoExistente } = await supabase
      .from("acuerdos")
      .select("id")
      .eq("estudiante_id", estudianteId)
      .eq("ciclo_lectivo", anio)
      .maybeSingle();

    if (acuerdoExistente) {
      await supabase
        .from("acuerdos")
        .update({ firmado: true, firmado_por_nombre: firmante, firmado_en: new Date().toISOString() })
        .eq("id", acuerdoExistente.id);
    } else {
      await supabase.from("acuerdos").insert({
        estudiante_id: estudianteId,
        ciclo_lectivo: anio,
        firmado: true,
        firmado_por_nombre: firmante,
        firmado_en: new Date().toISOString(),
      });
    }

    setGuardando(false);
    router.refresh();
  }

  return (
    <div className="bg-white border border-border rounded-xl p-6 max-w-md w-full flex flex-col gap-4 text-center shadow-sm">
      <h1 className="font-display text-xl">Antes de generar el documento</h1>
      <p className="text-sm text-text-soft">
        ¿Está usted seguro/a de que está de acuerdo con todo el compromiso asumido para <strong>{estudianteNombre}</strong>?
      </p>
      <button onClick={confirmar} disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm disabled:opacity-60">
        {guardando ? "Guardando…" : "Sí, estoy de acuerdo"}
      </button>
      <a href={volverHref} className="text-xs text-teal font-medium">
        ← Volver y revisar antes de confirmar
      </a>
    </div>
  );
}
