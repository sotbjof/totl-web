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

async function checkGW9Submissions() {
  console.log('🎯 GW9 Submissions Report\n');

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .order('name');
    
    if (usersError) throw usersError;

    // Get GW9 fixtures to know how many picks should be made
    const { data: gw9Fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('fixture_index')
      .eq('gw', 9)
      .order('fixture_index');
    
    if (fixturesError) throw fixturesError;
    
    const totalFixtures = gw9Fixtures.length;
    console.log(`📊 GW9 has ${totalFixtures} fixtures\n`);

    // Get all GW9 picks
    const { data: gw9Picks, error: picksError } = await supabase
      .from('picks')
      .select('user_id, fixture_index, pick')
      .eq('gw', 9);
    
    if (picksError) throw picksError;

    // Group picks by user
    const userPicks = new Map();
    gw9Picks.forEach(pick => {
      if (!userPicks.has(pick.user_id)) {
        userPicks.set(pick.user_id, []);
      }
      userPicks.get(pick.user_id).push(pick);
    });

    // Analyze submissions
    const submissions = [];
    const notSubmitted = [];

    users.forEach(user => {
      const userPicksList = userPicks.get(user.id) || [];
      const submittedCount = userPicksList.length;
      const isComplete = submittedCount === totalFixtures;
      
      const submission = {
        name: user.name,
        userId: user.id,
        picksSubmitted: submittedCount,
        totalFixtures: totalFixtures,
        isComplete: isComplete,
        picks: userPicksList
      };

      if (isComplete) {
        submissions.push(submission);
      } else {
        notSubmitted.push(submission);
      }
    });

    // Sort by name
    submissions.sort((a, b) => a.name.localeCompare(b.name));
    notSubmitted.sort((a, b) => a.name.localeCompare(b.name));

    // Display results
    console.log('✅ COMPLETED SUBMISSIONS:');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    console.log(`│ ${'Name'.padEnd(25)} │ ${'Picks'.padEnd(6)} │ ${'User ID'.padEnd(8)} │`);
    console.log('├─────────────────────────┼────────┼──────────────────┤');
    
    submissions.forEach(sub => {
      const name = sub.name.padEnd(25);
      const picks = `${sub.picksSubmitted}/${sub.totalFixtures}`.padEnd(6);
      const userId = sub.userId.substring(0, 8) + '...';
      console.log(`│ ${name} │ ${picks} │ ${userId.padEnd(8)} │`);
    });

    console.log('└─────────────────────────┴──────────────────────────────┴────────┴──────────────────┘');
    console.log(`\n📈 Total Complete Submissions: ${submissions.length}\n`);

    if (notSubmitted.length > 0) {
      console.log('❌ INCOMPLETE/NOT SUBMITTED:');
      console.log('═══════════════════════════════════════════════════════════════════════════════════════');
      console.log(`│ ${'Name'.padEnd(25)} │ ${'Picks'.padEnd(6)} │ ${'User ID'.padEnd(8)} │`);
      console.log('├─────────────────────────┼────────┼──────────────────┤');
      
      notSubmitted.forEach(sub => {
        const name = sub.name.padEnd(25);
        const picks = `${sub.picksSubmitted}/${sub.totalFixtures}`.padEnd(6);
        const userId = sub.userId.substring(0, 8) + '...';
        console.log(`│ ${name} │ ${picks} │ ${userId.padEnd(8)} │`);
      });

      console.log('└─────────────────────────┴──────────────────────────────┴────────┴──────────────────┘');
      console.log(`\n📉 Total Incomplete/Not Submitted: ${notSubmitted.length}\n`);
    }

    // Summary statistics
    const totalUsers = users.length;
    const completionRate = ((submissions.length / totalUsers) * 100).toFixed(1);
    
    console.log('📊 SUMMARY STATISTICS:');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Complete Submissions: ${submissions.length}`);
    console.log(`Incomplete/Not Submitted: ${notSubmitted.length}`);
    console.log(`Completion Rate: ${completionRate}%`);
    console.log(`Total Fixtures in GW9: ${totalFixtures}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkGW9Submissions();
