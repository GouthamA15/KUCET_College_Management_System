export const DEVELOPER_EMAILS = [
  "sunnysunnit@gmail.com",
  "testersybau67@gmail.com",
  "uzair.mdf@gmail.com"
];

export function isDeveloper(email) {
  return DEVELOPER_EMAILS.includes(email?.toLowerCase());
}
