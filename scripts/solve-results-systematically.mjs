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

async function solveResultsSystematically() {
  console.log('Solving for correct results systematically...\n');

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));
  
  // Get all picks for target users
  const allPicks = {};
  for (const userName of Object.keys(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) continue;

    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    if (picks) {
      allPicks[userName] = picks;
    }
  }

  // For each gameweek, we'll try to find the results that give the expected scores
  // We'll start with the current results and see how far off we are
  for (let gw = 1; gw <= 7; gw++) {
    console.log(`\n=== GW${gw} Analysis ===`);
    
    // Get current results
    const { data: currentResults } = await supabase
      .from('gw_results')
      .select('fixture_index, result')
      .eq('gw', gw)
      .order('fixture_index');

    if (!currentResults) continue;

    console.log('Current results:', currentResults.map(r => r.result).join(' '));
    
    // Calculate current scores for this GW
    const currentGwScores = {};
    for (const [userName, picks] of Object.entries(allPicks)) {
      let correct = 0;
      for (const pick of picks) {
        if (pick.gw === gw) {
          const result = currentResults.find(r => r.fixture_index === pick.fixture_index);
          if (result && pick.pick === result.result) {
            correct++;
          }
        }
      }
      currentGwScores[userName] = correct;
    }

    // Calculate total scores with current results
    const totalScores = {};
    for (const userName of Object.keys(expectedScores)) {
      let total = 0;
      for (let testGw = 1; testGw <= 7; testGw++) {
        if (testGw === gw) {
          total += currentGwScores[userName] || 0;
        } else {
          // Get score for other GWs
          const userPicks = allPicks[userName] || [];
          const { data: otherResults } = await supabase
            .from('gw_results')
            .select('fixture_index, result')
            .eq('gw', testGw)
            .order('fixture_index');
          
          if (otherResults) {
            let correct = 0;
            for (const pick of userPicks) {
              if (pick.gw === testGw) {
                const result = otherResults.find(r => r.fixture_index === pick.fixture_index);
                if (result && pick.pick === result.result) {
                  correct++;
                }
              }
            }
            total += correct;
          }
        }
      }
      totalScores[userName] = total;
    }

    console.log('Current total scores:');
    for (const [userName, score] of Object.entries(totalScores)) {
      const expected = expectedScores[userName];
      const diff = score - expected;
      console.log(`  ${userName}: ${score} (expected ${expected}, diff: ${diff > 0 ? '+' : ''}${diff})`);
    }

    // Calculate how many points we need to reduce for each user
    const reductionsNeeded = {};
    for (const [userName, currentTotal] of Object.entries(totalScores)) {
      const expected = expectedScores[userName];
      reductionsNeeded[userName] = currentTotal - expected;
    }

    console.log('\nReductions needed:');
    for (const [userName, reduction] of Object.entries(reductionsNeeded)) {
      console.log(`  ${userName}: -${reduction} points`);
    }

    // Show picks for each fixture to see which results would help
    console.log('\nFixture analysis:');
    for (let fixtureIndex = 0; fixtureIndex < 10; fixtureIndex++) {
      const picks = [];
      for (const [userName, userPicks] of Object.entries(allPicks)) {
        const pick = userPicks.find(p => p.gw === gw && p.fixture_index === fixtureIndex);
        if (pick) {
          picks.push({ userName, pick: pick.pick });
        }
      }
      
      const hCount = picks.filter(p => p.pick === 'H').length;
      const aCount = picks.filter(p => p.pick === 'A').length;
      const dCount = picks.filter(p => p.pick === 'D').length;
      const currentResult = currentResults[fixtureIndex]?.result;
      
      console.log(`Fixture ${fixtureIndex}: H=${hCount} A=${aCount} D=${dCount} (Current: ${currentResult})`);
      
      // Show which users would be affected by changing this result
      const affectedUsers = picks.filter(p => p.pick !== currentResult);
      if (affectedUsers.length > 0) {
        console.log(`  Changing to different result would affect: ${affectedUsers.map(u => u.userName).join(', ')}`);
      }
    }
  }
}

solveResultsSystematically().catch(console.error);

