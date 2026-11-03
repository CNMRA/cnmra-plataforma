"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export default function CuentasAcceso() {
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
