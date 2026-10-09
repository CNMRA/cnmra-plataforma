import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InstitucionSidebar from "@/components/InstitucionSidebar";

export default async function InstitucionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || (perfil.rol !== "director" && perfil.rol !== "carga_datos")) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <InstitucionSidebar nombre={perfil.nombre_completo} rol={perfil.rol} />
      <div className="flex-1 p-8 overflow-x-hidden">{children}</div>
    </div>
  );
}
