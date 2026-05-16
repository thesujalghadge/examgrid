import { createSupabaseClientFromEnv, isSupabaseConfigured } from "./client";

export type SupabaseConnectionStatus =
  | "connected"
  | "not_configured"
  | "connection_failed";

export interface SupabaseStatusReport {
  configured: boolean;
  urlLoaded: boolean;
  anonKeyLoaded: boolean;
  connection: SupabaseConnectionStatus;
  message: string;
  checkedAt: string;
}

/**
 * Lightweight connectivity check via Supabase REST root.
 * Does not require any application tables.
 */
export async function checkSupabaseConnection(): Promise<SupabaseStatusReport> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const urlLoaded = url.length > 0;
  const anonKeyLoaded = anonKey.length > 0;
  const configured = isSupabaseConfigured();

  if (!configured) {
    return {
      configured: false,
      urlLoaded,
      anonKeyLoaded,
      connection: "not_configured",
      message:
        "Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });

    if (response.ok || response.status === 401 || response.status === 404) {
      return {
        configured: true,
        urlLoaded,
        anonKeyLoaded,
        connection: "connected",
        message:
          "Successfully reached Supabase REST API. Project is reachable with the configured anon key.",
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      configured: true,
      urlLoaded,
      anonKeyLoaded,
      connection: "connection_failed",
      message: `Supabase returned HTTP ${response.status}. Verify project URL and anon key.`,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown network error";
    return {
      configured: true,
      urlLoaded,
      anonKeyLoaded,
      connection: "connection_failed",
      message: `Could not reach Supabase: ${detail}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

/** Client-side check using the JS client (for admin UI in browser). */
export async function checkSupabaseConnectionClient(): Promise<SupabaseStatusReport> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const urlLoaded = url.length > 0;
  const anonKeyLoaded = anonKey.length > 0;

  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      urlLoaded,
      anonKeyLoaded,
      connection: "not_configured",
      message:
        "Supabase environment variables are missing in the client bundle. Restart dev server after updating .env.local.",
      checkedAt: new Date().toISOString(),
    };
  }

  const client = createSupabaseClientFromEnv();
  if (!client) {
    return {
      configured: false,
      urlLoaded,
      anonKeyLoaded,
      connection: "not_configured",
      message: "Failed to initialize Supabase client.",
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const { error } = await client.auth.getSession();
    if (error && !error.message.toLowerCase().includes("session")) {
      return {
        configured: true,
        urlLoaded,
        anonKeyLoaded,
        connection: "connection_failed",
        message: error.message,
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      configured: true,
      urlLoaded,
      anonKeyLoaded,
      connection: "connected",
      message:
        "Supabase client initialized and auth endpoint responded successfully.",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown client error";
    return {
      configured: true,
      urlLoaded,
      anonKeyLoaded,
      connection: "connection_failed",
      message: detail,
      checkedAt: new Date().toISOString(),
    };
  }
}
