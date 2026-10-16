import { supabase } from "@/integrations/supabase/client";

// Typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthAuthorizationDetails = {
  client?: { name?: string; redirect_uris?: string[] } | null;
  scope?: string | null;
  redirect_url?: string;
  redirect_to?: string;
};

type OAuthNamespace = {
  getAuthorizationDetails(id: string): Promise<{ data: OAuthAuthorizationDetails | null; error: Error | null }>;
  approveAuthorization(id: string): Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
  denyAuthorization(id: string): Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
};

export const oauth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
