import { getAuthorizedContext } from "@/lib/supabase/authorization";

export async function getUserManagementAdminClient() {
  return getAuthorizedContext(["admin"]);
}