"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Estado = "cargando" | "sin_legajo" | "borrador" | "habilitado";

const ICONO_PROPS = {
  width: 40,
  height: 40,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONOS = {
  legajo: (
    <svg {...ICONO_PROPS}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  anual: (
    <svg {...ICONO_PROPS}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  proyectos: (
    <svg {...ICONO_PROPS}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  diario: (
    <svg {...ICONO_PROPS}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h7" />
    </svg>
  ),
  candado: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
};

type Tarjeta = {
  clave: string;
  titulo: string;
  descripcion: string;
  href: string;
  icono: React.ReactNode;
  siempreActiva?: boolean;
  lista: boolean; // false = la pantalla todavía no está armada
};

const TARJETAS: Tarjeta[] = [
  {
    clave: "legajo",
    titulo: "Mi legajo",
    descripcion: "Tus datos, foto, títulos y materias",
    href: "/docente/legajo",
    icono: ICONOS.legajo,
    siempreActiva: true,
    lista: true,
  },
  {
    clave: "anual",
    titulo: "Plan anual",
    descripcion: "Un plan por cada materia",
    href: "/docente/documentos/anual",
    icono: ICONOS.anual,
    lista: true,
  },
  {
    clave: "proyectos",
    titulo: "Proyectos",
    descripcion: "Proyectos presentados",
    href: "/docente/documentos/proyectos",
    icono: ICONOS.proyectos,
    lista: true,
  },
  {
    clave: "diario",
    titulo: "Plan diario",
    descripcion: "Planes diarios y semanales",
    href: "/docente/documentos/diario",
    icono: ICONOS.diario,
    lista: true,
  },
];

export default function InicioDocentePage() {
  const supabase = createClient();
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    async function revisar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("legajos_docentes")
        .select("enviado, habilitado_por_direccion")
        .eq("docente_id", user.id)
        .maybeSingle();
      if (!data) setEstado("sin_legajo");
      else if (data.enviado || data.habilitado_por_direccion) setEstado("habilitado");
      else setEstado("borrador");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- revisar el estado del legajo al entrar
    revisar();
  }, [supabase]);

  if (estado === "cargando") return <p className="text-sm text-text-soft">Cargando…</p>;

  const habilitado = estado === "habilitado";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Bienvenido/a</h1>
        {!habilitado && (
          <p className="text-sm text-text-soft mt-1">
            {estado === "borrador"
              ? "Tenés un legajo a medias. Completalo y envialo para habilitar el resto de las secciones."
              : "Para empezar, completá tu legajo y enviáselo a Dirección. Después se habilitan el resto de las secciones."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {TARJETAS.map((t) => {
          const activa = (t.siempreActiva || habilitado) && t.lista;
          const base =
            "rounded-2xl border p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[170px] transition";
          const contenido = (
            <>
              <div className={activa ? "text-navy" : "text-text-soft"}>{t.icono}</div>
              <div className="font-display font-bold text-lg leading-tight">{t.titulo}</div>
              <div className="text-xs text-text-soft">{t.descripcion}</div>
              {!t.siempreActiva && !habilitado && (
                <div className="flex items-center gap-1 text-[11px] text-text-soft mt-1">
                  {ICONOS.candado} Se habilita al enviar tu legajo
                </div>
              )}
              {!t.siempreActiva && habilitado && !t.lista && (
                <div className="text-[11px] text-text-soft mt-1">Próximamente</div>
              )}
            </>
          );
          return activa ? (
            <Link
              key={t.clave}
              href={t.href}
              className={`${base} bg-card border-border hover:border-teal hover:shadow-sm ${
                t.clave === "legajo" && !habilitado ? "border-teal ring-2 ring-teal/30" : ""
              }`}
            >
              {contenido}
            </Link>
          ) : (
            <div key={t.clave} className={`${base} bg-bg border-border opacity-60 cursor-not-allowed`}>
              {contenido}
            </div>
          );
        })}
      </div>
    </div>
  );
}
