const mysql = require('mysql2/promise');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
  });

  console.log('🚀 Starting Image Migration to Cloudinary...');

  try {
    // 1. Migrate student_images (Profiles)
    console.log('\n--- Processing student_images ---');
    const [images] = await pool.query('SELECT student_id, pfp FROM student_images');
    for (const row of images) {
      if (row.pfp && Buffer.isBuffer(row.pfp)) {
        console.log(`Uploading profile for student ID: ${row.student_id}...`);
        const base64 = `data:image/jpeg;base64,${row.pfp.toString('base64')}`;
        const url = (await cloudinary.uploader.upload(base64, { folder: 'kucet/students/pfp' })).secure_url;
        await pool.query('UPDATE student_images SET pfp = ? WHERE student_id = ?', [url, row.student_id]);
      }
    }

    // 2. Migrate student_signatures
    console.log('\n--- Processing student_signatures ---');
    const [sigs] = await pool.query('SELECT student_id, signature FROM student_signatures');
    for (const row of sigs) {
      if (row.signature && Buffer.isBuffer(row.signature)) {
        console.log(`Uploading signature for student ID: ${row.student_id}...`);
        const base64 = `data:image/png;base64,${row.signature.toString('base64')}`;
        const url = (await cloudinary.uploader.upload(base64, { folder: 'kucet/students/signatures' })).secure_url;
        await pool.query('UPDATE student_signatures SET signature = ? WHERE student_id = ?', [url, row.student_id]);
      }
    }

    // 3. Migrate student_admission_drafts
    console.log('\n--- Processing student_admission_drafts ---');
    const [drafts] = await pool.query('SELECT id, pfp, signature FROM student_admission_drafts');
    for (const row of drafts) {
      let pfpUrl = null;
      let sigUrl = null;

      if (row.pfp && Buffer.isBuffer(row.pfp)) {
        console.log(`Uploading draft pfp for ID: ${row.id}...`);
        const base64 = `data:image/jpeg;base64,${row.pfp.toString('base64')}`;
        pfpUrl = (await cloudinary.uploader.upload(base64, { folder: 'kucet/admission_drafts/pfp' })).secure_url;
      }

      if (row.signature && Buffer.isBuffer(row.signature)) {
        console.log(`Uploading draft signature for ID: ${row.id}...`);
        const base64 = `data:image/png;base64,${row.signature.toString('base64')}`;
        sigUrl = (await cloudinary.uploader.upload(base64, { folder: 'kucet/admission_drafts/signatures' })).secure_url;
      }

      if (pfpUrl || sigUrl) {
        let updateSql = 'UPDATE student_admission_drafts SET id=id';
        let params = [];
        if (pfpUrl) { updateSql += ', pfp = ?'; params.push(pfpUrl); }
        if (sigUrl) { updateSql += ', signature = ?'; params.push(sigUrl); }
        updateSql += ' WHERE id = ?';
        params.push(row.id);
        await pool.query(updateSql, params);
      }
    }

    // 4. Migrate student_profile_requests
    console.log('\n--- Processing student_profile_requests ---');
    const [requests] = await pool.query('SELECT id, new_pfp, new_signature FROM student_profile_requests');
    for (const row of requests) {
      let pfpUrl = null;
      let sigUrl = null;

      if (row.new_pfp && Buffer.isBuffer(row.new_pfp)) {
        console.log(`Uploading request pfp for ID: ${row.id}...`);
        const base64 = `data:image/jpeg;base64,${row.new_pfp.toString('base64')}`;
        pfpUrl = (await cloudinary.uploader.upload(base64, { folder: 'kucet/requests/pfp' })).secure_url;
      }

      if (row.new_signature && Buffer.isBuffer(row.new_signature)) {
        console.log(`Uploading request signature for ID: ${row.id}...`);
        const base64 = `data:image/png;base64,${row.new_signature.toString('base64')}`;
        sigUrl = (await cloudinary.uploader.upload(base64, { folder: 'kucet/requests/signatures' })).secure_url;
      }

      if (pfpUrl || sigUrl) {
        let updateSql = 'UPDATE student_profile_requests SET id=id';
        let params = [];
        if (pfpUrl) { updateSql += ', new_pfp = ?'; params.push(pfpUrl); }
        if (sigUrl) { updateSql += ', new_signature = ?'; params.push(sigUrl); }
        updateSql += ' WHERE id = ?';
        params.push(row.id);
        await pool.query(updateSql, params);
      }
    }

    // 5. Migrate student_requests
    console.log('\n--- Processing student_requests ---');
    const [certRequests] = await pool.query('SELECT request_id, payment_screenshot FROM student_requests');
    for (const row of certRequests) {
      if (row.payment_screenshot && Buffer.isBuffer(row.payment_screenshot)) {
        console.log(`Uploading payment screenshot for Request ID: ${row.request_id}...`);
        const base64 = `data:image/jpeg;base64,${row.payment_screenshot.toString('base64')}`;
        const url = (await cloudinary.uploader.upload(base64, { folder: 'kucet/certificates/payments' })).secure_url;
        await pool.query('UPDATE student_requests SET payment_screenshot = ? WHERE request_id = ?', [url, row.request_id]);
      }
    }

    // 6. Migrate student_request_images
    console.log('\n--- Processing student_request_images ---');
    const [reqImages] = await pool.query('SELECT request_id, payment_screenshot FROM student_request_images');
    for (const row of reqImages) {
      if (row.payment_screenshot && Buffer.isBuffer(row.payment_screenshot)) {
        console.log(`Uploading screenshot for Request ID: ${row.request_id}...`);
        const base64 = `data:image/jpeg;base64,${row.payment_screenshot.toString('base64')}`;
        const url = (await cloudinary.uploader.upload(base64, { folder: 'kucet/requests/payments' })).secure_url;
        await pool.query('UPDATE student_request_images SET payment_screenshot = ? WHERE request_id = ?', [url, row.request_id]);
      }
    }

    console.log('\n✅ Migration finished successfully!');

  } catch (err) {
    console.error('\n❌ Migration Error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
