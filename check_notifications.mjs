import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rlgzxlcszitwxdvhutwy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZ3p4bGNzeml0d3hkdmh1dHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTkzMzUsImV4cCI6MjEwNTE5NTMzNX0.y4MQbI67uJDQ5Tc7QB8yPbosN2VW2CFgQzmcfCJvX9U"
);

async function check() {
  const { data, error } = await supabase.from("notifications").select("*").limit(1);
  if (error) console.error(error.message);
  else console.log("Table exists");
}

check();
