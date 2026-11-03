"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DOCENTES, formatoFecha, type ArchivoDocumento } from "@/lib/docentes";

type DocenteBasico = { id: string; nombre_completo: string };
type Legajo = {
  docente_id: string;
  enviado: boolean;
  enviado_en: string | null;
  habilitado_por_direccion: boolean;
  asignaciones: { curso_id: string; materia: string }[] | null;
};
type PlanAnual = { docente_id: string; curso_id: string | null; materia: string | null };

type FilaLegajo = {
  docente: DocenteBasico;
  estado: "sin_empezar" | "borrador" | "enviado";
  habilitado: boolean;
  materias: number;
  anuales: number;
  enviadoEn: string | null;
};

const ETIQUETA_ESTADO = {
  sin_empezar: { texto: "Sin empezar", clase: "bg-red-50 text-danger border-red-200" },
  borrador: { texto: "Borrador", clase: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  enviado: { texto: "Enviado", clase: "bg-green-50 text-teal border-green-200" },
};

function Legajos({ soloLectura }: { soloLectura: boolean }) {
  const supabase = createClient();
  const [cargando, setCargando] = useState(true);
  const [esDirector, setEsDirector] = useState(false);
  const [filas, setFilas] = useState<FilaLegajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sin_empezar" | "borrador" | "enviado">("todos");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: perfil } = await supabase.from("perfiles").select("rol, acompanamiento").eq("id", user.id).single();
    const permitido = perfil?.rol === "director" || (perfil?.rol === "carga_datos" && perfil?.acompanamiento === true);
    if (!permitido) {
      setEsDirector(false);
      setCargando(false);
      return;
    }
    setEsDirector(true);

    const [{ data: docentes }, { data: legajos }, { data: planes }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre_completo").eq("rol", "docente").order("nombre_completo"),
      supabase
        .from("legajos_docentes")
        .select("docente_id, enviado, enviado_en, habilitado_por_direccion, asignaciones"),
      supabase.from("documentos_docentes").select("docente_id, curso_id, materia").eq("tipo", "plan_anual"),
    ]);

    const legajoDe = new Map<string, Legajo>();
    ((legajos as Legajo[] | null) ?? []).forEach((l) => legajoDe.set(l.docente_id, l));

    const anualesDe = new Map<string, Set<string>>();
    ((planes as PlanAnual[] | null) ?? []).forEach((p) => {
      const set = anualesDe.get(p.docente_id) ?? new Set<string>();
      set.add(`${p.curso_id}|${p.materia}`);
      anualesDe.set(p.docente_id, set);
    });

    const lista: FilaLegajo[] = ((docentes as DocenteBasico[] | null) ?? []).map((d) => {
      const l = legajoDe.get(d.id);
      const asignaciones = l?.asignaciones ?? [];
      const claves = new Set(asignaciones.map((a) => `${a.curso_id}|${a.materia}`));
      const subidos = anualesDe.get(d.id) ?? new Set<string>();
      let anuales = 0;
      claves.forEach((c) => {
        if (subidos.has(c)) anuales++;
      });
      return {
        docente: d,
        estado: !l ? "sin_empezar" : l.enviado ? "enviado" : "borrador",
        habilitado: Boolean(l && (l.enviado || l.habilitado_por_direccion)),
        materias: claves.size,
        anuales,
        enviadoEn: l?.enviado_en ?? null,
      };
    });
    setFilas(lista);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de legajos
    cargar();
  }, [cargar]);

  async function habilitar(f: FilaLegajo) {
    if (
      !window.confirm(
        `¿Habilitar a ${f.docente.nombre_completo} para subir planes sin que termine su legajo?`
      )
    )
      return;
    setMensaje(null);
    const { error } = await supabase
      .from("legajos_docentes")
      .upsert(
        { docente_id: f.docente.id, habilitado_por_direccion: true, actualizado_en: new Date().toISOString() },
        { onConflict: "docente_id" }
      );
    if (error) {
      setMensaje("No se pudo habilitar: " + error.message);
      return;
    }
    cargar();
  }

  const visibles = useMemo(() => {
    const q = busqueda
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return filas.filter((f) => {
      if (filtro !== "todos" && f.estado !== filtro) return false;
      if (!q) return true;
      return f.docente.nombre_completo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q);
    });
  }, [filas, busqueda, filtro]);

  const total = filas.length;
  const enviados = filas.filter((f) => f.estado === "enviado").length;
  const borradores = filas.filter((f) => f.estado === "borrador").length;
  const sinEmpezar = filas.filter((f) => f.estado === "sin_empezar").length;

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;
  if (!esDirector) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm">
        Solo Dirección puede ver esta sección.
      </div>
    );
  }

  const botonFiltro = (valor: typeof filtro, texto: string, cantidad: number) => (
    <button
      key={valor}
      onClick={() => setFiltro(valor)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium border ${
        filtro === valor ? "bg-navy text-white border-navy" : "bg-card border-border text-text-soft"
      }`}
    >
      {texto} ({cantidad})
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-soft">
        {enviados} de {total} legajos enviados.
      </p>

      {mensaje && <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{mensaje}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {botonFiltro("todos", "Todos", total)}
        {botonFiltro("enviado", "Enviados", enviados)}
        {botonFiltro("borrador", "Borrador", borradores)}
        {botonFiltro("sin_empezar", "Sin empezar", sinEmpezar)}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="h-9 rounded-lg border border-border px-3 text-sm bg-bg ml-auto w-full sm:w-56"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-text-soft bg-bg">
            <tr>
              <th className="px-4 py-2.5">Docente</th>
              <th className="px-4 py-2.5">Legajo</th>
              <th className="px-4 py-2.5">Materias</th>
              <th className="px-4 py-2.5">Planes anuales</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const e = ETIQUETA_ESTADO[f.estado];
              return (
                <tr key={f.docente.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{f.docente.nombre_completo}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${e.clase}`}>
                      {e.texto}
                    </span>
                    {f.estado !== "enviado" && f.habilitado && (
                      <span className="text-[11px] text-text-soft ml-2">habilitado por Dirección</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{f.materias}</td>
                  <td className="px-4 py-2.5">
                    {f.materias === 0 ? "—" : `${f.anuales} de ${f.materias}`}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {!f.habilitado && !soloLectura && (
                      <button onClick={() => habilitar(f)} className="text-xs text-navy font-medium mr-3">
                        Habilitar
                      </button>
                    )}
                    <Link href={`/institucion/legajos/${f.docente.id}`} className="text-xs text-navy font-semibold">
                      Ver legajo →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-soft">
                  No hay docentes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Docente = { id: string; nombre_completo: string; usuario: string };
type Fila = { ci: string; nombres: string; apellidos: string; nombre_completo: string; usuario: string; error?: string };
type Resultado = { nombre_completo: string; usuario: string; password: string; ok: boolean; error?: string };

function sinTildes(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function primeraPalabra(t: string): string {
  return sinTildes(t.trim().toLowerCase().split(/\s+/)[0] ?? "").replace(/[^a-z0-9]/g, "");
}

function interpretar(texto: string): Fila[] {
  const filas: Fila[] = [];
  const usados = new Map<string, number>();
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const partes = linea.split(/[;\t]/).map((p) => p.trim());
    const [ciCrudo = "", nombres = "", apellidos = ""] = partes;
    const ci = ciCrudo.replace(/\D/g, "");
    const base = `${primeraPalabra(nombres)}.${primeraPalabra(apellidos)}`;
    const veces = (usados.get(base) ?? 0) + 1;
    usados.set(base, veces);
    const usuario = veces === 1 ? base : `${base}${String(veces).padStart(2, "0")}`;
    let error: string | undefined;
    if (partes.length < 3 || !nombres || !apellidos) error = "Faltan datos (usá: CI;Nombres;Apellidos)";
    else if (ci.length < 6) error = "CI con menos de 6 números";
    filas.push({ ci, nombres, apellidos, nombre_completo: `${nombres} ${apellidos}`.trim(), usuario, error });
  }
  return filas;
}

function Cuentas() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const filas = useMemo(() => interpretar(texto), [texto]);
  const validas = filas.filter((f) => !f.error);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/docentes", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) {
      setErrorLista(j.error ?? "No se pudo cargar la lista.");
    } else {
      setErrorLista(null);
      setDocentes(j.docentes ?? []);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de docentes
    cargar();
  }, [cargar]);

  async function crear() {
    if (validas.length === 0) return;
    if (!window.confirm(`¿Crear ${validas.length} cuentas de docentes?`)) return;
    setCreando(true);
    setMensaje(null);
    setResultados(null);
    const r = await fetch("/api/docentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docentes: validas.map((f) => ({ nombre_completo: f.nombre_completo, usuario: f.usuario, ci: f.ci })),
      }),
    });
    const j = await r.json();
    setCreando(false);
    if (!r.ok) {
      setMensaje(j.error ?? "No se pudieron crear las cuentas.");
      return;
    }
    setResultados(j.resultados as Resultado[]);
    setTexto("");
    cargar();
  }

  async function cambiarClave(d: Docente) {
    const nueva = window.prompt(`Nueva contraseña para ${d.nombre_completo} (mínimo 6 caracteres):`);
    if (!nueva) return;
    setMensaje(null);
    const r = await fetch("/api/docentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "clave", id: d.id, password: nueva }),
    });
    const j = await r.json();
    setMensaje(r.ok ? `Contraseña de ${d.nombre_completo} cambiada.` : (j.error ?? "No se pudo cambiar."));
  }

  function copiarResultados() {
    if (!resultados) return;
    const t = resultados
      .map((x) => `${x.nombre_completo}\t${x.ok ? x.usuario : "ERROR: " + x.error}\t${x.ok ? x.password : ""}`)
      .join("\n");
    navigator.clipboard.writeText("Nombre\tUsuario\tContraseña\n" + t);
    setMensaje("Lista copiada. Podés pegarla en un Excel o Word.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-text-soft">
          Creá las cuentas de los docentes. El usuario es <b>primernombre.primerapellido</b> y la contraseña inicial es
          su número de CI.
        </p>
      </div>

      {mensaje && (
        <div className="text-sm bg-card border border-border rounded-lg px-3 py-2">{mensaje}</div>
      )}

      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Crear cuentas en bloque</h2>
        <p className="text-xs text-text-soft">
          Pegá una línea por docente con este formato: <b>CI;Nombres;Apellidos</b> (separado por punto y coma).
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          placeholder={"3526200;Andrea Veronica;Aguayo Jara\n2522481;Fatima Marlene;Aguero Leon"}
          className="rounded-lg border border-border p-3 text-sm bg-bg font-mono focus:outline-none focus:border-teal"
        />

        {filas.length > 0 && (
          <>
            <div className="text-sm">
              {validas.length} listos para crear
              {filas.length - validas.length > 0 && (
                <span className="text-danger"> · {filas.length - validas.length} con problemas</span>
              )}
            </div>
            <div className="overflow-x-auto border border-border rounded-lg max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg text-text-soft text-left sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Contraseña (CI)</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{f.nombre_completo}</td>
                      <td className="px-3 py-1.5 font-mono">{f.usuario}</td>
                      <td className="px-3 py-1.5 font-mono">{f.ci}</td>
                      <td className={`px-3 py-1.5 ${f.error ? "text-danger" : "text-teal"}`}>{f.error ?? "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <button
          onClick={crear}
          disabled={creando || validas.length === 0}
          className="h-11 rounded-lg bg-navy text-white font-semibold text-sm disabled:opacity-50"
        >
          {creando ? "Creando cuentas… (puede tardar un minuto)" : `Crear ${validas.length} cuentas`}
        </button>
      </section>

      {resultados && (
        <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Resultado: {resultados.filter((r) => r.ok).length} creadas
              {resultados.some((r) => !r.ok) && (
                <span className="text-danger"> · {resultados.filter((r) => !r.ok).length} con error</span>
              )}
            </h2>
            <button onClick={copiarResultados} className="text-xs border border-border rounded-lg px-3 py-1.5">
              Copiar lista
            </button>
          </div>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-bg text-text-soft text-left">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Contraseña</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5">{r.nombre_completo}</td>
                    <td className="px-3 py-1.5 font-mono">{r.usuario}</td>
                    <td className="px-3 py-1.5 font-mono">{r.ok ? r.password : ""}</td>
                    <td className={`px-3 py-1.5 ${r.ok ? "text-teal" : "text-danger"}`}>{r.ok ? "Creada" : r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Docentes con cuenta ({docentes.length})</h2>
        {cargando ? (
          <p className="text-sm text-text-soft">Cargando…</p>
        ) : errorLista ? (
          <p className="text-sm text-danger">{errorLista}</p>
        ) : docentes.length === 0 ? (
          <p className="text-sm text-text-soft">Todavía no hay docentes.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {docentes.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{d.nombre_completo}</div>
                  <div className="text-xs text-text-soft font-mono">{d.usuario}</div>
                </div>
                <button onClick={() => cambiarClave(d)} className="text-xs text-navy font-medium">
                  Cambiar clave
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type CursoInfo = { id: string; grado: string; turno: string; enfasis: string | null };
type DocPlan = {
  id: string;
  docente_id: string;
  tipo: string;
  titulo: string;
  materia: string | null;
  curso_id: string | null;
  fecha: string;
  archivos: ArchivoDocumento[] | null;
};
type LegajoMaterias = { docente_id: string; asignaciones: { curso_id: string; materia: string }[] | null };
type DatosPlanes = {
  docentes: DocenteBasico[];
  legajos: LegajoMaterias[];
  cursos: CursoInfo[];
  docs: DocPlan[];
};
type ItemMateria = { clave: string; curso: string; materia: string; docs: DocPlan[]; enLegajo: boolean };

function Planes({ tipos, nombre }: { tipos: string[]; nombre: string }) {
  const supabase = createClient();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosPlanes | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "entrego" | "parcial" | "no">("todos");

  const clavesTipos = tipos.join(",");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [d, l, c, p] = await Promise.all([
        supabase.from("perfiles").select("id, nombre_completo").eq("rol", "docente").order("nombre_completo"),
        supabase.from("legajos_docentes").select("docente_id, asignaciones"),
        supabase.from("cursos").select("id, grado, turno, enfasis"),
        supabase
          .from("documentos_docentes")
          .select("id, docente_id, tipo, titulo, materia, curso_id, fecha, archivos")
          .in("tipo", clavesTipos.split(","))
          .order("fecha", { ascending: false }),
      ]);
      if (!vivo) return;
      const fallo = d.error || l.error || c.error || p.error;
      if (fallo) setError(fallo.message);
      else
        setDatos({
          docentes: (d.data as DocenteBasico[]) ?? [],
          legajos: (l.data as LegajoMaterias[]) ?? [],
          cursos: (c.data as CursoInfo[]) ?? [],
          docs: (p.data as DocPlan[]) ?? [],
        });
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, clavesTipos]);

  const filas = useMemo(() => {
    if (!datos) return [];
    const etiquetaCurso = new Map<string, string>();
    datos.cursos.forEach((c) =>
      etiquetaCurso.set(c.id, `${c.grado} · ${c.turno}${c.enfasis ? " · " + c.enfasis : ""}`)
    );
    return datos.docentes.map((doc) => {
      const asign = datos.legajos.find((l) => l.docente_id === doc.id)?.asignaciones ?? [];
      const misDocs = datos.docs.filter((x) => x.docente_id === doc.id);
      const items = new Map<string, ItemMateria>();
      asign.forEach((a) => {
        const clave = `${a.curso_id}|${a.materia}`;
        items.set(clave, {
          clave,
          curso: etiquetaCurso.get(a.curso_id) ?? "Curso",
          materia: a.materia,
          docs: [],
          enLegajo: true,
        });
      });
      misDocs.forEach((x) => {
        const clave = `${x.curso_id}|${x.materia}`;
        const it = items.get(clave) ?? {
          clave,
          curso: x.curso_id ? (etiquetaCurso.get(x.curso_id) ?? "Curso") : "—",
          materia: x.materia ?? "(sin materia)",
          docs: [],
          enLegajo: false,
        };
        it.docs.push(x);
        items.set(clave, it);
      });
      const lista = Array.from(items.values());
      const requeridas = lista.filter((i) => i.enLegajo);
      const entregadas = requeridas.filter((i) => i.docs.length > 0).length;
      const estado: "sin_materias" | "entrego" | "parcial" | "no" =
        requeridas.length === 0
          ? "sin_materias"
          : entregadas === requeridas.length
            ? "entrego"
            : entregadas === 0
              ? "no"
              : "parcial";
      return { doc, lista, requeridas: requeridas.length, entregadas, estado };
    });
  }, [datos]);

  async function abrirArchivo(path: string) {
    const ventana = window.open("", "_blank");
    const { data, error: e } = await supabase.storage.from(BUCKET_DOCENTES).createSignedUrl(path, 120);
    if (e || !data) {
      ventana?.close();
      window.alert("No se pudo abrir el archivo.");
      return;
    }
    if (ventana) ventana.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  const visibles = filas.filter((f) => {
    if (filtro === "entrego" && f.estado !== "entrego") return false;
    if (filtro === "parcial" && f.estado !== "parcial") return false;
    if (filtro === "no" && f.estado !== "no" && f.estado !== "sin_materias") return false;
    const q = busqueda.trim().toLowerCase();
    return !q || sinTildes(f.doc.nombre_completo.toLowerCase()).includes(sinTildes(q));
  });

  const nEntrego = filas.filter((f) => f.estado === "entrego").length;
  const nParcial = filas.filter((f) => f.estado === "parcial").length;
  const nNo = filas.filter((f) => f.estado === "no" || f.estado === "sin_materias").length;

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  const ETQ = {
    entrego: { t: "Entregó", c: "bg-green-50 text-teal border-green-200" },
    parcial: { t: "Parcial", c: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    no: { t: "No entregó", c: "bg-red-50 text-danger border-red-200" },
    sin_materias: { t: "Sin materias cargadas", c: "bg-bg text-text-soft border-border" },
  };

  const boton = (v: typeof filtro, t: string, n: number) => (
    <button
      key={v}
      onClick={() => setFiltro(v)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium border ${
        filtro === v ? "bg-navy text-white border-navy" : "bg-card border-border text-text-soft"
      }`}
    >
      {t} ({n})
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-soft">
        {nombre}: {nEntrego} de {filas.length} docentes entregaron todas sus materias.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {boton("todos", "Todos", filas.length)}
        {boton("entrego", "Entregaron", nEntrego)}
        {boton("parcial", "Parcial", nParcial)}
        {boton("no", "No entregaron", nNo)}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="h-9 rounded-lg border border-border px-3 text-sm bg-bg ml-auto w-full sm:w-56"
        />
      </div>

      <div className="flex flex-col gap-2">
        {visibles.map((f) => {
          const e = ETQ[f.estado];
          const abre = abierto === f.doc.id;
          return (
            <div key={f.doc.id} className="bg-card border border-border rounded-xl">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-sm">{f.doc.nombre_completo}</div>
                  {f.requeridas > 0 && (
                    <div className="text-xs text-text-soft">
                      {f.entregadas} de {f.requeridas} materias con entrega
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${e.c}`}>{e.t}</span>
                <button
                  onClick={() => setAbierto(abre ? null : f.doc.id)}
                  className="text-xs text-navy font-semibold"
                >
                  {abre ? "Cerrar" : "Ver plan"}
                </button>
              </div>
              {abre && (
                <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
                  {f.lista.length === 0 && (
                    <p className="text-sm text-text-soft">Este docente todavía no cargó materias en su legajo.</p>
                  )}
                  {f.lista.map((it) => (
                    <div key={it.clave} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{it.materia}</span>
                        <span className="text-xs text-text-soft">{it.curso}</span>
                        <span
                          className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${
                            it.docs.length > 0
                              ? "bg-green-50 text-teal border-green-200"
                              : "bg-red-50 text-danger border-red-200"
                          }`}
                        >
                          {it.docs.length > 0 ? `${it.docs.length} entregado${it.docs.length > 1 ? "s" : ""}` : "No entregó"}
                        </span>
                      </div>
                      {it.docs.map((d) => (
                        <div key={d.id} className="mt-1.5 ml-3 pl-3 border-l-2 border-border">
                          <div className="text-[13px]">
                            {d.titulo}{" "}
                            <span className="text-xs text-text-soft">
                              · {d.tipo === "plan_semanal" ? "Semanal · " : tipos.length > 1 ? "Diario · " : ""}
                              {formatoFecha(new Date(d.fecha + "T00:00:00"))}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(d.archivos ?? []).map((a) => (
                              <button
                                key={a.path}
                                onClick={() => abrirArchivo(a.path)}
                                className="text-xs border border-border rounded-lg px-2.5 py-1 text-navy"
                              >
                                Abrir {a.nombre}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {visibles.length === 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-6 text-center text-sm text-text-soft">
            No hay docentes para mostrar.
