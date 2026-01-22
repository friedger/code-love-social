import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create Supabase client with service role for database access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting session cleanup...");

    // Delete expired sessions from atproto_sessions
    // Sessions are expired when token_expires_at is in the past
    const { data: deletedSessions, error: sessionsError } = await supabase
      .from("atproto_sessions")
      .delete()
      .lt("token_expires_at", new Date().toISOString())
      .select("id");

    if (sessionsError) {
      console.error("Error deleting expired sessions:", sessionsError);
      throw new Error(`Failed to delete sessions: ${sessionsError.message}`);
    }

    const sessionsDeleted = deletedSessions?.length || 0;
    console.log(`Deleted ${sessionsDeleted} expired sessions`);

    // Delete expired OAuth state entries
    // State entries are expired when expires_at is in the past
    const { data: deletedStates, error: statesError } = await supabase
      .from("atproto_oauth_state")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (statesError) {
      console.error("Error deleting expired OAuth states:", statesError);
      throw new Error(`Failed to delete states: ${statesError.message}`);
    }

    const statesDeleted = deletedStates?.length || 0;
    console.log(`Deleted ${statesDeleted} expired OAuth states`);

    const result = {
      success: true,
      cleanup_time: new Date().toISOString(),
      sessions_deleted: sessionsDeleted,
      oauth_states_deleted: statesDeleted,
    };

    console.log("Cleanup completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
