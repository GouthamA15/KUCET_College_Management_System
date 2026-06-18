'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { COLLEGE_CONFIG as DEFAULTS } from '@/lib/college-config';

const SystemConfigContext = createContext();

export function SystemConfigProvider({ children }) {
  const [dbConfig, setDbConfig] = useState(null);
  const [systemConfigs, setSystemConfigs] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/public/config');
      const data = await res.json();
      if (res.ok) {
        setDbConfig(data.config);
        setSystemConfigs(data.systemConfigs);
      }
    } catch (error) {
      console.error('Failed to fetch dynamic config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) await fetchConfig();
    })();
    return () => { isMounted = false; };
  }, []);

  // Merge defaults with database config
  const config = useMemo(() => {
    const instDetails = systemConfigs?.institutionalDetails || {};
    
    // Base object combined with potential collegeInfo overrides
    const baseConfig = {
      ...DEFAULTS,
      name: dbConfig?.name || DEFAULTS.name,
      shortName: dbConfig?.short_name || DEFAULTS.shortName,
      address: dbConfig?.address || DEFAULTS.address,
      location: dbConfig?.location || DEFAULTS.location,
      pincode: dbConfig?.pincode || DEFAULTS.pincode,
      contact: dbConfig?.contact || DEFAULTS.contact,
      entranceCodes: dbConfig?.entrance_codes || DEFAULTS.entranceCodes,
      branches: dbConfig?.branches || DEFAULTS.branches,
      categories: dbConfig?.categories || DEFAULTS.categories,
      annualIncomes: dbConfig?.annual_incomes || DEFAULTS.annualIncomes,
      maintenanceMode: !!dbConfig?.maintenance_mode,
    };

    // Override with institutionalDetails from system_configs if available
    return {
      ...baseConfig,
      name: instDetails.name || baseConfig.name,
      shortName: instDetails.shortName || baseConfig.shortName,
      address: instDetails.address || baseConfig.address,
      contact: instDetails.contact || baseConfig.contact,
      accreditation: instDetails.accreditation || DEFAULTS.accreditation || "NAAC",
    };
  }, [dbConfig, systemConfigs]);

  const value = {
    config,
    feeStructures: systemConfigs?.feeStructures || { REGULAR: 35000, SFC: 70000, SFC_COURSES: ['CSD', 'IT', 'CIVIL'] },
    loading,
    refreshConfig: fetchConfig,
    isMaintenance: config.maintenanceMode
  };

  return (
    <SystemConfigContext.Provider value={value}>
      {children}
    </SystemConfigContext.Provider>
  );
}

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (!context) {
    throw new Error('useSystemConfig must be used within a SystemConfigProvider');
  }
  return context;
};
