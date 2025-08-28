const bcrypt = require('bcryptjs');

async function testBcrypt() {
  const password = 'admin123';
  const hash = '$2b$12$VV52fTMw1o5Ws6WIN47TBuX2f7OOq49.UT20bXbxuZhmrfxB02aFG';
  
  console.log('Testing bcrypt comparison...');
  console.log('Password:', password);
  console.log('Hash:', hash);
  
  try {
    const result = await bcrypt.compare(password, hash);
    console.log('Comparison result:', result);
    
    // Also test generating a fresh hash
    console.log('\nGenerating fresh hash...');
    const freshHash = await bcrypt.hash(password, 12);
    console.log('Fresh hash:', freshHash);
    
    const freshResult = await bcrypt.compare(password, freshHash);
    console.log('Fresh comparison result:', freshResult);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testBcrypt();