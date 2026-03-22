import bcrypt from 'bcrypt';

const plainPassword = 'Vetrivel123!';
const saltRounds = 10;

async function generateHash() {
  try {
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    console.log('Password hash generated successfully:');
    console.log(hash);
    console.log('\nUse this in your .env file as ADMIN_PASSWORD_HASH=');
  } catch (error) {
    console.error('Error generating hash:', error.message);
  }
}

generateHash();
