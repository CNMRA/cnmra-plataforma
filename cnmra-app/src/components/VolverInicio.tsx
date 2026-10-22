"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function VolverInicio() {
  const pathname = usePathname();
  if (pathname === "/familia") return null;

  return (
    <Link href="/familia" className="inline-flex items-center gap-1 text-sm text-teal font-medium">
      ← Volver a Inicio
    </Link>
  );
}
