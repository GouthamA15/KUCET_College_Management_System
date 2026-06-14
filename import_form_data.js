const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { query } = require('./src/lib/lib/db'); // Adjust path if needed
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

/**
 * KUCET BULK IMPORT SYSTEM
 * Workflow: CSV -> Cloudinary (Images) -> MySQL (Data)
 */

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_DIR = './student_uploads'; // Put downloaded Google Drive images here
const CSV_FILE = 'responses.csv';      // Put downloaded Google Sheets CSV here

async function uploadToCloudinary(fileName, folder) {
  if (!fileName) return null;
  const filePath = path.join(IMAGE_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Image not found: ${filePath}`);
    return null;
  }
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `kucet/${folder}`,
      use_filename: true,
      unique_filename: true,
      resource_type: 'image'
    });
    return result.secure_url;
  } catch (err) {
    console.error(`❌ Cloudinary Upload Error (${fileName}):`, err.message);
    return null;
  }
}

async function startImport() {
  const results = [];

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`🛑 Error: ${CSV_FILE} not found. Please download it from Google Sheets.`);
    return;
  }

  console.info('🚀 Starting Import Process...');

  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.info(`📊 Found ${results.length} records in CSV.`);

      for (const row of results) {
        try {
          const rollNo = row['1. Roll Number']?.trim();
          if (!rollNo) continue;

          console.info(`\n--- Processing: ${rollNo} ---`);

          // 1. Upload Images
          const photoUrl = await uploadToCloudinary(row['32. Student Photograph'], 'profiles');
          const sigUrl = await uploadToCloudinary(row['33. Student Signature'], 'signatures');

          // 2. Insert/Update Core Student Table
          const feeStatus = row['27. Fee Reimbursement Status']?.includes('YES') ? 'YES' : 
                          row['27. Fee Reimbursement Status']?.includes('GOV') ? 'GOV' : 'NO';

          const _studentRes = await query(
            `INSERT INTO students (roll_no, name, email, mobile, date_of_birth, gender, fee_reimbursement, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), mobile=VALUES(mobile), fee_reimbursement=VALUES(fee_reimbursement)`,
            [
              rollNo,
              row['2. Full Name']?.toUpperCase(),
              row['6. Student Email ID'],
              row['5. Student Mobile Number'],
              row['3. Date of Birth'],
              row['4. Gender']?.toUpperCase(),
              feeStatus
            ]
          );

          // Get the internal ID (required for FK relationships)
          const rows = await query('SELECT id FROM students WHERE roll_no = ?', [rollNo]);
          const studentId = rows[0].id;

          // 3. Insert/Update Personal Details
          const income = parseInt(row['18. Annual Income']?.replace(/\D/g, '') || '0');
          
          await query(
            `INSERT INTO student_personal_details (
              student_id, father_name, mother_name, nationality, religion, category, sub_caste, 
              area_status, mother_tongue, place_of_birth, father_occupation, annual_income, 
              guardian_mobile, aadhaar_no, address, identification_marks, blood_group
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE annual_income=VALUES(annual_income), address=VALUES(address), category=VALUES(category)`,
            [
              studentId,
              row["8. Father's Name"]?.toUpperCase(),
              row["9. Mother's Name"]?.toUpperCase(),
              row['10. Nationality']?.toUpperCase() || 'INDIAN',
              row['11. Religion']?.toUpperCase(),
              row['12. Category'],
              row['13. Sub Caste']?.toUpperCase(),
              row['14. Area Status'] || 'Local',
              row['15. Mother Tongue']?.toUpperCase(),
              row['16. Place of Birth']?.toUpperCase(),
              row["17. Father's Occupation"]?.toUpperCase(),
              income,
              row['19. Guardian Mobile Number'],
              row['7. Aadhaar Number']?.replace(/\s/g, ''),
              row['20. Permanent Address'],
              row['21. Identification Marks'],
              row['22. Blood Group']
            ]
          );

          // 4. Insert/Update Academic Background
          await query(
            `INSERT INTO student_academic_background (
              student_id, qualifying_exam, ranks, ssc_marks, inter_marks, medium_of_instruction, previous_college_details
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE ranks=VALUES(ranks), ssc_marks=VALUES(ssc_marks), inter_marks=VALUES(inter_marks)`,
            [
              studentId,
              row['23. Entrance Exam'],
              row['25. Entrance Rank'],
              row['30. SSC / 10th Marks'],
              row['31. Intermediate / Diploma Marks'],
              row['28. Medium of Instruction']?.toUpperCase(),
              row['29. Previous College Details']
            ]
          );

          // 5. Link Cloudinary Assets
          if (photoUrl) {
            await query('INSERT INTO student_images (student_id, pfp) VALUES (?, ?) ON DUPLICATE KEY UPDATE pfp=VALUES(pfp)', [studentId, photoUrl]);
          }
          if (sigUrl) {
            await query('INSERT INTO student_signatures (student_id, signature) VALUES (?, ?) ON DUPLICATE KEY UPDATE signature=VALUES(signature)', [studentId, sigUrl]);
          }

          console.info(`✅ Imported Successfully: ${rollNo}`);

        } catch (err) {
          console.error(`❌ Error importing student ${row['1. Roll Number']}:`, err.message);
        }
      }
      console.info('\n🏁 Bulk Import Task Completed.');
    });
}

startImport();
