/**
 * Map Yardi property codes to display names.
 * Add entries here as you onboard new properties.
 */
const PROPERTY_NAMES: Record<string, string> = {
  margar: "Marcus Garvey",
  // Add more properties as needed:
  // "propcode": "Display Name",
};

/** Get the display name for a property code, falling back to the code itself */
export function propertyDisplayName(code: string): string {
  const normalized = code.toLowerCase().trim();
  return PROPERTY_NAMES[normalized] || titleCase(code);
}

function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
