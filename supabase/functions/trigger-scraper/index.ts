// Supabase Edge Function (Deno): dispara el workflow del scraper en GitHub Actions.
//
// Solo un administrador con sesión válida puede invocarla: se verifica el token de
// sesión de la app (cabecera `x-session-token`) llamando a la RPC `validar_sesion`.
//
// Secrets requeridos (supabase secrets set ...):
//   GITHUB_PAT       token con permiso `actions:write` sobre el repositorio
//   GITHUB_REPO      "propietario/repositorio" que contiene el workflow del scraper
//   GITHUB_WORKFLOW  nombre del archivo del workflow (p. ej. "scraper.yml")
//   GITHUB_REF       (opcional) rama a ejecutar; por defecto "main"
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase automáticamente.
//
// Despliegue:  supabase functions deploy trigger-scraper

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sessionToken = req.headers.get("x-session-token");
  if (!sessionToken) return json({ error: "unauthorized" }, 401);

  // 1. Verificar que la sesión pertenece a un administrador.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { "x-session-token": sessionToken } } },
  );
  const { data, error } = await supabase.rpc("validar_sesion");
  if (error || !data?.ok || data.usuario?.rol !== "admin") {
    return json({ error: "forbidden" }, 403);
  }

  // 2. Disparar el workflow.
  const pat = Deno.env.get("GITHUB_PAT");
  const repo = Deno.env.get("GITHUB_REPO");
  const workflow = Deno.env.get("GITHUB_WORKFLOW");
  const ref = Deno.env.get("GITHUB_REF") ?? "main";
  if (!pat || !repo || !workflow) return json({ error: "not_configured" }, 500);

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (!res.ok) {
    console.error("GitHub respondió", res.status, await res.text());
    return json({ error: "github_error", status: res.status }, 502);
  }
  return json({ ok: true });
});
