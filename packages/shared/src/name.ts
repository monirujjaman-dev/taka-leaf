/** Longest name the server accepts, after cleaning. */
export const NAME_MAX_LENGTH = 100;

/**
 * Cleans a person's name as the server does (Common/NameRules.cs): trims it and turns runs of
 * spaces, tabs or new lines into one space. Both sides are tested on contract/fixtures/person-name.json.
 */
export function checkName(input: string | null | undefined): { name: string; error: null } | { name: string; error: string } {
  const name = (input ?? "").replace(/\s+/g, " ").trim();
  if (name.length === 0) return { name, error: "Enter your name." };
  if (name.length > NAME_MAX_LENGTH) return { name, error: `Use ${NAME_MAX_LENGTH} characters or fewer.` };
  return { name, error: null };
}

/** "Monir Hossain" → "M"; the letter shown in round avatars. */
export function initialOf(name: string, fallback = "?"): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : fallback;
}
