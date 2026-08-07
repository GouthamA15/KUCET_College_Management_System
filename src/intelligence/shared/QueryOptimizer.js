import { db } from '@/db';
import { students, studentAttendance, studentMarks, studentFeePayments, scholarshipSanctions } from '@/db/schema';
import { inArray, eq, and } from 'drizzle-orm';

export const QueryOptimizer = {
  batchLoadStudents: async (studentIds) => {
    if (!studentIds || studentIds.length === 0) return new Map();
    
    const results = await db.select().from(students).where(inArray(students.id, studentIds));
    const map = new Map();
    for (const row of results) {
      map.set(row.id, row);
    }
    return map;
  },

  batchLoadAttendance: async (studentIds, academicYear) => {
    if (!studentIds || studentIds.length === 0) return new Map();
    
    const studentIdCol = studentAttendance.studentId || studentAttendance.student_id;
    const academicYearCol = studentAttendance.academicYear || studentAttendance.academic_year;
    
    let query = db.select().from(studentAttendance).where(inArray(studentIdCol, studentIds));
    if (academicYear && academicYearCol) {
      query = query.where(and(inArray(studentIdCol, studentIds), eq(academicYearCol, academicYear)));
    }
    
    const results = await query;
    const map = new Map();
    for (const id of studentIds) {
      map.set(id, []);
    }
    
    for (const row of results) {
      const sId = row.studentId || row.student_id;
      if (map.has(sId)) {
        map.get(sId).push(row);
      }
    }
    return map;
  },

  batchLoadMarks: async (studentIds) => {
    if (!studentIds || studentIds.length === 0) return new Map();
    
    const studentIdCol = studentMarks.studentId || studentMarks.student_id;
    const results = await db.select().from(studentMarks).where(inArray(studentIdCol, studentIds));
    const map = new Map();
    for (const id of studentIds) {
      map.set(id, []);
    }
    for (const row of results) {
      const sId = row.studentId || row.student_id;
      if (map.has(sId)) {
        map.get(sId).push(row);
      }
    }
    return map;
  },

  batchLoadFeeStatus: async (studentIds, academicYear) => {
    if (!studentIds || studentIds.length === 0) return new Map();
    
    const studentIdCol = studentFeePayments.studentId || studentFeePayments.student_id;
    const academicYearCol = studentFeePayments.academicYear || studentFeePayments.academic_year;
    
    let query = db.select().from(studentFeePayments).where(inArray(studentIdCol, studentIds));
    if (academicYear && academicYearCol) {
      query = query.where(and(inArray(studentIdCol, studentIds), eq(academicYearCol, academicYear)));
    }
    
    const results = await query;
    const map = new Map();
    for (const id of studentIds) {
      map.set(id, []);
    }
    
    for (const row of results) {
      const sId = row.studentId || row.student_id;
      if (map.has(sId)) {
        map.get(sId).push(row);
      }
    }
    return map;
  },

  batchLoadScholarship: async (studentIds, academicYear) => {
    if (!studentIds || studentIds.length === 0) return new Map();
    
    const studentIdCol = scholarshipSanctions.studentId || scholarshipSanctions.student_id;
    const academicYearCol = scholarshipSanctions.academicYear || scholarshipSanctions.academic_year;
    
    let query = db.select().from(scholarshipSanctions).where(inArray(studentIdCol, studentIds));
    if (academicYear && academicYearCol) {
      query = query.where(and(inArray(studentIdCol, studentIds), eq(academicYearCol, academicYear)));
    }
    
    const results = await query;
    const map = new Map();
    for (const id of studentIds) {
      map.set(id, []);
    }
    
    for (const row of results) {
      const sId = row.studentId || row.student_id;
      if (map.has(sId)) {
        map.get(sId).push(row);
      }
    }
    return map;
  }
};
