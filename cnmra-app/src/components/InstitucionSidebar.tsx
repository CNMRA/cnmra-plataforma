"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAnioLectivo } from "@/lib/anio-lectivo";

const links = [
  { href: "/institucion", label: "Panel" },
  { href: "/institucion/inscripcion", label: "Inscripción" },
  { href: "/institucion/cursos", label: "Cursos" },
  { href: "/institucion/avisos", label: "Avisos" },
  { href: "/institucion/usuarios", label: "Usuarios" },
  { href: "/institucion/docentes", label: "Docentes", docentes: true },
];

export default function InstitucionSidebar({ nombre, rol }: { nombre: string; rol: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);
  const [acompana, setAcompana] = useState(false);
  const { anio, setAnio, anios } = useAnioLectivo();
  const esDirector = rol === "director";

  useEffect(() => {
    if (esDirector) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("perfiles").select("acompanamiento").eq("id", user.id).single();
      setAcompana(data?.acompanamiento === true);
    })();
  }, [supabase, esDirector]);

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const iniciales = nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const etiquetaRol = esDirector ? "Dirección · acceso total" : acompana ? "Acompañamiento docente" : "Carga de datos";

  const contenido = (cerrar?: () => void) => (
    <>
      <div className="flex flex-col gap-1.5 px-1">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-white/45">Año lectivo</span>
        <div className="flex bg-white/10 rounded-lg p-0.5 gap-0.5">
          {anios.map((a) => (
            <button
              key={a}
              onClick={() => setAnio(a)}
              className={`flex-1 text-center py-1.5 rounded-md text-xs font-semibold ${
                anio === a ? "bg-teal text-navy-dark" : "text-white/55 hover:text-white"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {links
          .filter((l) => !l.docentes || (anio === 2027 && (esDirector || acompana)))
          .map((l) => {
            const activo = l.href === "/institucion" ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={cerrar}
                className={`rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium ${
                  activo ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-3 px-1">
        <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-[12px] font-semibold flex-none">
          {iniciales}
        </div>
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-[12.5px] font-medium truncate">{nombre}</div>
          <div className="text-[11px] text-white/60">{etiquetaRol}</div>
        </div>
        <button onClick={salir} className="text-white/50 hover:text-white text-[11px] flex-none">
          Salir
        </button>
      </div>
    </>
  );

  const logo = (tam: number) => (
    <div className="flex items-center gap-2.5 px-1">
      <Image src="/logo.jpg" alt="CNMRA" width={tam} height={tam} className="rounded object-contain" />
      <span className="font-display font-bold text-sm">CNMRA</span>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex print:hidden flex-none w-[220px] bg-navy-dark p-4 flex-col gap-6 text-white">
        {logo(32)}
        {contenido()}
      </div>

      <div className="md:hidden print:hidden flex-none bg-navy-dark text-white">
        <div className="h-14 flex items-center justify-between px-4">
          {logo(28)}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold bg-teal text-navy-dark px-2.5 py-1 rounded-full">{anio}</span>
            <button
              onClick={() => setAbierto((v) => !v)}
              aria-label="Abrir menú"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg"
            >
              {abierto ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {abierto && (
          <div className="px-4 pb-4 flex flex-col gap-5 border-t border-white/10 pt-3">
            {contenido(() => setAbierto(false))}
          </div>
        )}
      </div>
    </>
  );
}
