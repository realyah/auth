// Grant or revoke the admin role from the command line (there is no API for this).
//   npm run make-admin -- <username>
//   npm run make-admin -- <username> --revoke
const mongoose = require('mongoose');
const { MONGODB_URI } = require('../src/config');
const User = require('../src/models/user.model');

const main = async () => {
  const [username, flag] = process.argv.slice(2);
  if (!username) {
    console.error('Usage: npm run make-admin -- <username> [--revoke]');
    process.exit(1);
  }
  const role = flag === '--revoke' ? 'user' : 'admin';

  await mongoose.connect(MONGODB_URI);
  const user = await User.findOneAndUpdate({ username }, { $set: { role } }, { new: true });
  await mongoose.disconnect();

  if (!user) {
    console.error(`User "${username}" not found`);
    process.exit(1);
  }
  console.log(`${user.username} is now "${user.role}"`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
