"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAnioLectivo } from "@/lib/anio-lectivo";
import LegajosLista from "@/components/docentes/LegajosLista";
import PlanesLista from "@/components/docentes/PlanesLista";
import CuentasAcceso from "@/components/docentes/CuentasAcceso";

type Vista = "legajos" | "anual" | "proyectos" | "diario" | "cuentas";

const SECCIONES: { v: Vista; titulo: string; texto: string; icono: string }[] = [
  { v: "legajos", titulo: "Legajos del personal", texto: "Estado, ficha e impresión del legajo", icono: "📁" },
  { v: "anual", titulo: "Planes anuales", texto: "Quién entregó y quién no", icono: "📘" },
  { v: "proyectos", titulo: "Proyectos", texto: "Quién entregó y quién no", icono: "🧩" },
  { v: "diario", titulo: "Planes diarios o semanales", texto: "Quién entregó y quién no", icono: "🗒️" },
  { v: "cuentas", titulo: "Cuentas de acceso", texto: "Crear cuentas y cambiar claves", icono: "🔑" },
];

export default function DocentesPage() {
  const supabase = createClient();
  const [vista, setVista] = useState<Vista | null>(null);
  const [acceso, setAcceso] = useState<"director" | "gestor" | "acompanante" | null | undefined>(undefined);
  const { anio } = useAnioLectivo();

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leer la sección pedida en la dirección
    if (t && SECCIONES.some((s) => s.v === t)) setVista(t as Vista);
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAcceso(null);
        return;
      }
      const { data } = await supabase.from("perfiles").select("rol, acompanamiento, gestiona_usuarios").eq("id", user.id).single();
      if (data?.rol === "director") setAcceso("director");
      else if (data?.rol === "carga_datos" && data?.acompanamiento === true && data?.gestiona_usuarios === true)
        setAcceso("gestor");
      else if (data?.rol === "carga_datos" && data?.acompanamiento === true) setAcceso("acompanante");
      else setAcceso(null);
    })();
  }, [supabase]);

  if (acceso === undefined) return <p className="text-sm text-text-soft">Cargando…</p>;
  if (acceso === null) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm">
        Solo Dirección o el acompañamiento docente pueden ver esta sección.
      </div>
    );
  }

  if (anio !== 2027) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm">
        La sección Docentes está disponible en el año lectivo <b>2027</b>. Cambiá el año en el menú.
      </div>
    );
  }

  const soloLectura = acceso === "acompanante";
  const secciones = SECCIONES.filter((s) => acceso === "director" || s.v !== "cuentas");
  const actual = secciones.find((s) => s.v === vista);

  return (
    <div className="flex flex-col gap-5">
      {!actual ? (
        <>
          <h1 className="font-display text-2xl">Docentes</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {secciones.map((s) => (
              <button
                key={s.v}
                onClick={() => setVista(s.v)}
                className="text-left bg-card border border-border rounded-xl p-5 flex items-center gap-4 hover:border-teal"
              >
                <span className="text-3xl">{s.icono}</span>
                <span>
                  <span className="block font-semibold">{s.titulo}</span>
                  <span className="block text-xs text-text-soft mt-0.5">{s.texto}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div>
            <button onClick={() => setVista(null)} className="text-xs text-navy font-medium">
              ← Docentes
            </button>
            <h1 className="font-display text-2xl mt-1">{actual.titulo}</h1>
          </div>
          {actual.v === "legajos" && <LegajosLista soloLectura={soloLectura} />}
          {actual.v === "anual" && <PlanesLista tipos={["plan_anual"]} nombre="Planes anuales" />}
          {actual.v === "proyectos" && <PlanesLista tipos={["proyecto"]} nombre="Proyectos" />}
          {actual.v === "diario" && <PlanesLista tipos={["plan_diario", "plan_semanal"]} nombre="Planes diarios o semanales" />}
          {actual.v === "cuentas" && <CuentasAcceso />}
        </>
      )}
    </div>
  );
}
