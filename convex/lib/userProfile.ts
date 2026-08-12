const MAX_PROFILE_NAME_PART_LENGTH = 80;
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

export function normalizeProfileNamePart(value: string, fieldLabel: string) {
  const normalized = value.trim().replace(/\s+/gu, " ");

  if (!normalized) {
    throw new Error(`${fieldLabel} is required`);
  }
  if (normalized.length > MAX_PROFILE_NAME_PART_LENGTH) {
    throw new Error(`${fieldLabel} is too long`);
  }
  if (UNSAFE_NAME_CHARACTERS.test(normalized)) {
    throw new Error(`${fieldLabel} contains unsupported characters`);
  }

  return normalized;
}

export function normalizedProfileName(firstName: string, lastName: string) {
  const normalizedFirstName = normalizeProfileNamePart(firstName, "First name");
  const normalizedLastName = normalizeProfileNamePart(lastName, "Last name");

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    name: `${normalizedFirstName} ${normalizedLastName}`
  };
}
