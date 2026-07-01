import { FacultyService } from './src/services/FacultyService.js';
import { db } from './src/db/index.js';

async function test() {
  try {
    console.log("Testing getCurrentAcademicYear...");
    const year = await FacultyService.getCurrentAcademicYear();
    console.log("Year:", year);

    console.log("Testing getFacultyLoad...");
    const load = await FacultyService.getFacultyLoad(year);
    console.log("Load length:", load.length);

    console.log("Testing getBranchTimetable...");
    const tt = await FacultyService.getBranchTimetable({ branch: 'CSE', semester: 1, section: 'A', academicYear: year });
    console.log("Timetable length:", tt.length);
    
    console.log("Success");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

test();
