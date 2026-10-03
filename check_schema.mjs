import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rlgzxlcszitwxdvhutwy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZ3p4bGNzeml0d3hkdmh1dHd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYxOTMzNSwiZXhwIjoyMTA1MTk1MzM1fQ.mixBsEvjZNrMZ6J5Tm3PWPgG69LI8ISkZB4THxZeI_4"
);

async function check() {
  const { data, error } = await supabase.from("notifications").select("*").limit(1);
  if (error) { console.error(error); return; }
  if (data && data.length > 0) {
    console.log(data);
  } else {
    console.log("Empty data in notifications");
  }
}

check();
