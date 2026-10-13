import logger from './logger.js';

/**
 * Supported email categories for the KUCET CMS transactional email system.
 * Each category routes through an isolated Brevo API key and sender identity.
 */
export const EMAIL_CATEGORIES = Object.freeze({
  AUTH_OTP: 'AUTH_OTP',
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
  SECURITY_ALERTS: 'SECURITY_ALERTS',
  STAFF_ONBOARDING: 'STAFF_ONBOARDING',
  ADMISSIONS: 'ADMISSIONS',
  SCHOLARSHIP: 'SCHOLARSHIP',
  SYSTEM_OPERATIONS: 'SYSTEM_OPERATIONS',
});

/**
 * Mapping of each email category to its corresponding API key environment variable name.
 * (Maintained for backwards-compatibility).
 */
export const CATEGORY_ENV_MAP = Object.freeze({
  [EMAIL_CATEGORIES.AUTH_OTP]: 'BREVO_API_KEY_AUTH_OTP',
  [EMAIL_CATEGORIES.PASSWORD_RECOVERY]: 'BREVO_API_KEY_PASSWORD_RECOVERY',
  [EMAIL_CATEGORIES.SECURITY_ALERTS]: 'BREVO_API_KEY_SECURITY_ALERTS',
  [EMAIL_CATEGORIES.STAFF_ONBOARDING]: 'BREVO_API_KEY_STAFF_ONBOARDING',
  [EMAIL_CATEGORIES.ADMISSIONS]: 'BREVO_API_KEY_ADMISSIONS',
  [EMAIL_CATEGORIES.SCHOLARSHIP]: 'BREVO_API_KEY_SCHOLARSHIP',
  [EMAIL_CATEGORIES.SYSTEM_OPERATIONS]: 'BREVO_API_KEY_SYSTEM_OPERATIONS',
});

/**
 * Full configuration map associating each email category with its dedicated
 * API key, sender email, sender name, and optional reply-to environment variables.
 */
export const CATEGORY_CONFIG_MAP = Object.freeze({
  [EMAIL_CATEGORIES.AUTH_OTP]: Object.freeze({
    apiKey: 'BREVO_API_KEY_AUTH_OTP',
    senderEmail: 'BREVO_SENDER_EMAIL_AUTH_OTP',
    senderName: 'BREVO_SENDER_NAME_AUTH_OTP',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_AUTH_OTP',
  }),
  [EMAIL_CATEGORIES.PASSWORD_RECOVERY]: Object.freeze({
    apiKey: 'BREVO_API_KEY_PASSWORD_RECOVERY',
    senderEmail: 'BREVO_SENDER_EMAIL_PASSWORD_RECOVERY',
    senderName: 'BREVO_SENDER_NAME_PASSWORD_RECOVERY',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_PASSWORD_RECOVERY',
  }),
  [EMAIL_CATEGORIES.SECURITY_ALERTS]: Object.freeze({
    apiKey: 'BREVO_API_KEY_SECURITY_ALERTS',
    senderEmail: 'BREVO_SENDER_EMAIL_SECURITY_ALERTS',
    senderName: 'BREVO_SENDER_NAME_SECURITY_ALERTS',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_SECURITY_ALERTS',
  }),
  [EMAIL_CATEGORIES.STAFF_ONBOARDING]: Object.freeze({
    apiKey: 'BREVO_API_KEY_STAFF_ONBOARDING',
    senderEmail: 'BREVO_SENDER_EMAIL_STAFF_ONBOARDING',
    senderName: 'BREVO_SENDER_NAME_STAFF_ONBOARDING',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_STAFF_ONBOARDING',
  }),
  [EMAIL_CATEGORIES.ADMISSIONS]: Object.freeze({
    apiKey: 'BREVO_API_KEY_ADMISSIONS',
    senderEmail: 'BREVO_SENDER_EMAIL_ADMISSIONS',
    senderName: 'BREVO_SENDER_NAME_ADMISSIONS',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_ADMISSIONS',
  }),
  [EMAIL_CATEGORIES.SCHOLARSHIP]: Object.freeze({
    apiKey: 'BREVO_API_KEY_SCHOLARSHIP',
    senderEmail: 'BREVO_SENDER_EMAIL_SCHOLARSHIP',
    senderName: 'BREVO_SENDER_NAME_SCHOLARSHIP',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_SCHOLARSHIP',
  }),
  [EMAIL_CATEGORIES.SYSTEM_OPERATIONS]: Object.freeze({
    apiKey: 'BREVO_API_KEY_SYSTEM_OPERATIONS',
    senderEmail: 'BREVO_SENDER_EMAIL_SYSTEM_OPERATIONS',
    senderName: 'BREVO_SENDER_NAME_SYSTEM_OPERATIONS',
    replyToEmail: 'BREVO_REPLY_TO_EMAIL_SYSTEM_OPERATIONS',
  }),
});

/**
 * Default human-readable sender display names applied during migration/fallback mode.
 */
export const DEFAULT_SENDER_NAMES = Object.freeze({
  [EMAIL_CATEGORIES.AUTH_OTP]: 'KUCET Authentication',
  [EMAIL_CATEGORIES.PASSWORD_RECOVERY]: 'KUCET Account Recovery',
  [EMAIL_CATEGORIES.SECURITY_ALERTS]: 'KUCET Security Alerts',
  [EMAIL_CATEGORIES.STAFF_ONBOARDING]: 'KUCET Staff Onboarding',
  [EMAIL_CATEGORIES.ADMISSIONS]: 'KUCET Admissions Office',
  [EMAIL_CATEGORIES.SCHOLARSHIP]: 'KUCET Scholarship Section',
  [EMAIL_CATEGORIES.SYSTEM_OPERATIONS]: 'KUCET System Operations',
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates if the given category is a recognized email category.
 * @param {string} category 
 * @returns {boolean}
 */
export function isValidEmailCategory(category) {
  return typeof category === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_CONFIG_MAP, category);
}

/**
 * Resolves the server-side Brevo API key for a specified category.
 *
 * Rules:
 * 1. The category must be valid and explicitly specified.
 * 2. Checks process.env for the category-specific environment variable.
 * 3. Never substitutes another category's key.
 * 4. Controlled compatibility fallback: only if ENABLE_LEGACY_BREVO_KEY_FALLBACK === 'true'
 *    and BREVO_API_KEY is defined will it emit a warning and use the legacy key.
 * 5. Otherwise, throws an explicit ConfigurationError.
 *
 * @param {string} category 
 * @returns {{ apiKey: string, envVarName: string, isFallback: boolean }}
 */
export function resolveBrevoApiKey(category) {
  if (!category || !isValidEmailCategory(category)) {
    const validList = Object.values(EMAIL_CATEGORIES).join(', ');
    throw new Error(`[EMAIL_CREDENTIAL_ERROR] Invalid or missing email category "${category}". Must be one of: ${validList}`);
  }

  const envVarName = CATEGORY_ENV_MAP[category];
  const categoryKey = process.env[envVarName]?.trim();

  if (categoryKey) {
    return {
      apiKey: categoryKey,
      envVarName,
      isFallback: false
    };
  }

  // Check controlled legacy migration compatibility mode
  const allowFallback = process.env.ENABLE_LEGACY_BREVO_KEY_FALLBACK === 'true';
  const legacyKey = process.env.BREVO_API_KEY?.trim();

  if (allowFallback && legacyKey) {
    logger.warn(
      { category, expectedEnvVar: envVarName },
      '[EMAIL_COMPATIBILITY_FALLBACK] Using legacy BREVO_API_KEY for category because category-specific key is not configured'
    );
    return {
      apiKey: legacyKey,
      envVarName: 'BREVO_API_KEY',
      isFallback: true
    };
  }

  throw new Error(`[EMAIL_CREDENTIAL_ERROR] Missing Brevo API key for category "${category}". Please configure ${envVarName} in your environment.`);
}

/**
 * Resolves the complete server-side Brevo credentials and sender identity for a specified category.
 *
 * Rules:
 * 1. The category must be valid and recognized.
 * 2. Resolves category API key, sender email, sender display name, and optional reply-to.
 * 3. In strict mode (default):
 *    - Missing category API key throws [EMAIL_CREDENTIAL_ERROR].
 *    - Missing category sender email throws [EMAIL_CONFIGURATION_ERROR].
 *    - Invalid sender email format throws [EMAIL_CONFIGURATION_ERROR].
 *    - Missing category sender display name throws [EMAIL_CONFIGURATION_ERROR].
 * 4. When ENABLE_LEGACY_BREVO_KEY_FALLBACK === 'true':
 *    - Missing API key falls back to legacy BREVO_API_KEY with a warning log.
 *    - Missing sender email falls back to legacy EMAIL_USER with a warning log.
 *    - Missing sender name falls back to category-specific DEFAULT_SENDER_NAMES with a warning log.
 * 5. Never substitutes another category's API key or sender identity.
 *
 * @param {string} category 
 * @returns {{
 *   category: string,
 *   apiKey: string,
 *   senderEmail: string,
 *   senderName: string,
 *   replyToEmail: string | undefined,
 *   isFallback: boolean,
 *   envVars: { apiKey: string, senderEmail: string, senderName: string, replyToEmail: string }
 * }}
 */
export function resolveBrevoCategoryConfig(category) {
  if (!category || !isValidEmailCategory(category)) {
    const validList = Object.values(EMAIL_CATEGORIES).join(', ');
    throw new Error(`[EMAIL_CREDENTIAL_ERROR] Invalid or missing email category "${category}". Must be one of: ${validList}`);
  }

  const configMap = CATEGORY_CONFIG_MAP[category];
  const categoryKey = process.env[configMap.apiKey]?.trim();
  const categorySenderEmail = process.env[configMap.senderEmail]?.trim();
  const categorySenderName = process.env[configMap.senderName]?.trim();
  const categoryReplyTo = process.env[configMap.replyToEmail]?.trim();

  const allowFallback = process.env.ENABLE_LEGACY_BREVO_KEY_FALLBACK === 'true';

  let apiKey = categoryKey;
  let senderEmail = categorySenderEmail;
  let senderName = categorySenderName;
  let replyToEmail = categoryReplyTo;
  let isFallback = false;

  // 1. Resolve API key
  if (!apiKey) {
    const legacyKey = process.env.BREVO_API_KEY?.trim();
    if (allowFallback && legacyKey) {
      logger.warn(
        { category, expectedEnvVar: configMap.apiKey },
        '[EMAIL_COMPATIBILITY_FALLBACK] Using legacy BREVO_API_KEY for category because category-specific key is not configured'
      );
      apiKey = legacyKey;
      isFallback = true;
    } else {
      throw new Error(`[EMAIL_CREDENTIAL_ERROR] Missing Brevo API key for category "${category}". Please configure ${configMap.apiKey} in your environment.`);
    }
  }

  // 2. Resolve Sender Email
  if (!senderEmail) {
    const legacySender = process.env.EMAIL_USER?.trim();
    if (allowFallback && legacySender) {
      logger.warn(
        { category, expectedEnvVar: configMap.senderEmail },
        '[EMAIL_COMPATIBILITY_FALLBACK] Using legacy EMAIL_USER for category because category-specific sender email is not configured'
      );
      senderEmail = legacySender;
      isFallback = true;
    } else {
      throw new Error(`[EMAIL_CONFIGURATION_ERROR] Missing sender email for category "${category}". Please configure ${configMap.senderEmail} in your environment.`);
    }
  }

  // Validate sender email address format
  if (!EMAIL_REGEX.test(senderEmail)) {
    throw new Error(`[EMAIL_CONFIGURATION_ERROR] Invalid sender email address format for category "${category}".`);
  }

  // 3. Resolve Sender Name
  if (!senderName) {
    if (allowFallback) {
      senderName = DEFAULT_SENDER_NAMES[category] || 'KUCET College Portal';
      logger.warn(
        { category, expectedEnvVar: configMap.senderName, usedName: senderName },
        '[EMAIL_COMPATIBILITY_FALLBACK] Using default sender name for category because category-specific sender name is not configured'
      );
      isFallback = true;
    } else {
      throw new Error(`[EMAIL_CONFIGURATION_ERROR] Missing sender display name for category "${category}". Please configure ${configMap.senderName} in your environment.`);
    }
  }

  // 4. Validate optional Reply-To if provided
  if (replyToEmail && !EMAIL_REGEX.test(replyToEmail)) {
    throw new Error(`[EMAIL_CONFIGURATION_ERROR] Invalid reply-to email address format for category "${category}".`);
  }

  return {
    category,
    apiKey,
    senderEmail,
    senderName,
    replyToEmail: replyToEmail || undefined,
    isFallback,
    envVars: {
      apiKey: configMap.apiKey,
      senderEmail: configMap.senderEmail,
      senderName: configMap.senderName,
      replyToEmail: configMap.replyToEmail
    }
  };
}
