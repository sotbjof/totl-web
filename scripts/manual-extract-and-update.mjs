import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct results extracted from all the result sheets
const correctResults = {
  1: ['H', 'D', 'D', 'H', 'H', 'A', 'D', 'H', 'A', 'H'],
  2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'],
  3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'],
  4: ['H', 'H', 'D', 'D', 'H', 'H', 'A', 'D', 'A', 'H'],
  5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'],
  6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'],
  7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']
};

// CSV name to database username mapping
const nameMapping = {
  'Matthew Bird': 'Matthew Bird',
  'Sim': 'Sim',
  'David70': 'David Bird',
  'Phil Bolton': 'Phil Bolton',
  'Paul': 'Paul N',
  'Gregory': 'gregory',
  'SP': 'SP',
  'Carlios': 'Carl',
  'Carl': 'Carl',
  'CarlIos': 'Carl',
  'Jof': 'Jof',
  'william middleton': 'Will Middleton',
  'Ben': 'Ben New',
  'Thomas Bird': 'ThomasJamesBird'
};

// GW1 fixtures for reference
const gw1Fixtures = [
  'Liverpool v AFC Bournemouth',
  'Aston Villa v Newcastle United',
  'Brighton & Hove Albion v Fulham',
  'Sunderland v West Ham United',
  'Tottenham Hotspur v Burnley',
  'Wolverhampton Wanderers v Manchester City',
  'Chelsea v Crystal Palace',
  'Nottingham Forest v Brentford',
  'Manchester United v Arsenal',
  'Leeds United v Everton'
];

function convertPredictionToHDA(prediction, fixture) {
  const predLower = prediction.toLowerCase().trim();
  
  // Check if it's a draw
  if (predLower === 'draw' || predLower === 'd') {
    return 'D';
  }
  
  // Parse fixture to get home and away teams
  const teams = fixture.split(' v ');
  if (teams.length !== 2) {
    console.log(`Warning: Could not parse fixture "${fixture}"`);
    return 'H'; // Default
  }
  
  const homeTeam = teams[0].trim().toLowerCase();
  const awayTeam = teams[1].trim().toLowerCase();
  
  // Extract team name from prediction (everything before " win")
  const predictedTeam = prediction.replace(/\s+win$/i, '').trim().toLowerCase();
  
  // Check if predicted team matches home or away team
  if (predictedTeam === homeTeam || homeTeam.includes(predictedTeam) || predictedTeam.includes(homeTeam.substring(0, 10))) {
    return 'H';
  } else if (predictedTeam === awayTeam || awayTeam.includes(predictedTeam) || predictedTeam.includes(awayTeam.substring(0, 10))) {
    return 'A';
  } else {
    console.log(`Warning: Could not match "${predictedTeam}" to home "${homeTeam}" or away "${awayTeam}"`);
    return 'H'; // Default to home if unclear
  }
}

function parseSimpleCsv(filePath, fixtures) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const playerPicks = {};
  
  // Find where data lines start (after the header)
  let dataStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    // Data lines start with a timestamp like "8/14/2025"
    if (lines[i].match(/^\d+\/\d+\/\d+/)) {
      dataStartIndex = i;
      break;
    }
  }
  
  // Parse each data line
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    
    if (parts.length < 3) continue;
    
    const playerName = parts[1].trim();
    const predictions = parts.slice(2);
    
    const picks = [];
    for (let j = 0; j < Math.min(predictions.length, fixtures.length); j++) {
      const prediction = predictions[j].trim();
      const fixture = fixtures[j];
      const hda = convertPredictionToHDA(prediction, fixture);
      picks.push(hda);
    }
    
    if (picks.length === fixtures.length) {
      playerPicks[playerName] = picks;
    }
  }
  
  return playerPicks;
}

async function updateEverything() {
  console.log('Starting update with manual extraction...\n');

  // Get all users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));
  
  // Step 1: Update all results
  console.log('=== UPDATING RESULTS ===');
  for (const [gw, results] of Object.entries(correctResults)) {
    const gwNumber = parseInt(gw);
    console.log(`Updating GW${gwNumber} results: ${results.join(' ')}`);
    
    // Delete existing results
    const { error: deleteError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteError) {
      console.error(`Error deleting GW${gwNumber} results:`, deleteError);
      continue;
    }
    
    // Insert new results
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
    
    console.log(`GW${gwNumber} results updated successfully`);
  }
  
  // Step 2: Read and update picks from CSV files
  console.log('\n=== UPDATING PICKS FROM CSV FILES ===');
  
  const gwFixtures = {
    1: gw1Fixtures,
    // For other GWs, we'll extract fixtures from the first line
  };
  
  const gwFiles = {
    1: '/Users/jof/Desktop/GW1.csv',
    2: '/Users/jof/Desktop/GW2.csv',
    3: '/Users/jof/Desktop/GW3.csv',
    4: '/Users/jof/Desktop/GW4.csv',
    5: '/Users/jof/Desktop/GW5.csv',
    6: '/Users/jof/Desktop/GW6.csv',
    7: '/Users/jof/Desktop/GW7.csv'
  };
  
  // Collect all picks by player
  const allPlayerPicks = {};
  
  for (const [gw, filePath] of Object.entries(gwFiles)) {
    console.log(`\nReading GW${gw} from ${filePath}...`);
    
    try {
      const fixtures = gwFixtures[gw] || gw1Fixtures; // Use GW1 fixtures as template
      const playerPicks = parseSimpleCsv(filePath, fixtures);
      
      for (const [csvName, picks] of Object.entries(playerPicks)) {
        const dbName = nameMapping[csvName];
        if (!dbName) {
          console.log(`  Skipping ${csvName} - not in mapping`);
          continue;
        }
        
        if (!allPlayerPicks[dbName]) {
          allPlayerPicks[dbName] = {};
        }
        
        allPlayerPicks[dbName][gw] = picks;
        console.log(`  ${dbName} (${csvName}): ${picks.join(' ')}`);
      }
    } catch (error) {
      console.error(`Error reading GW${gw}:`, error.message);
      console.error(error.stack);
    }
  }
  
  // Step 3: Update picks in database
  console.log('\n=== UPDATING DATABASE ===');
  
  for (const [dbName, gwPicks] of Object.entries(allPlayerPicks)) {
    const userId = userMap.get(dbName);
    if (!userId) {
      console.log(`User ${dbName} not found in database`);
      continue;
    }
    
    console.log(`\nUpdating ${dbName}...`);
    
    for (const [gw, picks] of Object.entries(gwPicks)) {
      const gwNumber = parseInt(gw);
      
      // Delete existing picks
      const { error: deleteError } = await supabase
        .from('picks')
        .delete()
        .eq('user_id', userId)
        .eq('gw', gwNumber);
      
      if (deleteError) {
        console.error(`  Error deleting picks for GW${gwNumber}:`, deleteError);
        continue;
      }
      
      // Insert new picks
      for (let i = 0; i < picks.length; i++) {
        const { error: insertError } = await supabase
          .from('picks')
          .insert({
            user_id: userId,
            gw: gwNumber,
            fixture_index: i,
            pick: picks[i]
          });
        
        if (insertError) {
          console.error(`  Error inserting pick ${i} for GW${gwNumber}:`, insertError);
        }
      }
      
      // Upsert submission
      await supabase
        .from('gw_submissions')
        .upsert({
          user_id: userId,
          gw: gwNumber,
          submitted_at: new Date().toISOString()
        }, { onConflict: 'user_id,gw' });
      
      console.log(`  GW${gwNumber} updated`);
    }
    
    console.log(`${dbName} completed successfully`);
  }
  
  // Step 4: Verify scores
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
    'Ben New': 26
  };
  
  let allCorrect = true;
  
  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) continue;

    // Get all picks
    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Get all results
    const { data: results } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Calculate score
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
    console.log('❌ Some scores do not match. Check the data.');
  }
}

updateEverything().catch(console.error);

