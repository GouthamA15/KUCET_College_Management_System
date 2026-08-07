import { Queue } from '@/lib/queue';

export const BackgroundJobHelper = {
  enqueueAnalyticsJob: async (type, params) => {
    return await Queue.enqueueReportGeneration(type, params, 'system');
  },
  
  enqueueScoringJob: async (branch, academicYear) => {
    return await Queue.enqueueReportGeneration('SCORING', { branch, academicYear }, 'system');
  },
  
  enqueueReportJob: async (type, params) => {
    return await Queue.enqueueReportGeneration(type, params, 'system');
  }
};
