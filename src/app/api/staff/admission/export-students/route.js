import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { branchCodes, getBatchFromRoll } from '@/lib/rollNumber';
import { formatDate } from '@/lib/date';
import { getAssetUrl } from '@/lib/assets';
import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';
import ExcelJS from 'exceljs';
import fs from 'fs';

const maskAadhaar = (val) => {
  if (!val || typeof val !== 'string' || val.length < 4) return 'N/A';
  return `XXXX-XXXX-${val.slice(-4)}`;
};

/**
 * Validates image buffer magic bytes and returns the ExcelJS-compatible extension.
 */
function detectImageExtension(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpeg';
  // GIF: GIF87a or GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  // WebP: RIFF....WEBP (ExcelJS embeds with png container format for openxml)
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'png';
  return null;
}

/**
 * Robustly fetches an image buffer using local persistent storage first,
 * with failover to remote Cloudinary/S3 and in-memory deduplication.
 */
async function fetchImageBuffer(assetPath, imageBufferCache) {
  if (!assetPath || typeof assetPath !== 'string') return null;
  const clean = assetPath.trim();
  if (clean === '' || clean === 'N/A' || clean === 'NA' || clean === 'None') return null;

  if (imageBufferCache.has(clean)) {
    return imageBufferCache.get(clean);
  }

  // 1. Data URI
  if (clean.startsWith('data:image/')) {
    try {
      const base64Data = clean.split(',')[1];
      if (base64Data) {
        const buf = Buffer.from(base64Data, 'base64');
        const ext = detectImageExtension(buf) || 'png';
        const res = { buffer: buf, extension: ext };
        imageBufferCache.set(clean, res);
        return res;
      }
    } catch (_e) {}
  }

  // 2. Local VPS persistent storage disk check
  try {
    const cleanStorageKey = clean
      .replace(/^\/api\/assets\/view\//, '')
      .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
      .replace(/^\/+/, '');
    const { filePath, stat } = resolveLocalFilePath(cleanStorageKey);
    if (stat && stat.isFile() && filePath) {
      const buf = await fs.promises.readFile(filePath);
      if (buf && buf.length >= 12) {
        const ext = detectImageExtension(buf) || 'png';
        const res = { buffer: buf, extension: ext };
        imageBufferCache.set(clean, res);
        return res;
      }
    }
  } catch (_e) {}

  // 3. Remote URL check (getAssetUrl)
  try {
    let url = getAssetUrl(clean);
    if (url && url.startsWith('http')) {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf && buf.length >= 12) {
          const ext = detectImageExtension(buf) || 'png';
          const res = { buffer: buf, extension: ext };
          imageBufferCache.set(clean, res);
          return res;
        }
      }
    }
  } catch (_e) {}

  // 4. Cloudinary direct fallback
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                      process.env.CLOUDINARY_CLOUD_NAME || 
                      'djs0ry74r';
    let cleanKey = clean
      .replace(/^\/api\/assets\/view\//, '')
      .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
      .replace(/^\/+/, '');
    if (!cleanKey.startsWith('kucet/')) {
      cleanKey = `kucet/${cleanKey}`;
    }
    const directCloudUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${cleanKey}`;
    const directRes = await fetch(directCloudUrl, { signal: AbortSignal.timeout(6000) });
    if (directRes.ok) {
      const arrayBuf = await directRes.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf && buf.length >= 12) {
        const ext = detectImageExtension(buf) || 'png';
        const res = { buffer: buf, extension: ext };
        imageBufferCache.set(clean, res);
        return res;
      }
    }
  } catch (_e) {}

  return null;
}

export async function GET(req) {
  try {
    const user = await getAuthUser('staff');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const year = searchParams.get('year');
    const format = searchParams.get('format');

    if (!branch || !year) {
      return apiError('Branch and Year are required.', 400);
    }

    // Role-based access control for Student Master Export (Category 03)
    const userRole = (user.role || '').toLowerCase();
    const isAuthorizedForExport = [
      'admin',
      'super_admin',
      'principal',
      'admission',
      'admission_clerk'
    ].includes(userRole);

    if (!isAuthorizedForExport) {
      return apiError('Forbidden: Access denied. Only admission staff and administrators can export student records.', 403);
    }

    const isAuthorizedForFullAadhaar = isAuthorizedForExport;

    const students = await StudentService.getFullStudentDataForExport(year, branch);

    // If Excel format requested, generate and stream complete Excel workbook with embedded photographs
    if (format === 'excel') {
      const branchName = branchCodes[branch] || branch;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'KUCET College Management System';
      workbook.lastModifiedBy = user.name || user.email || 'KUCET Staff';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Students', {
        views: [{ showGridLines: true }]
      });

      // 33 Standardized Columns matching complete institutional admission register
      worksheet.columns = [
        { header: 'Roll Number', key: 'roll_no', width: 16 },
        { header: 'Admission Number', key: 'admission_no', width: 18 },
        { header: 'Batch', key: 'batch', width: 14 },
        { header: 'Full Name', key: 'name', width: 28 },
        { header: 'Gender', key: 'gender', width: 12 },
        { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Mobile Number', key: 'mobile', width: 16 },
        { header: 'Father Name', key: 'father_name', width: 26 },
        { header: 'Mother Name', key: 'mother_name', width: 26 },
        { header: 'Nationality', key: 'nationality', width: 14 },
        { header: 'Religion', key: 'religion', width: 14 },
        { header: 'Category', key: 'category', width: 12 },
        { header: 'Sub-Caste', key: 'sub_caste', width: 16 },
        { header: 'Area Status', key: 'area_status', width: 14 },
        { header: 'Mother Tongue', key: 'mother_tongue', width: 16 },
        { header: 'Place of Birth', key: 'place_of_birth', width: 20 },
        { header: 'Father Occupation', key: 'father_occupation', width: 22 },
        { header: 'Annual Income', key: 'annual_income', width: 18 },
        { header: 'Aadhaar Number', key: 'aadhaar_no', width: 20 },
        { header: 'Guardian Mobile', key: 'guardian_mobile', width: 16 },
        { header: 'Permanent Address', key: 'permanent_address', width: 40 },
        { header: 'Identification Marks', key: 'identification_marks', width: 32 },
        { header: 'Seat Allotted Category', key: 'seat_allotted_category', width: 22 },
        { header: 'Blood Group', key: 'blood_group', width: 14 },
        { header: 'Fee Reimbursement', key: 'fee_reimbursement', width: 18 },
        { header: 'Qualifying Exam', key: 'qualifying_exam', width: 16 },
        { header: 'SSC Marks', key: 'ssc_marks', width: 14 },
        { header: 'Inter/Diploma Marks', key: 'inter_marks', width: 18 },
        { header: 'Entrance Exam Rank', key: 'entrance_exam_rank', width: 18 },
        { header: 'Previous College', key: 'previous_college', width: 30 },
        { header: 'Photo', key: 'photo', width: 16 },
        { header: 'Signature', key: 'signature', width: 20 }
      ];

      // Format Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 32;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0B3578' }, // Kakatiya Navy
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11,
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      const imageBufferCache = new Map();
      const centerAlignedKeys = new Set([
        'roll_no', 'admission_no', 'batch', 'gender', 'date_of_birth',
        'mobile', 'nationality', 'religion', 'category', 'sub_caste',
        'area_status', 'mother_tongue', 'annual_income', 'aadhaar_no',
        'guardian_mobile', 'seat_allotted_category', 'blood_group',
        'fee_reimbursement', 'qualifying_exam', 'ssc_marks',
        'inter_marks', 'entrance_exam_rank', 'photo', 'signature'
      ]);

      // Populate student rows
      let rowIndex = 2;
      for (const s of students) {
        const rawDob = s.date_of_birth || s.dob;
        const formattedDob = rawDob ? formatDate(rawDob, 'N/A') : 'N/A';

        // Complete Aadhaar strictly preserved as text for authorized roles, masked for others
        const plainAadhaar = s.aadhaar_no ? String(s.aadhaar_no).trim() : '';
        const finalAadhaar = isAuthorizedForFullAadhaar 
          ? (plainAadhaar || 'N/A') 
          : maskAadhaar(plainAadhaar);

        const bloodGroupDisplay = s.blood_group && s.blood_group !== 'Not available' 
          ? s.blood_group 
          : 'Not available';

        const rowValues = {
          roll_no: s.roll_no || '',
          admission_no: s.admission_no || '',
          batch: getBatchFromRoll(s.roll_no) || year,
          name: s.name || '',
          gender: s.gender || '',
          date_of_birth: formattedDob,
          email: s.email || '',
          mobile: s.mobile || '',
          father_name: s.father_name || '',
          mother_name: s.mother_name || '',
          nationality: s.nationality || 'Indian',
          religion: s.religion || '',
          category: s.category || '',
          sub_caste: s.sub_caste || '',
          area_status: s.area_status || '',
          mother_tongue: s.mother_tongue || '',
          place_of_birth: s.place_of_birth || '',
          father_occupation: s.father_occupation || '',
          annual_income: s.annual_income || '',
          aadhaar_no: finalAadhaar,
          guardian_mobile: s.guardian_mobile || '',
          permanent_address: s.permanent_address || '',
          identification_marks: s.identification_marks || '',
          seat_allotted_category: s.seat_allotted_category || '',
          blood_group: bloodGroupDisplay,
          fee_reimbursement: s.fee_reimbursement || 'NO',
          qualifying_exam: s.qualifying_exam || '',
          ssc_marks: s.ssc_marks || '',
          inter_marks: s.inter_marks || '',
          entrance_exam_rank: s.entrance_exam_rank || '',
          previous_college: s.previous_college || '',
          photo: '', // placeholder, will embed image or set text
          signature: '' // placeholder
        };

        const addedRow = worksheet.addRow(rowValues);
        addedRow.height = 75; // Accommodates visible, crisp photo embedding

        // Cell borders, alignment, and explicit text format for Aadhaar & DOB
        addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colKey = worksheet.columns[colNumber - 1]?.key;
          cell.alignment = {
            vertical: 'middle',
            horizontal: centerAlignedKeys.has(colKey) ? 'center' : 'left',
            wrapText: colKey === 'permanent_address' || colKey === 'identification_marks'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          // Inviolable text formatting for sensitive identifiers
          if (colKey === 'aadhaar_no' || colKey === 'date_of_birth' || colKey === 'mobile' || colKey === 'guardian_mobile') {
            cell.numFmt = '@';
          }
        });

        // 1. Photo Retrieval & Embedding (Column 32, 0-indexed column 31)
        if (s.photo) {
          try {
            const photoResult = await fetchImageBuffer(s.photo, imageBufferCache);
            if (photoResult && photoResult.buffer) {
              const imageId = workbook.addImage({
                buffer: photoResult.buffer,
                extension: photoResult.extension,
              });

              worksheet.addImage(imageId, {
                tl: { col: 31 + 0.15, row: (rowIndex - 1) + 0.08 },
                ext: { width: 66, height: 66 },
                editAs: 'oneCell'
              });
            } else {
              addedRow.getCell('photo').value = 'Photo unavailable';
              addedRow.getCell('photo').font = { italic: true, color: { argb: 'FF94A3B8' } };
            }
          } catch (imgErr) {
            logger.warn({ roll_no: s.roll_no, err: imgErr.message }, 'Failed to embed student photograph');
            addedRow.getCell('photo').value = 'Photo unavailable';
            addedRow.getCell('photo').font = { italic: true, color: { argb: 'FF94A3B8' } };
          }
        } else {
          addedRow.getCell('photo').value = 'Photo unavailable';
          addedRow.getCell('photo').font = { italic: true, color: { argb: 'FF94A3B8' } };
        }

        // 2. Signature Retrieval & Embedding (Column 33, 0-indexed column 32)
        if (s.signature) {
          try {
            const sigResult = await fetchImageBuffer(s.signature, imageBufferCache);
            if (sigResult && sigResult.buffer) {
              const sigImageId = workbook.addImage({
                buffer: sigResult.buffer,
                extension: sigResult.extension,
              });

              worksheet.addImage(sigImageId, {
                tl: { col: 32 + 0.15, row: (rowIndex - 1) + 0.25 },
                ext: { width: 95, height: 36 },
                editAs: 'oneCell'
              });
            } else {
              addedRow.getCell('signature').value = 'None';
              addedRow.getCell('signature').font = { italic: true, color: { argb: 'FF94A3B8' } };
            }
          } catch (sigErr) {
            logger.warn({ roll_no: s.roll_no, err: sigErr.message }, 'Failed to embed student signature');
            addedRow.getCell('signature').value = 'None';
            addedRow.getCell('signature').font = { italic: true, color: { argb: 'FF94A3B8' } };
          }
        } else {
          addedRow.getCell('signature').value = 'None';
          addedRow.getCell('signature').font = { italic: true, color: { argb: 'FF94A3B8' } };
        }

        rowIndex++;
      }

      const fileBuffer = await workbook.xlsx.writeBuffer();
      const exportFilename = `KUCET_Students_${branchName}_Batch_${year}.xlsx`;

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${exportFilename}"`,
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        }
      });
    }

    // Default JSON response for UI preview table
    const sanitizedStudents = isAuthorizedForFullAadhaar 
      ? students 
      : students.map(s => ({
          ...s,
          aadhaar_no: maskAadhaar(s.aadhaar_no)
        }));

    return apiResponse({ 
      students: sanitizedStudents,
      canViewFullAadhaar: isAuthorizedForFullAadhaar 
    });

  } catch (error) {
    logger.error(error, 'Error exporting student data');
    return apiError('Internal Server Error', 500);
  }
}
