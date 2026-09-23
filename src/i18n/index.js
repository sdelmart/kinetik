import fr from './fr.js';
import en from './en.js';
import es from './es.js';
import de from './de.js';

const CATALOGS = { fr, en, es, de };

export const LANGUAGES = Object.keys(CATALOGS);

export const LANGUAGE_NAMES = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
};

let current = 'fr';

export function setLanguage(code) {
  current = CATALOGS[code] ? code : 'fr';
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  return current;
}

export function getLanguage() {
  return current;
}

/**
 * Looks up `key`, falling back to English and then to the key itself so a
 * missing string is visible rather than blank. `{name}` placeholders in the
 * string are filled from `vars`.
 */
export function t(key, vars) {
  const value = CATALOGS[current]?.[key] ?? CATALOGS.en[key] ?? key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

export { CATALOGS };
