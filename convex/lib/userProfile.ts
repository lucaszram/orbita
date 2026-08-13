const MAX_PROFILE_NAME_PART_LENGTH = 80;
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

function normalizedNamePart(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function isValidPersistedProfileNamePart(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = normalizedNamePart(value);
  return Boolean(
    normalized &&
      normalized.length <= MAX_PROFILE_NAME_PART_LENGTH &&
      !UNSAFE_NAME_CHARACTERS.test(normalized)
  );
}

export function normalizeProfileNamePart(value: string, fieldLabel: string) {
  const normalized = normalizedNamePart(value);

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
