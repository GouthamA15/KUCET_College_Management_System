const mysql = require('mysql2/promise');
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

async function renameExams() {
  console.log('⏳ Renaming entrance exams in database...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com'))) ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    } : undefined,
  });

  try {
    // 1. Update student_admission_drafts
    console.log('Updating student_admission_drafts...');
    const [res1] = await connection.execute(`
      UPDATE student_admission_drafts 
      SET entrance_exam = 'TG EAPCET' 
      WHERE entrance_exam = 'EAMCET' OR entrance_exam = 'TS EAMCET'
    `);
    console.log(`- Updated ${res1.affectedRows} rows for EAMCET/TS EAMCET.`);

    const [res2] = await connection.execute(`
      UPDATE student_admission_drafts 
      SET entrance_exam = 'TG ECET' 
      WHERE entrance_exam = 'ECET' OR entrance_exam = 'TS ECET'
    `);
    console.log(`- Updated ${res2.affectedRows} rows for ECET/TS ECET.`);

    // 2. Update student_academic_background
    console.log('Updating student_academic_background...');
    const [res3] = await connection.execute(`
      UPDATE student_academic_background 
      SET qualifying_exam = 'TG EAPCET' 
      WHERE qualifying_exam = 'EAMCET' OR qualifying_exam = 'TS EAMCET'
    `);
    console.log(`- Updated ${res3.affectedRows} rows for EAMCET/TS EAMCET.`);

    const [res4] = await connection.execute(`
      UPDATE student_academic_background 
      SET qualifying_exam = 'TG ECET' 
      WHERE qualifying_exam = 'ECET' OR qualifying_exam = 'TS ECET'
    `);
    console.log(`- Updated ${res4.affectedRows} rows for ECET/TS ECET.`);

    // 3. Update college_info JSON keys
    console.log('Updating college_info entrance_codes...');
    const [rows] = await connection.execute('SELECT id, entrance_codes FROM college_info');
    for (const row of rows) {
      if (row.entrance_codes) {
        let codes;
        try {
            codes = typeof row.entrance_codes === 'string' ? JSON.parse(row.entrance_codes) : row.entrance_codes;
        } catch (e) {
            console.error(`Failed to parse entrance_codes for ID ${row.id}:`, row.entrance_codes);
            continue;
        }

        if (!codes) continue;

        const newCodes = {};
        // Preserve existing values but use new keys if old ones exist
        if (codes.pgecet) newCodes.tgpgecet = codes.pgecet;
        else if (codes.tgpgecet) newCodes.tgpgecet = codes.tgpgecet;

        if (codes.eapcet) newCodes.tgeapcet = codes.eapcet;
        else if (codes.tgeapcet) newCodes.tgeapcet = codes.tgeapcet;

        if (codes.ecet) newCodes.tgecet = codes.ecet;
        else if (codes.tgecet) newCodes.tgecet = codes.tgecet;
        
        // Also check for any other keys just in case
        Object.keys(codes).forEach(key => {
            if (!['pgecet', 'eapcet', 'ecet', 'tgpgecet', 'tgeapcet', 'tgecet'].includes(key)) {
                newCodes[key] = codes[key];
            }
        });

        if (Object.keys(newCodes).length > 0) {
           await connection.execute('UPDATE college_info SET entrance_codes = ? WHERE id = ?', [JSON.stringify(newCodes), row.id]);
           console.log(`- Updated entrance_codes for college_info ID ${row.id}.`);
        }
      }
    }

    console.log('✅ Database update completed successfully!');
  } catch (error) {
    console.error('❌ Database update failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

renameExams();
