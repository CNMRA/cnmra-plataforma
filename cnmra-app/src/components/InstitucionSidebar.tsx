"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAnioLectivo } from "@/lib/anio-lectivo";

const links: { href: string; label: string; soloDirector?: boolean; docentes?: boolean }[] = [
  { href: "/institucion", label: "Panel" },
  { href: "/institucion/inscripcion", label: "Inscripción" },
  { href: "/institucion/cursos", label: "Cursos" },
  { href: "/institucion/avisos", label: "Avisos" },
  { href: "/institucion/usuarios", label: "Usuarios" },
  { href: "/institucion/docentes", label: "Docentes", docentes: true },
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
  const [acompana, setAcompana] = useState(false);
  const { anio, setAnio, anios } = useAnioLectivo();

  useEffect(() => {
    if (rol === "director") return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("perfiles").select("acompanamiento").eq("id", user.id).single();
      setAcompana(data?.acompanamiento === true);
    })();
  }, [supabase, rol]);

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

  const selectorAnio = (
    <div className="flex flex-col gap-1.5 px-1">
      <span className="text-[10px] uppercase tracking-wide font-semibold text-white/45">Año lectivo</span>
      <div className="flex bg-white/10 rounded-lg p-0.5 gap-0.5">
        {anios.map((a) => (
          <button
            key={a}
            onClick={() => setAnio(a)}
            className={`flex-1 text-center py-1.5 rounded-md text-xs font-semibold transition ${
              anio === a ? "bg-teal text-navy-dark" : "text-white/55 hover:text-white"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );

  const navLinks = (onClick?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {links
        .filter((l) => {
          if (l.soloDirector && rol !== "director") return false;
          if (l.docentes && rol !== "director" && !acompana) return false;
          return true;
        })
        .map((l) => {
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
        {iniciales
