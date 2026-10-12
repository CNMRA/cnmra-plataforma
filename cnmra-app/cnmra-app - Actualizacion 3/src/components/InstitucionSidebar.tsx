"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/institucion", label: "Panel" },
  { href: "/institucion/cursos", label: "Cursos" },
  { href: "/institucion/inscripcion", label: "Inscripción" },
  { href: "/institucion/seguimiento", label: "Seguimiento" },
  { href: "/institucion/calificaciones", label: "Calificaciones" },
  { href: "/institucion/alertas", label: "Alertas" },
  { href: "/institucion/usuarios", label: "Usuarios" },
];

export default function InstitucionSidebar({
  nombre,
  rol,
}: {
  nombre: string;
  rol: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navLinks = (onClick?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {links.map((l) => {
        const active = l.href === "/institucion" ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onClick}
            className={`rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium ${
              active ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  const perfilBox = (
    <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-3 px-1">
      <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-[12px] font-semibold flex-none">
        {iniciales}
      </div>
      <div className="leading-tight flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate">{nombre}</div>
        <div className="text-[11px] text-white/60">
          {rol === "director" ? "Dirección · acceso total" : "Carga de datos"}
        </div>
      </div>
      <button onClick={salir} title="Cerrar sesión" className="text-white/50 hover:text-white text-[11px] flex-none">
        Salir
      </button>
    </div>
  );

  return (
    <>
      {/* Escritorio: columna fija a la izquierda */}
      <div className="hidden md:flex flex-none w-[220px] bg-navy-dark p-4 flex-col gap-7 text-white">
        <div className="flex items-center gap-2.5 px-1">
          <Image src="/logo.jpg" alt="CNMRA" width={32} height={32} className="rounded object-contain" />
          <span className="font-display font-bold text-sm">CNMRA</span>
        </div>
        {navLinks()}
        {perfilBox}
      </div>

      {/* Celular: barra superior + menú desplegable */}
      <div className="md:hidden flex-none bg-navy-dark text-white">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.jpg" alt="CNMRA" width={28} height={28} className="rounded object-contain" />
            <span className="font-display font-bold text-sm">CNMRA</span>
          </div>
          <button
            onClick={() => setAbierto((v) => !v)}
            aria-label="Abrir menú"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {abierto ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {abierto && (
          <div className="px-4 pb-4 flex flex-col gap-5 border-t border-white/10 pt-3">
            {navLinks(() => setAbierto(false))}
            {perfilBox}
          </div>
        )}
      </div>
    </>
  );
}
