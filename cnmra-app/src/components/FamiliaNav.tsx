"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/familia", label: "Inicio" },
  { href: "/familia/inscripcion", label: "Inscripción" },
  { href: "/familia/acuerdo", label: "Acuerdo" },
  { href: "/familia/asistencia", label: "Asistencia" },
  { href: "/familia/notas", label: "Notas" },
  { href: "/familia/anotaciones", label: "Anotaciones" },
  { href: "/familia/avisos", label: "Avisos" },
  { href: "/familia/matriculacion-2027", label: "Matriculación 2027" },
];

export default function FamiliaNav({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-16 flex-none bg-card border-b border-border flex items-center justify-between px-5 md:px-8">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.jpg" alt="CNMRA" width={30} height={30} className="rounded object-contain" />
        <span className="font-display font-bold text-sm">CNMRA</span>
      </div>
      <nav className="hidden md:flex items-center gap-1">
        {links.map((l) => {
          const active = l.href === "/familia" ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3.5 py-2 rounded-lg text-[13.5px] font-medium ${active ? "bg-navy text-white" : "text-text-soft hover:text-text"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-[12.5px] text-text-soft hidden sm:inline">{nombre}</span>
        <button onClick={salir} className="text-[12.5px] text-teal font-medium">
          Salir
        </button>
      </div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around overflow-x-auto px-1">
        {links.map((l) => {
          const active = l.href === "/familia" ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`text-[10px] font-medium px-1 text-center shrink-0 ${active ? "text-navy" : "text-text-soft"}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
