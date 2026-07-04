// Lätt i18n. SV är källa; saknad nyckel faller tillbaka till SV.
export type Lang = 'sv' | 'en' | 'no' | 'de' | 'es' | 'fr';
export const LANGS: Lang[] = ['sv', 'en', 'no', 'de', 'es', 'fr'];

const sv = {
  dashboard: 'Översikt', incidents: 'Incidenter', tasks: 'Uppgifter', logout: 'Logga ut',
  gOverview: 'Översikt', gOps: 'Drift', gMgmt: 'Ledning',
  create: 'Skapa', cancel: 'Avbryt', title: 'Titel', description: 'Beskrivning',
  severity: 'Allvarlighet', status: 'Status', assign: 'Tilldela', unassigned: 'Otilldelad',
  location: 'Plats', none: 'Ingen', all: 'Alla', loading: 'Laddar…', priority: 'Prioritet',
  myTasks: 'Mina uppgifter', myIncidents: 'Mina incidenter',
  openIncidents: 'Öppna incidenter', criticalNow: 'Kritiska nu', openTasks: 'Öppna uppgifter',
  latestIncidents: 'Senaste incidenter', newIncident: 'Ny incident', newTask: 'Ny uppgift',
  signIn: 'Logga in', email: 'E-post', password: 'Lösenord',
  magicLink: 'Skicka magisk länk', magicSent: 'Länk skickad – kolla din inkorg',
  staffing: 'Bemanning', nothingHere: 'Inget här ännu.',
  sevLow: 'Låg', sevMedium: 'Medel', sevHigh: 'Hög', sevCritical: 'Kritisk',
  stOpen: 'Öppen', stInProgress: 'Pågår', stResolved: 'Löst',
  tTodo: 'Att göra', tInProgress: 'Pågår', tDone: 'Klar',
  prLow: 'Låg', prNormal: 'Normal', prHigh: 'Hög',
  markInProgress: 'Påbörja', markResolved: 'Markera löst', reopen: 'Öppna igen'
};

type Key = keyof typeof sv;

const en: Partial<Record<Key, string>> = {
  dashboard: 'Overview', incidents: 'Incidents', tasks: 'Tasks', logout: 'Sign out',
  gOverview: 'Overview', gOps: 'Operations', gMgmt: 'Management',
  create: 'Create', cancel: 'Cancel', title: 'Title', description: 'Description',
  severity: 'Severity', status: 'Status', assign: 'Assign', unassigned: 'Unassigned',
  location: 'Location', none: 'None', all: 'All', loading: 'Loading…', priority: 'Priority',
  myTasks: 'My tasks', myIncidents: 'My incidents',
  openIncidents: 'Open incidents', criticalNow: 'Critical now', openTasks: 'Open tasks',
  latestIncidents: 'Latest incidents', newIncident: 'New incident', newTask: 'New task',
  signIn: 'Sign in', email: 'Email', password: 'Password',
  magicLink: 'Send magic link', magicSent: 'Link sent – check your inbox',
  staffing: 'Staffing', nothingHere: 'Nothing here yet.',
  sevLow: 'Low', sevMedium: 'Medium', sevHigh: 'High', sevCritical: 'Critical',
  stOpen: 'Open', stInProgress: 'In progress', stResolved: 'Resolved',
  tTodo: 'To do', tInProgress: 'In progress', tDone: 'Done',
  prLow: 'Low', prNormal: 'Normal', prHigh: 'High',
  markInProgress: 'Start', markResolved: 'Mark resolved', reopen: 'Reopen'
};

const no: Partial<Record<Key, string>> = {
  dashboard: 'Oversikt', incidents: 'Hendelser', tasks: 'Oppgaver', logout: 'Logg ut',
  signIn: 'Logg inn', email: 'E-post', password: 'Passord', create: 'Opprett', cancel: 'Avbryt',
  openIncidents: 'Åpne hendelser', openTasks: 'Åpne oppgaver', myTasks: 'Mine oppgaver'
};
const de: Partial<Record<Key, string>> = {
  dashboard: 'Übersicht', incidents: 'Vorfälle', tasks: 'Aufgaben', logout: 'Abmelden',
  signIn: 'Anmelden', email: 'E-Mail', password: 'Passwort', create: 'Erstellen', cancel: 'Abbrechen',
  openIncidents: 'Offene Vorfälle', openTasks: 'Offene Aufgaben', myTasks: 'Meine Aufgaben'
};
const es: Partial<Record<Key, string>> = {
  dashboard: 'Resumen', incidents: 'Incidencias', tasks: 'Tareas', logout: 'Cerrar sesión',
  signIn: 'Iniciar sesión', email: 'Correo', password: 'Contraseña', create: 'Crear', cancel: 'Cancelar',
  openIncidents: 'Incidencias abiertas', openTasks: 'Tareas abiertas', myTasks: 'Mis tareas'
};
const fr: Partial<Record<Key, string>> = {
  dashboard: 'Aperçu', incidents: 'Incidents', tasks: 'Tâches', logout: 'Déconnexion',
  signIn: 'Connexion', email: 'E-mail', password: 'Mot de passe', create: 'Créer', cancel: 'Annuler',
  openIncidents: 'Incidents ouverts', openTasks: 'Tâches ouvertes', myTasks: 'Mes tâches'
};

const dicts: Record<Lang, Partial<Record<Key, string>>> = { sv, en, no, de, es, fr };

export function t(lang: Lang, key: Key): string {
  return dicts[lang]?.[key] ?? sv[key] ?? key;
}
export type { Key as TKey };
