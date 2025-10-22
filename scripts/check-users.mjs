import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('All users in database:');
  console.log('======================');
  users.forEach(u => {
    console.log(`- ${u.name}`);
  });
  console.log(`\nTotal: ${users.length} users`);
}

checkUsers().catch(console.error);

