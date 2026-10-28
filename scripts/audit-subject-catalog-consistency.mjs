/**
 * Audit Subject Catalog Consistency Script
 * 
 * Verifies:
 * 1. All records in `syllabus_subjects` have valid canonical subject types ('theory' or 'lab').
 * 2. No lab/practical subjects are incorrectly stored as 'theory' (or vice-versa).
 * 3. All faculty subject assignments map to a recognized subject in `syllabus_subjects`.
 * 4. All syllabus structure mappings reference a valid subject in `syllabus_subjects`.
 * 
 * Read-only audit — modifies zero database records.
 */

import { query } from '../src/lib/db.js';

export const CANONICAL_SUBJECT_TYPES = ['theory', 'lab'];

export function isValidSubjectType(type) {
  if (!type || typeof type !== 'string') return false;
  return CANONICAL_SUBJECT_TYPES.includes(type.trim().toLowerCase());
}

export async function runSubjectCatalogAudit() {
  console.log('--- KUCET Academic Catalogue Consistency Audit ---\n');

  // 1. Check syllabus_subjects validity
  const allSubjects = await query('SELECT subject_code, subject_name, subject_type FROM syllabus_subjects ORDER BY subject_code ASC');
  console.log(`Total subjects in syllabus_subjects: ${allSubjects.length}`);

  const invalidTypes = [];
  const suspiciousTheories = [];
  const suspiciousLabs = [];

  for (const s of allSubjects) {
    if (!isValidSubjectType(s.subject_type)) {
      invalidTypes.push(s);
      continue;
    }

    const code = (s.subject_code || '').toUpperCase();
    const name = (s.subject_name || '').toLowerCase();

    // Check theory subjects that look like lab/practical
    if (s.subject_type === 'theory') {
      if (name.includes('lab') || name.includes('practical') || name.includes('laboratory') || code.endsWith('L')) {
        suspiciousTheories.push({ code: s.subject_code, name: s.subject_name, type: s.subject_type });
      }
    }

    // Check lab subjects that explicitly claim to be pure theory
    if (s.subject_type === 'lab') {
      if (name.includes('theory') && !name.includes('lab') && !name.includes('practical') && !code.endsWith('L')) {
        suspiciousLabs.push({ code: s.subject_code, name: s.subject_name, type: s.subject_type });
      }
    }
  }

  // 2. Check orphaned faculty assignments
  const orphanedAssignments = await query(`
    SELECT fsa.id, fsa.subject_code, fsa.subject_name, fsa.branch, fsa.course_semester, fsa.academic_year
    FROM faculty_subject_assignments fsa
    LEFT JOIN syllabus_subjects ss ON fsa.subject_code = ss.subject_code
    WHERE ss.subject_code IS NULL
  `);

  // 3. Check orphaned syllabus structure rows
  const orphanedStructure = await query(`
    SELECT ss_struct.id, ss_struct.subject_code, ss_struct.branch, ss_struct.semester
    FROM syllabus_structure ss_struct
    LEFT JOIN syllabus_subjects ss ON ss_struct.subject_code = ss.subject_code
    WHERE ss.subject_code IS NULL
  `);

  // Report Findings
  console.log(`- Invalid subject_type count: ${invalidTypes.length}`);
  console.log(`- Suspicious theory entries (name contains lab/practical or code ends in L): ${suspiciousTheories.length}`);
  if (suspiciousTheories.length > 0) {
    console.table(suspiciousTheories);
  }
  console.log(`- Suspicious lab entries: ${suspiciousLabs.length}`);
  if (suspiciousLabs.length > 0) {
    console.table(suspiciousLabs);
  }
  console.log(`- Orphaned faculty assignments (no syllabus_subjects entry): ${orphanedAssignments.length}`);
  if (orphanedAssignments.length > 0) {
    console.table(orphanedAssignments);
  }
  console.log(`- Orphaned syllabus structure mappings: ${orphanedStructure.length}`);
  if (orphanedStructure.length > 0) {
    console.table(orphanedStructure);
  }

  const isClean = invalidTypes.length === 0 && 
                  suspiciousTheories.length === 0 && 
                  suspiciousLabs.length === 0 && 
                  orphanedAssignments.length === 0 && 
                  orphanedStructure.length === 0;

  console.log(`\nAudit Result: ${isClean ? 'PASSED (Catalogue Consistent)' : 'WARNINGS FOUND'}`);
  return {
    isClean,
    totalSubjects: allSubjects.length,
    invalidTypes,
    suspiciousTheories,
    suspiciousLabs,
    orphanedAssignments,
    orphanedStructure
  };
}

// Direct execution support
if (process.argv[1]?.endsWith('audit-subject-catalog-consistency.mjs')) {
  runSubjectCatalogAudit()
    .then(result => process.exit(result.isClean ? 0 : 1))
    .catch(err => {
      console.error('Audit failed with error:', err);
      process.exit(1);
    });
}
