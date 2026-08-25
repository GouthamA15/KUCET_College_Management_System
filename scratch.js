require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: true }
  });
  
  const [reqs] = await connection.query("SELECT * FROM staff_registration_requests WHERE email = 'testersybau69@gmail.com'");
  console.log("Reqs:\n", reqs);
  
  connection.end();
}
run();
