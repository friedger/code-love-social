import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get the origin from the request or use a default
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") || "https://id-preview--1b195c5a-8f47-408d-a1ce-3f2eea104bbf.lovable.app";

  const clientMetadata = {
    client_id: `${Deno.env.get("SUPABASE_URL")}/functions/v1/client-metadata?origin=${encodeURIComponent(origin)}`,
    client_name: "Clarity Social",
    client_uri: origin,
    redirect_uris: [`${origin}/oauth/callback`],
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };

  return new Response(JSON.stringify(clientMetadata), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
