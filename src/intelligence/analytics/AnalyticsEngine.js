import { StudentAnalytics } from './StudentAnalytics';
import { FacultyAnalytics } from './FacultyAnalytics';
import { DepartmentAnalytics } from './DepartmentAnalytics';
import { InstitutionAnalytics } from './InstitutionAnalytics';

class AnalyticsEngine {
  constructor() {
    this.students = new StudentAnalytics();
    this.faculty = new FacultyAnalytics();
    this.departments = new DepartmentAnalytics();
    this.institution = new InstitutionAnalytics();
  }
}

export const analyticsEngine = new AnalyticsEngine();
