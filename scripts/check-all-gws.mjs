// scripts/check-all-gws.mjs
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

async function checkAllGameweeks() {
  console.log('🔍 Checking ALL gameweeks in database...\n');

  try {
    // Check all fixtures
    const { data: allFixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('gw')
      .order('gw');
    
    if (fixturesError) throw fixturesError;
    
    const fixtureGws = [...new Set(allFixtures.map(f => f.gw))];
    console.log('🏟️  Gameweeks with fixtures:', fixtureGws);

    // Check all results
    const { data: allResults, error: resultsError } = await supabase
      .from('gw_results')
      .select('gw')
      .order('gw');
    
    if (resultsError) throw resultsError;
    
    const resultGws = [...new Set(allResults.map(r => r.gw))];
    console.log('🏆 Gameweeks with results:', resultGws);

    // Check all picks
    const { data: allPicks, error: picksError } = await supabase
      .from('picks')
      .select('gw')
      .order('gw');
    
    if (picksError) throw picksError;
    
    const pickGws = [...new Set(allPicks.map(p => p.gw))];
    console.log('🎯 Gameweeks with picks:', pickGws);

    // Check all submissions
    const { data: allSubmissions, error: submissionsError } = await supabase
      .from('gw_submissions')
      .select('gw')
      .order('gw');
    
    if (submissionsError) throw submissionsError;
    
    const submissionGws = [...new Set(allSubmissions.map(s => s.gw))];
    console.log('📝 Gameweeks with submissions:', submissionGws);

    // Check if there are any gameweeks other than 1
    const allGws = [...new Set([...fixtureGws, ...resultGws, ...pickGws, ...submissionGws])];
    const nonGw1 = allGws.filter(gw => gw !== 1);
    
    if (nonGw1.length > 0) {
      console.log(`\n❌ PROBLEM: Found data for gameweeks other than 1: ${nonGw1.join(', ')}`);
    } else {
      console.log(`\n✅ GOOD: Only GW1 data found in database`);
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkAllGameweeks();
