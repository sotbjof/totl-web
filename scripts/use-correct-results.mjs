import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct results extracted from the result images you provided
const correctResults = {
  gw1: ['H', 'H', 'H', 'A', 'H', 'A', 'H', 'H', 'A', 'H'], // From GW1 result image
  gw2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'], // From GW2 result image
  gw3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'], // From GW3 result image
  gw4: ['H', 'D', 'H', 'D', 'H', 'H', 'A', 'D', 'A', 'H'], // From GW4 result image
  gw5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'], // From GW5 result image
  gw6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'], // From GW6 result image
  gw7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']  // From GW7 result image
};

async function useCorrectResults() {
  console.log('Using the correct results from the result images you provided...\n');

  // Update each gameweek with the correct results from the images
  for (const [gwKey, results] of Object.entries(correctResults)) {
    const gwNumber = parseInt(gwKey.replace('gw', ''));
    console.log(`Updating GW${gwNumber} results...`);
    console.log('Correct results from image:', results.join(' '));
    
    // Delete existing results for the GW
    const { error: deleteError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteError) {
      console.error(`Error deleting GW${gwNumber} results:`, deleteError);
      continue;
    }
    
    // Insert correct results
    for (let i = 0; i < results.length; i++) {
      const { error: insertError } = await supabase
        .from('gw_results')
        .insert({
          gw: gwNumber,
          fixture_index: i,
          result: results[i]
        });
      
      if (insertError) {
        console.error(`Error inserting result ${i} for GW${gwNumber}:`, insertError);
      }
    }
    
    console.log(`GW${gwNumber} results updated successfully\n`);
  }
  
  console.log('All results updated with the correct data from your result images!');
  console.log('Now verifying the scores match the leaderboard...');
  
  // Verify the scores match the leaderboard
  const expectedScores = {
    'Phil Bolton': 38,
    'David Bird': 36,
    'Sim': 35,
    'Paul N': 33,
    'Carl': 32,
    'Jof': 32,
    'gregory': 31,
    'Matthew Bird': 31,
    'SP': 31,
    'Will Middleton': 29,
    'ThomasJamesBird': 28,
    'Ben New': 26
  };

  const { data: users } = await supabase
    .from('users')
    .select('id, name');

  const userMap = new Map(users.map(u => [u.name, u.id]));
  
  console.log('\n--- FINAL VERIFICATION ---');
  let allCorrect = true;
  
  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) continue;

    // Get all of user's picks up to GW7
    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Get all results up to GW7
    const { data: results } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

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
    
    const status = correctPicks === expectedScore ? '✅' : '❌';
    if (correctPicks !== expectedScore) allCorrect = false;
    
    console.log(`${userName.padEnd(20)}: ${correctPicks} (expected ${expectedScore}) ${status}`);
  }
  
  console.log('\n--- SUMMARY ---');
  if (allCorrect) {
    console.log('🎉 ALL SCORES NOW MATCH THE LEADERBOARD!');
  } else {
    console.log('❌ Some scores still do not match. Need to check the result images again.');
  }
}

useCorrectResults().catch(console.error);

