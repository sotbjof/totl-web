// scripts/check-db.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking database contents...\n');

  try {
    // Check meta table
    const { data: meta, error: metaError } = await supabase
      .from('meta')
      .select('*');
    
    if (metaError) throw metaError;
    console.log('📊 Meta table:', meta);

    // Check fixtures for GW 1
    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 1);
    
    if (fixturesError) throw fixturesError;
    console.log(`\n🏟️  GW1 Fixtures (${fixtures.length}):`, fixtures);

    // Check results for GW 1
    const { data: results, error: resultsError } = await supabase
      .from('gw_results')
      .select('*')
      .eq('gw', 1);
    
    if (resultsError) throw resultsError;
    console.log(`\n🏆 GW1 Results (${results.length}):`, results);

    // Check picks for GW 1
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .eq('gw', 1);
    
    if (picksError) throw picksError;
    console.log(`\n🎯 GW1 Picks (${picks.length}):`, picks);

    // Check submissions for GW 1
    const { data: submissions, error: submissionsError } = await supabase
      .from('gw_submissions')
      .select('*')
      .eq('gw', 1);
    
    if (submissionsError) throw submissionsError;
    console.log(`\n📝 GW1 Submissions (${submissions.length}):`, submissions);

  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkDatabase();
