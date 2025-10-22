import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Expected scores from the leaderboard image
const expectedScores = {
  'Phil Bolton': 38,
  'David Bird': 36, // David70 in image
  'Sim': 35,
  'Paul N': 33, // Paul in image
  'Carl': 32, // Carlios in image
  'Jof': 32,
  'gregory': 31, // Gregory in image
  'Matthew Bird': 31,
  'SP': 31,
  'Will Middleton': 29, // william middleton in image
  'ThomasJamesBird': 28, // Thomas Bird in image
  'Ben New': 26 // Ben in image
};

async function checkAllUserScores() {
  console.log('Checking OCP scores against expected leaderboard values...\n');

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));
  const actualScores = {};

  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) {
      console.log(`❌ User "${userName}" not found in database.`);
      actualScores[userName] = 'N/A';
      continue;
    }

    // Get all of user's picks up to GW7
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    if (picksError) {
      console.error(`Error fetching picks for ${userName}:`, picksError);
      actualScores[userName] = 'Error';
      continue;
    }

    // Get all results up to GW7
    const { data: results, error: resultsError } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
      actualScores[userName] = 'Error';
      continue;
    }

    // Calculate correct picks
    let correctPicks = 0;
    const resultsMap = new Map();
    results.forEach(r => {
      if (!resultsMap.has(r.gw)) {
        resultsMap.set(r.gw, new Map());
      }
      resultsMap.get(r.gw).set(r.fixture_index, r.result);
    });

    for (const pick of picks) {
      const correspondingResult = resultsMap.get(pick.gw)?.get(pick.fixture_index);
      if (correspondingResult && pick.pick === correspondingResult) {
        correctPicks++;
      }
    }
    
    actualScores[userName] = correctPicks;
  }

  console.log('--- SCORE COMPARISON ---');
  console.log('User | Expected | Actual | Status');
  console.log('-----|----------|--------|--------');
  
  let allMatch = true;
  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const actualScore = actualScores[userName];
    const status = actualScore === expectedScore ? '✅' : '❌';
    if (actualScore !== expectedScore) allMatch = false;
    
    console.log(`${userName.padEnd(20)} | ${expectedScore.toString().padEnd(8)} | ${actualScore.toString().padEnd(6)} | ${status}`);
  }
  
  console.log('\n--- SUMMARY ---');
  if (allMatch) {
    console.log('🎉 ALL SCORES MATCH THE LEADERBOARD!');
  } else {
    console.log('❌ Some scores do not match. Need to fix the data.');
  }
}

checkAllUserScores().catch(console.error);

