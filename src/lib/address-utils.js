/**
 * Cleans an individual address token.
 * Strips whitespace and filters out placeholder tokens:
 * null, undefined, N/A, NA, None, -, --, ., Not Applicable.
 * Returns empty string '' if invalid or placeholder.
 *
 * @param {any} val
 * @returns {string}
 */
export function cleanAddressPart(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  const upper = str.toUpperCase();
  if (
    upper === 'N/A' ||
    upper === 'NA' ||
    upper === 'NULL' ||
    upper === 'UNDEFINED' ||
    upper === 'NONE' ||
    upper === '-' ||
    upper === '--' ||
    upper === '—' ||
    upper === '.' ||
    upper === 'NOT APPLICABLE' ||
    upper === 'N.A.' ||
    upper === 'N.A'
  ) {
    return '';
  }
  return str;
}

/**
 * Sanitizes an address string:
 * 1. Splits by commas and newlines
 * 2. Cleans each token via cleanAddressPart
 * 3. Removes adjacent case-insensitive duplicate tokens (e.g. "SHIVUNIPALLY, SHIVUNIPALLY" -> "SHIVUNIPALLY")
 * 4. Rejoins with ', '
 *
 * @param {string} addrStr
 * @returns {string}
 */
export function sanitizeAddressString(addrStr) {
  if (!addrStr || typeof addrStr !== 'string') return '';
  const rawParts = addrStr
    .split(/[\r\n,]+/)
    .map(p => cleanAddressPart(p))
    .filter(Boolean);

  const deduplicated = [];
  for (const part of rawParts) {
    const norm = part.toLowerCase().trim();
    if (deduplicated.length > 0 && deduplicated[deduplicated.length - 1].toLowerCase().trim() === norm) {
      continue;
    }
    deduplicated.push(part);
  }

  // If the only token is 'India', but no other address info exists, return ''
  if (deduplicated.length === 1 && deduplicated[0].toLowerCase() === 'india') {
    return '';
  }

  return deduplicated.join(', ');
}

export function parseAddress(addrStr) {
  if (!addrStr || typeof addrStr !== 'string') {
    return {
      house_no: '',
      street: '',
      apartment: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    };
  }

  const parts = addrStr.split(',').map(p => cleanAddressPart(p)).filter(Boolean);
  
  let country = 'India';
  let pincode = '';
  let state = '';
  let city = '';
  let apartment = '';
  let street = '';
  let house_no = '';

  let remaining = [...parts];

  // 1. Country (often the last part)
  if (remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    if (isNaN(last) && (last.toLowerCase() === 'india' || last.toLowerCase().includes('country'))) {
      country = remaining.pop();
    }
  }

  // 2. Pincode (6-digit number, often near the end)
  for (let i = remaining.length - 1; i >= 0; i--) {
    const part = remaining[i];
    const match = part.match(/\b\d{6}\b/);
    if (match) {
      pincode = match[0];
      const cleaned = part.replace(/\b\d{6}\b/, '').trim();
      if (!cleaned) {
        remaining.splice(i, 1);
      } else {
        remaining[i] = cleaned;
      }
      break;
    }
  }

  // 3. State (often the last or second-to-last part now)
  const indianStates = [
    'Telangana', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 
    'Kerala', 'Goa', 'Gujarat', 'Rajasthan', 'Punjab', 'Haryana', 
    'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'West Bengal', 'Odisha', 
    'Assam', 'Sikkim', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 
    'Meghalaya', 'Arunachal Pradesh', 'Himachal Pradesh', 'Uttarakhand', 
    'Chhattisgarh', 'Jharkhand', 'Delhi', 'Puducherry', 'Chandigarh', 
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Andaman and Nicobar Islands'
  ];

  for (let i = remaining.length - 1; i >= 0; i--) {
    const part = remaining[i];
    const matchedState = indianStates.find(s => part.toLowerCase().includes(s.toLowerCase()));
    if (matchedState) {
      state = matchedState;
      remaining.splice(i, 1);
      break;
    }
  }

  // 4. City (often the next part from the end)
  if (remaining.length > 0) {
    city = remaining.pop();
  }

  // 5. Remaining parts are house_no, street, apartment
  if (remaining.length > 0) {
    house_no = remaining[0];
  }
  if (remaining.length > 1) {
    street = remaining.slice(1).join(', ');
  }

  return {
    house_no: house_no || '',
    street: street || '',
    apartment: apartment || '',
    city: city || '',
    state: state || '',
    pincode: pincode || '',
    country: country || 'India'
  };
}

export function formatAddress(structured) {
  if (!structured) return '';
  const { house_no, street, apartment, city, state, pincode, country } = structured;
  const rawParts = [house_no, apartment, street, city, state, pincode, country]
    .map(cleanAddressPart)
    .filter(Boolean);

  const deduplicated = [];
  for (const part of rawParts) {
    const norm = part.toLowerCase().trim();
    if (deduplicated.length > 0 && deduplicated[deduplicated.length - 1].toLowerCase().trim() === norm) {
      continue;
    }
    deduplicated.push(part);
  }

  if (deduplicated.length === 1 && deduplicated[0].toLowerCase() === 'india') {
    return '';
  }

  return deduplicated.join(', ');
}

export function getPermanentAddressFromDetails(details) {
  if (!details) return '';
  const perm = {
    house_no: cleanAddressPart(details.perm_house_no),
    street: cleanAddressPart(details.perm_street),
    apartment: cleanAddressPart(details.perm_apartment),
    city: cleanAddressPart(details.perm_city),
    state: cleanAddressPart(details.perm_state),
    pincode: cleanAddressPart(details.perm_pincode),
    country: cleanAddressPart(details.perm_country) || 'India'
  };
  const hasPerm = Object.entries(perm).some(([k, v]) => k !== 'country' && Boolean(v));
  return hasPerm ? formatAddress(perm) : sanitizeAddressString(details.address || '');
}

export function getContactAddressFromDetails(details) {
  if (!details) return '';
  const curr = {
    house_no: cleanAddressPart(details.curr_house_no),
    street: cleanAddressPart(details.curr_street),
    apartment: cleanAddressPart(details.curr_apartment),
    city: cleanAddressPart(details.curr_city),
    state: cleanAddressPart(details.curr_state),
    pincode: cleanAddressPart(details.curr_pincode),
    country: cleanAddressPart(details.curr_country) || 'India'
  };
  const hasCurr = Object.entries(curr).some(([k, v]) => k !== 'country' && Boolean(v));
  return hasCurr ? formatAddress(curr) : sanitizeAddressString(details.address || '');
}

/**
 * Merges permanent and current address components into a single authoritative, clean address.
 * Gracefully handles students who only filled partial details across permanent and current addresses.
 *
 * Rules:
 * 1. For each component (house_no, apartment, street, city, state, pincode, country),
 *    prefers permanent address if present and non-placeholder; falls back to current address.
 * 2. If both permanent and current structured fields are empty, falls back to details.address.
 * 3. Cleans any "N/A", "null", "undefined", or placeholder values.
 * 4. Deduplicates consecutive identical tokens (e.g. "SHIVUNIPALLY, SHIVUNIPALLY" -> "SHIVUNIPALLY").
 *
 * @param {object} details
 * @returns {string}
 */
export function getEffectiveStudentAddress(details) {
  if (!details) return '';

  const house_no = cleanAddressPart(details.perm_house_no) || cleanAddressPart(details.curr_house_no) || '';
  const apartment = cleanAddressPart(details.perm_apartment) || cleanAddressPart(details.curr_apartment) || '';
  const street = cleanAddressPart(details.perm_street) || cleanAddressPart(details.curr_street) || '';
  const city = cleanAddressPart(details.perm_city) || cleanAddressPart(details.curr_city) || '';
  const state = cleanAddressPart(details.perm_state) || cleanAddressPart(details.curr_state) || '';
  const pincode = cleanAddressPart(details.perm_pincode) || cleanAddressPart(details.curr_pincode) || '';
  const country = cleanAddressPart(details.perm_country) || cleanAddressPart(details.curr_country) || 'India';

  const hasAnyComponent = Boolean(house_no || apartment || street || city || state || pincode);

  if (hasAnyComponent) {
    return formatAddress({
      house_no,
      apartment,
      street,
      city,
      state,
      pincode,
      country,
    });
  }

  // Fallback to unstructured address if structured fields were not available
  const fallback = details.address || details.permanent_address || details.contact_address || '';
  return sanitizeAddressString(fallback);
}

export function mapAddressStringsToFields(contactAddressStr, permanentAddressStr) {
  const perm = parseAddress(permanentAddressStr);
  const curr = parseAddress(contactAddressStr);

  return {
    perm_house_no: perm.house_no || null,
    perm_street: perm.street || null,
    perm_apartment: perm.apartment || null,
    perm_city: perm.city || null,
    perm_state: perm.state || null,
    perm_pincode: perm.pincode || null,
    perm_country: perm.country || 'India',

    curr_house_no: curr.house_no || null,
    curr_street: curr.street || null,
    curr_apartment: curr.apartment || null,
    curr_city: curr.city || null,
    curr_state: curr.state || null,
    curr_pincode: curr.pincode || null,
    curr_country: curr.country || 'India',

    is_current_same_as_permanent: (contactAddressStr && permanentAddressStr && contactAddressStr.trim().toLowerCase() === permanentAddressStr.trim().toLowerCase()) || false
  };
}

export function getProfileDisplayAddress(student) {
  if (!student) return '';
  const details = student.personal_details || student;
  const perm = getPermanentAddressFromDetails(details);
  const contact = getContactAddressFromDetails(details);
  if (contact && perm && contact.trim().toLowerCase() !== perm.trim().toLowerCase()) {
    return contact;
  }
  return perm || sanitizeAddressString(details.address || student.address || '');
}
