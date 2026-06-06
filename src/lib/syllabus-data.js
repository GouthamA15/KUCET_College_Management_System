// src/lib/syllabus-data.js
import { cseSyllabus } from './syllabus/cse';
import { itSyllabus } from './syllabus/it';
import { eceSyllabus } from './syllabus/ece';
import { eeeSyllabus } from './syllabus/eee';
import { mechSyllabus } from './syllabus/mech';
import { civilSyllabus } from './syllabus/civil';
import { csdSyllabus } from './syllabus/csd';

// Branch Specific Syllabus - Comprehensive Detailed Structure for ALL Branches
export const syllabusData = {
  "CSE": cseSyllabus,
  "IT": itSyllabus,
  "ECE": eceSyllabus,
  "EEE": eeeSyllabus,
  "MECH": mechSyllabus,
  "CIVIL": civilSyllabus,
  "CSD": csdSyllabus
};
