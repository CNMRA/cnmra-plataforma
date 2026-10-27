"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Fila = {
  estudianteId: string;
  nombre: string;
  acuerdoId: string;
  firmado: boolean;
  cartaConfirmadaEn: string | null;
};

function formatearFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AcuerdoFamilia() {
  const supabase = createClient();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [firmante, setFirmante] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: familia } = await supabase.from("familias").select("id, tutor_nombre").eq("tutor_perfil_id", user.id).maybeSingle();
    if (!familia) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setFirmante(familia.tutor_nombre);

    const { data: estudiantes } = await supabase.from("estudiantes").select("id, nombre_completo").eq("familia_id", familia.id);
    const anio = new Date().getFullYear();

    const { data: fichas } = await supabase
      .from("fichas_matriculacion")
      .select("estudiante_id, confirmacion_final_en")
      .in("estudiante_id", (estudiantes ?? []).map((e) => e.id));

    const cartaPorEstudiante = new Map((fichas ?? []).map((f) => [f.estudiante_id, f.confirmacion_final_en]));

    const resultado: Fila[] = [];
    for (const est of estudiantes ?? []) {
      let { data: acuerdo } = await supabase
        .from("acuerdos")
        .select("id, firmado")
        .eq("estudiante_id", est.id)
        .eq("ciclo_lectivo", anio)
        .maybeSingle();

      if (!acuerdo) {
        const { data: nuevo } = await supabase
          .from("acuerdos")
          .insert({ estudiante_id: est.id, ciclo_lectivo: anio })
          .select("id, firmado")
          .single();
        acuerdo = nuevo;
      }

      if (acuerdo) {
        resultado.push({
          estudianteId: est.id,
          nombre: est.nombre_completo,
          acuerdoId: acuerdo.id,
          firmado: acuerdo.firmado,
          cartaConfirmadaEn: cartaPorEstudiante.get(est.id) ?? null,
        });
      }
    }
    setFilas(resultado);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  async function firmar(acuerdoId: string) {
    await supabase
      .from("acuerdos")
      .update({ firmado: true, firmado_por_nombre: firmante, firmado_en: new Date().toISOString() })
      .eq("id", acuerdoId);
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Acuerdo de convivencia</h1>
        <p className="text-sm text-text-soft mt-1">Ciclo lectivo {new Date().getFullYear()}.</p>
      </div>

      {cargando ? (
        <p className="text-sm text-text-soft">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-text-soft">No tenés hijos/as cargados todavía.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filas.map((f) => (
            <div key={f.acuerdoId} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">{f.nombre}</div>
                  <div className="text-xs text-text-soft mt-1">
                    {f.firmado ? "Acuerdo firmado" : "Acuerdo pendiente de firma"}
                  </div>
                </div>
                {f.firmado ? (
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#E7F3EB] text-success">Firmado</span>
                ) : (
                  <button onClick={() => firmar(f.acuerdoId)} className="h-10 px-5 rounded-lg bg-navy text-white font-semibold text-sm">
                    Firmar
                  </button>
                )}
              </div>

              {f.cartaConfirmadaEn && (
                <div className="bg-bg border border-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-text-soft">
                    Carta de Compromiso 2027 — &quot;Estoy de acuerdo&quot;, firmado el {formatearFecha(f.cartaConfirmadaEn)}
                  </div>
                  <a
                    href={`/familia/matriculacion-2027/${f.estudianteId}/imprimir`}
                    className="text-xs text-teal font-semibold shrink-0"
                  >
                    Ver documento →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
