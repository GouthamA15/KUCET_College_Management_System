require('dotenv').config({ path: '.env.local' });
const http = require('http');

async function testApi() {
  const { FacultyService } = require('./src/services/FacultyService.js');
  
  try {
    const year = await FacultyService.getCurrentAcademicYear();
    console.log('Current year:', year);
    const load = await FacultyService.getFacultyLoad(year);
    console.log('Load fetched successfully, records:', load.length);
  } catch (err) {
    console.error('Error fetching load:', err);
  }
}

testApi();
