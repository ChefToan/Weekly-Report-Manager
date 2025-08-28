const bcrypt = require('bcryptjs');

// Get password from command line argument
const password = process.argv[2];

if (!password) {
  console.log('Usage: node scripts/hash-password.js <password>');
  console.log('Example: node scripts/hash-password.js mypassword123');
  process.exit(1);
}

async function hashPassword() {
  try {
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password:', password);
    console.log('Hash:', hash);
    console.log('\nSQL to insert user:');
    console.log(`INSERT INTO users (username, password_hash, name, email, is_active) VALUES ('username', '${hash}', 'Full Name', 'email@example.com', true);`);
  } catch (error) {
    console.error('Error hashing password:', error);
  }
}

hashPassword();