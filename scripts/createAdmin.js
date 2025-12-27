import bcrypt from 'bcrypt';
import { supabase } from '../src/config/database.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    console.log('\n=== Create Admin User ===\n');

    const username = await question('Enter username: ');
    const password = await question('Enter password: ');

    if (!username || !password) {
      console.error('Username and password are required');
      rl.close();
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert into database
    const { data, error } = await supabase
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.error('\nError: Username already exists');
      } else {
        console.error('\nError:', error.message);
      }
    } else {
      console.log('\n✓ Admin user created successfully!');
      console.log('Username:', username);
      console.log('ID:', data.id);
    }

    rl.close();
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
  }
}

createAdmin();
