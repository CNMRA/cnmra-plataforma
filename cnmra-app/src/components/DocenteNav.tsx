"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/docente", label: "Mis documentos" },
  { href: "/docente/subir", label: "Subir documento" },
  { href: "/docente/cuenta", label: "Mi cuenta" },
];

export default function DocenteNav({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="bg-navy-dark text-white print:hidden">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.jpg" alt="CNMRA" width={32} height={32} className="rounded object-contain" />
          <div className="leading-tight">
            <div className="font-display font-bold text-sm">CNMRA · Docentes</div>
            <div className="text-[11px] text-white/60">{nombre}</div>
          </div>
        </div>
        <button onClick={salir} className="text-white/60 hover:text-white text-[12px]">
          Salir
        </button>
      </div>
      <nav className="max-w-4xl mx-auto px-4 md:px-8 pb-2 flex flex-wrap gap-1">
        {links.map((l) => {
          const activo = l.href === "/docente" ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-medium ${
                activo ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
