const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

async function check() {
  const { data: pData, error: pErr } = await supabase.from('permintaan').select('count');
  console.log('Permintaan count:', pData, pErr);

  const { data: dData, error: dErr } = await supabase.from('daily_activities').select('count');
  console.log('Daily activities count:', dData, dErr);

  const { data: dSept } = await supabase.from('daily_activities').select('id, activity_date').gte('activity_date', '2026-09-01').lte('activity_date', '2026-09-30');
  console.log('Daily activities in Sept 2026:', dSept?.length);
}

check();
