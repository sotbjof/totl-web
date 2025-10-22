import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// CSV name to database username mapping
const nameMapping = {
  'Matthew Bird': 'Matthew Bird',
  'Sim': 'Sim',
  'David Bird': 'David Bird',
  'David70': 'David Bird',
  'Phil Bolton': 'Phil Bolton',
  'Paul': 'Paul N',
  'Paul N': 'Paul N',
  'Gregory': 'gregory',
  'gregory': 'gregory',
  'SP': 'SP',
  'Carlios': 'Carl',
  'Carl': 'Carl',
  'CarlIos': 'Carl',
  'Jof': 'Jof',
  'william middleton': 'Will Middleton',
  'Will Middleton': 'Will Middleton',
  'Ben': 'Ben New',
  'Ben New': 'Ben New',
  'Thomas Bird': 'ThomasJamesBird',
  'ThomasJamesBird': 'ThomasJamesBird',
  'Jessica': 'Jessica',
  'Jolly Joel': 'Jolly Joel',
  'Joel': 'Jolly Joel',
  'EB': 'EB',
  'BoobyBomBom': 'BoobyBomBom'
};

function convertOutcomeToHDA(outcome) {
  const lower = outcome.toLowerCase().trim();
  if (lower === 'home win' || lower === 'h') return 'H';
  if (lower === 'away win' || lower === 'a') return 'A';
  if (lower === 'draw' || lower === 'd') return 'D';
  console.log(`Warning: Unknown outcome "${outcome}"`);
  return 'H';
}

function convertPredictionToHDA(prediction, fixture) {
  const predLower = prediction.toLowerCase().trim();
  
  if (predLower === 'draw' || predLower === 'd') {
    return 'D';
  }
  
  const teams = fixture.split(' v ');
  if (teams.length !== 2) {
    console.log(`Warning: Could not parse fixture "${fixture}"`);
    return 'H';
  }
  
  const homeTeam = teams[0].trim().toLowerCase();
  const awayTeam = teams[1].trim().toLowerCase();
  const predictedTeam = prediction.replace(/\s+win$/i, '').trim().toLowerCase();
  
  // Try exact match first
  if (predictedTeam === homeTeam) return 'H';
  if (predictedTeam === awayTeam) return 'A';
  
  // Try contains match
  if (homeTeam.includes(predictedTeam) || predictedTeam.includes(homeTeam.split(' ')[0])) return 'H';
  if (awayTeam.includes(predictedTeam) || predictedTeam.includes(awayTeam.split(' ')[0])) return 'A';
  
  // Try word matching
  const homeWords = homeTeam.split(' ').filter(w => w.length > 3);
  const awayWords = awayTeam.split(' ').filter(w => w.length > 3);
  const predWords = predictedTeam.split(' ').filter(w => w.length > 3);
  
  for (const word of predWords) {
    if (homeWords.some(hw => hw.includes(word) || word.includes(hw))) return 'H';
    if (awayWords.some(aw => aw.includes(word) || word.includes(aw))) return 'A';
  }
  
  console.log(`Warning: Could not match "${predictedTeam}" to home "${homeTeam}" or away "${awayTeam}"`);
  return 'H';
}

function parseCsvWithOutcomes(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Find the header line (contains fixtures)
  let headerEndIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\d+\/\d+\/\d+/)) {
      headerEndIndex = i;
      break;
    }
  }
  
  // Extract fixtures from header
  const fixtures = [];
  let headerText = '';
  for (let i = 0; i < headerEndIndex; i++) {
    headerText += lines[i] + '\n';
  }
  
  const fixtureMatches = headerText.matchAll(/"([^"]+)"/g);
  for (const match of fixtureMatches) {
    const text = match[1].split('\n')[0].trim();
    if (text.includes(' v ')) {
      fixtures.push(text);
    }
  }
  
  console.log(`  Found ${fixtures.length} fixtures`);
  
  // Find the Outcome row
  let outcomes = [];
  let outcomeLineIndex = -1;
  for (let i = headerEndIndex; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('outcome')) {
      outcomeLineIndex = i;
      const parts = lines[i].split(',');
      for (let j = 2; j < parts.length && j < 2 + fixtures.length; j++) {
        outcomes.push(convertOutcomeToHDA(parts[j]));
      }
      break;
    }
  }
  
  if (outcomes.length === 0) {
    console.log('  Warning: No outcomes found!');
    return { fixtures, outcomes: [], playerPicks: {} };
  }
  
  console.log(`  Outcomes: ${outcomes.join(' ')}`);
  
  // Parse player picks (between header and outcome row)
  const playerPicks = {};
  for (let i = headerEndIndex; i < lines.length; i++) {
    if (i === outcomeLineIndex) break;
    
    const line = lines[i];
    const parts = line.split(',');
    
    if (parts.length < 3) continue;
    
    const playerName = parts[1].trim();
    const picks = [];
    
    for (let j = 2; j < parts.length && j < 2 + fixtures.length; j++) {
      const prediction = parts[j].trim();
      const fixture = fixtures[j - 2];
      const hda = convertPredictionToHDA(prediction, fixture);
      picks.push(hda);
    }
    
    if (picks.length === fixtures.length) {
      playerPicks[playerName] = picks;
    }
  }
  
  return { fixtures, outcomes, playerPicks };
}

async function updateEverything() {
  console.log('Starting import with outcome rows...\n');

  // Get all users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));
  
  const gwFiles = {
    1: '/Users/jof/Desktop/GW1_clean_v2_with_outcomes_filled_v2.csv',
    2: '/Users/jof/Desktop/GW2_clean_v2_with_outcomes_filled_v2.csv',
    3: '/Users/jof/Desktop/GW3_clean_v2_with_outcomes_filled_v2.csv',
    4: '/Users/jof/Desktop/GW4_clean_v2_with_outcomes_filled_v2.csv',
    5: '/Users/jof/Desktop/GW5_clean_v2_with_outcomes_filled_v2.csv',
    6: '/Users/jof/Desktop/GW6_clean_v2_with_outcomes_filled_v2.csv',
    7: '/Users/jof/Desktop/GW7_clean_v2_with_outcomes_filled_v2.csv'
  };
  
  // Step 1: Parse all data
  const allData = {};
  for (const [gw, filePath] of Object.entries(gwFiles)) {
    console.log(`\nReading GW${gw} from ${filePath}...`);
    try {
      const data = parseCsvWithOutcomes(filePath);
      allData[gw] = data;
      
      console.log(`  Found ${Object.keys(data.playerPicks).length} players`);
      for (const [playerName, picks] of Object.entries(data.playerPicks)) {
        const dbName = nameMapping[playerName];
        if (dbName) {
          console.log(`    ${dbName} (${playerName}): ${picks.join(' ')}`);
        } else {
          console.log(`    ⚠️  ${playerName}: Not in mapping - SKIPPING`);
        }
      }
    } catch (error) {
      console.error(`Error reading GW${gw}:`, error.message);
    }
  }
  
  // Step 2: Update results in database
  console.log('\n=== UPDATING RESULTS ===');
  for (const [gw, data] of Object.entries(allData)) {
    const gwNumber = parseInt(gw);
    console.log(`Updating GW${gwNumber} results: ${data.outcomes.join(' ')}`);
    
    // Delete existing results
    await supabase.from('gw_results').delete().eq('gw', gwNumber);
    
    // Insert new results
    for (let i = 0; i < data.outcomes.length; i++) {
      await supabase.from('gw_results').insert({
        gw: gwNumber,
        fixture_index: i,
        result: data.outcomes[i]
      });
    }
  }
  
  // Step 3: Update picks in database
  console.log('\n=== UPDATING PICKS ===');
  
  // Collect all picks by player
  const allPlayerPicks = {};
  for (const [gw, data] of Object.entries(allData)) {
    for (const [csvName, picks] of Object.entries(data.playerPicks)) {
      const dbName = nameMapping[csvName];
      if (!dbName) continue;
      
      if (!allPlayerPicks[dbName]) {
        allPlayerPicks[dbName] = {};
      }
      allPlayerPicks[dbName][gw] = picks;
    }
  }
  
  for (const [dbName, gwPicks] of Object.entries(allPlayerPicks)) {
    const userId = userMap.get(dbName);
    if (!userId) {
      console.log(`⚠️  User ${dbName} not found in database - SKIPPING`);
      continue;
    }
    
    console.log(`\nUpdating ${dbName}...`);
    
    for (const [gw, picks] of Object.entries(gwPicks)) {
      const gwNumber = parseInt(gw);
      
      // Delete existing picks
      await supabase.from('picks').delete().eq('user_id', userId).eq('gw', gwNumber);
      
      // Insert new picks
      for (let i = 0; i < picks.length; i++) {
        await supabase.from('picks').insert({
          user_id: userId,
          gw: gwNumber,
          fixture_index: i,
          pick: picks[i]
        });
      }
      
      // Upsert submission
      await supabase.from('gw_submissions').upsert({
        user_id: userId,
        gw: gwNumber,
        submitted_at: new Date().toISOString()
      }, { onConflict: 'user_id,gw' });
      
      console.log(`  GW${gwNumber} updated`);
    }
  }
  
  // Step 4: Verify scores against leaderboard
  console.log('\n=== VERIFYING SCORES ===');
  
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
    'Ben New': 26,
    'Jolly Joel': 7,
    'BoobyBomBom': 6,
    'EB': 6,
    'Jessica': 5
  };
  
  let allCorrect = true;
  
  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) {
      console.log(`${userName.padEnd(20)}: Not found in database`);
      continue;
    }

    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    const { data: results } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    let correctPicks = 0;
    const resultsMap = new Map();
    results.forEach(r => {
      if (!resultsMap.has(r.gw)) {
        resultsMap.set(r.gw, new Map());
      }
      resultsMap.get(r.gw).set(r.fixture_index, r.result);
    });

    for (const pick of picks) {
      const result = resultsMap.get(pick.gw)?.get(pick.fixture_index);
      if (result && pick.pick === result) {
        correctPicks++;
      }
    }
    
    const status = correctPicks === expectedScore ? '✅' : '❌';
    if (correctPicks !== expectedScore) allCorrect = false;
    
    console.log(`${userName.padEnd(20)}: ${correctPicks} (expected ${expectedScore}) ${status}`);
  }
  
  console.log('\n=== SUMMARY ===');
  if (allCorrect) {
    console.log('🎉 SUCCESS! All scores match the leaderboard!');
  } else {
    console.log('❌ Some scores do not match. Review the output above.');
  }
}

updateEverything().catch(console.error);
