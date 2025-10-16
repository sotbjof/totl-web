// scripts/clear-all-fake-data.mjs
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

async function clearAllFakeData() {
  console.log('🧹 NUCLEAR OPTION: Clearing ALL fake gameweek data...\n');

  try {
    // Delete ALL fixtures except GW 1
    console.log('🗑️  Deleting all fixtures except GW 1...');
    const { error: fixtureError } = await supabase
      .from('fixtures')
      .delete()
      .neq('gw', 1);
    if (fixtureError) throw fixtureError;
    console.log('✅ Deleted all non-GW1 fixtures');

    // Delete ALL results except GW 1
    console.log('🗑️  Deleting all results except GW 1...');
    const { error: resultError } = await supabase
      .from('gw_results')
      .delete()
      .neq('gw', 1);
    if (resultError) throw resultError;
    console.log('✅ Deleted all non-GW1 results');

    // Delete ALL picks except GW 1
    console.log('🗑️  Deleting all picks except GW 1...');
    const { error: pickError } = await supabase
      .from('picks')
      .delete()
      .neq('gw', 1);
    if (pickError) throw pickError;
    console.log('✅ Deleted all non-GW1 picks');

    // Delete ALL submissions except GW 1
    console.log('🗑️  Deleting all submissions except GW 1...');
    const { error: submissionError } = await supabase
      .from('gw_submissions')
      .delete()
      .neq('gw', 1);
    if (submissionError) throw submissionError;
    console.log('✅ Deleted all non-GW1 submissions');

    // Verify only GW1 remains
    console.log('\n🔍 Verifying only GW1 data remains...');
    const { data: remainingFixtures } = await supabase
      .from('fixtures')
      .select('gw');
    const { data: remainingResults } = await supabase
      .from('gw_results')
      .select('gw');
    const { data: remainingPicks } = await supabase
      .from('picks')
      .select('gw');
    const { data: remainingSubmissions } = await supabase
      .from('gw_submissions')
      .select('gw');

    const fixtureGws = [...new Set(remainingFixtures.map(f => f.gw))];
    const resultGws = [...new Set(remainingResults.map(r => r.gw))];
    const pickGws = [...new Set(remainingPicks.map(p => p.gw))];
    const submissionGws = [...new Set(remainingSubmissions.map(s => s.gw))];

    console.log('🏟️  Remaining fixture GWs:', fixtureGws);
    console.log('🏆 Remaining result GWs:', resultGws);
    console.log('🎯 Remaining pick GWs:', pickGws);
    console.log('📝 Remaining submission GWs:', submissionGws);

    const allRemainingGws = [...new Set([...fixtureGws, ...resultGws, ...pickGws, ...submissionGws])];
    
    if (allRemainingGws.length === 1 && allRemainingGws[0] === 1) {
      console.log('\n🎉 SUCCESS: Only GW1 data remains in the database!');
    } else {
      console.log(`\n❌ WARNING: Still have data for GWs: ${allRemainingGws.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
}

clearAllFakeData();
