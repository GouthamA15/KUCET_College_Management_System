import BrevoEmailProvider from './BrevoEmailProvider';

let instance = null;

export function getEmailProvider() {
  if (instance) return instance;

  const type = process.env.EMAIL_PROVIDER || 'brevo';

  switch (type.toLowerCase()) {
    case 'brevo':
    default:
      instance = new BrevoEmailProvider(
        process.env.BREVO_API_KEY,
        process.env.EMAIL_USER
      );
      break;
  }

  return instance;
}
