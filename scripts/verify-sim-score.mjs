import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifySimScore() {
  console.log('Verifying Sim\'s score...');
  
  // Get Sim's user ID
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'Sim')
    .single();
  
  if (!user) {
    console.log('Sim not found');
    return;
  }
  
  console.log('Sim ID:', user.id);
  
  // Get all of Sim's picks
  const { data: picks } = await supabase
    .from('picks')
    .select('gw, fixture_index, pick')
    .eq('user_id', user.id)
    .order('gw')
    .order('fixture_index');
  
  if (!picks) {
    console.log('No picks found for Sim');
    return;
  }
  
  console.log('\nSim\'s picks:');
  picks.forEach(p => console.log(`GW${p.gw} Fixture ${p.fixture_index}: ${p.pick}`));
  
  // Get all results
  const { data: results } = await supabase
    .from('gw_results')
    .select('gw, fixture_index, result')
    .order('gw')
    .order('fixture_index');
  
  if (!results) {
    console.log('No results found');
    return;
  }
  
  console.log('\nResults:');
  results.forEach(r => console.log(`GW${r.gw} Fixture ${r.fixture_index}: ${r.result}`));
  
  // Calculate Sim's score
  let correctPicks = 0;
  let totalPicks = 0;
  
  console.log('\n--- Score Calculation ---');
  for (const pick of picks) {
    const correspondingResult = results.find(
      r => r.gw === pick.gw && r.fixture_index === pick.fixture_index
    );
    
    if (correspondingResult) {
      totalPicks++;
      if (pick.pick === correspondingResult.result) {
        console.log(`✓ GW${pick.gw} Fixture ${pick.fixture_index}: ${pick.pick} = ${correspondingResult.result} (CORRECT)`);
        correctPicks++;
      } else {
        console.log(`✗ GW${pick.gw} Fixture ${pick.fixture_index}: ${pick.pick} ≠ ${correspondingResult.result} (WRONG)`);
      }
    } else {
      console.log(`- GW${pick.gw} Fixture ${pick.fixture_index}: No result found`);
    }
  }
  
  console.log(`\nSim's calculated score: ${correctPicks}`);
  console.log(`Total picks: ${totalPicks}`);
  console.log(`Expected score: 35`);
  
  if (correctPicks === 35) {
    console.log('✅ Sim\'s score is correct!');
  } else {
    console.log('❌ Sim\'s score is incorrect');
  }
}

verifySimScore().catch(console.error);

