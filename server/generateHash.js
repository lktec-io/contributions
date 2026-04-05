const bcrypt = require('bcrypt');
bcrypt.hash('Admin@2024', 10).then(hash => {
  console.log('Use this hash in seed.sql:');
  console.log(hash);
});
