// Lätt i18n. SV är källa; saknad nyckel faller tillbaka till SV.
export type Lang = 'sv' | 'en' | 'no' | 'de' | 'es' | 'fr';
export const LANGS: Lang[] = ['sv', 'en', 'no', 'de', 'es', 'fr'];

const sv = {
  dashboard: 'Översikt', incidents: 'Incidenter', tasks: 'Uppgifter', logout: 'Logga ut',
  gOverview: 'Översikt', gOps: 'Drift', gArea: 'Områdesdrift', gMgmt: 'Ledning',
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
  markInProgress: 'Påbörja', markResolved: 'Markera löst', reopen: 'Öppna igen',
  // ---- Del 2 ----
  shifts: 'Pass', staff: 'Personal', teams: 'Lag', classrooms: 'Klassrum',
  roomKeys: 'Nycklar', issues: 'Felanmälan', nightRounds: 'Nattrond',
  matchesLbl: 'Matcher', securityLog: 'Säkerhetslogg', crowd: 'Publik', checklists: 'Checklistor',
  checkIn: 'Checka in', checkOut: 'Checka ut',
  addTeam: 'Lägg till lag', newIssue: 'Ny felanmälan', newRound: 'Ny rond',
  allOk: 'Allt OK', notes: 'Anteckningar', capacity: 'Kapacitet',
  contactName: 'Kontaktperson', phone: 'Telefon', country: 'Land', groupSize: 'Antal personer',
  holder: 'Innehavare', newShift: 'Nytt pass', myShifts: 'Mina pass', allShifts: 'Alla pass',
  save: 'Spara', name: 'Namn', addClassroom: 'Nytt klassrum',
  tmExpected: 'Väntas', tmCheckedIn: 'Incheckad', tmCheckedOut: 'Utcheckad',
  homeTeam: 'Hemmalag', awayTeam: 'Bortalag', category: 'Klass', countLbl: 'Antal',
  addEntry: 'Logga händelse', newCount: 'Ny räkning', startRun: 'Starta checklista',
  back: 'Tillbaka', addKey: 'Ny nyckel', keyIn: 'Inne', keyOut: 'Utlämnad', keyLost: 'Förlorad',
  remove: 'Ta bort', addMatch: 'Ny match',
  msScheduled: 'Planerad', msOngoing: 'Pågår', msFinished: 'Slut', msCancelled: 'Inställd',
  shPlanned: 'Planerat', shMissed: 'Missat',
  scope: 'Behörighet', wholeArea: 'Helt område', singlePlace: 'Enskild plats',
  latestCount: 'Senaste räkning', person: 'Person', roleLbl: 'Roll',
  openIssues: 'Öppna fel', teamsIn: 'Incheckade lag', live: 'LIVE',
  startTime: 'Start', endTime: 'Slut', details: 'Detaljer',
  noScope: 'Ingen behörighet tilldelad'
};

type Key = keyof typeof sv;

const en: Partial<Record<Key, string>> = {
  dashboard: 'Overview', incidents: 'Incidents', tasks: 'Tasks', logout: 'Sign out',
  gOverview: 'Overview', gOps: 'Operations', gArea: 'Area ops', gMgmt: 'Management',
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
  markInProgress: 'Start', markResolved: 'Mark resolved', reopen: 'Reopen',
  shifts: 'Shifts', staff: 'Staff', teams: 'Teams', classrooms: 'Classrooms',
  roomKeys: 'Keys', issues: 'Issues', nightRounds: 'Night rounds',
  matchesLbl: 'Matches', securityLog: 'Security log', crowd: 'Crowd', checklists: 'Checklists',
  checkIn: 'Check in', checkOut: 'Check out',
  addTeam: 'Add team', newIssue: 'New issue', newRound: 'New round',
  allOk: 'All OK', notes: 'Notes', capacity: 'Capacity',
  contactName: 'Contact', phone: 'Phone', country: 'Country', groupSize: 'Group size',
  holder: 'Holder', newShift: 'New shift', myShifts: 'My shifts', allShifts: 'All shifts',
  save: 'Save', name: 'Name', addClassroom: 'Add classroom',
  tmExpected: 'Expected', tmCheckedIn: 'Checked in', tmCheckedOut: 'Checked out',
  homeTeam: 'Home team', awayTeam: 'Away team', category: 'Category', countLbl: 'Count',
  addEntry: 'Log entry', newCount: 'New count', startRun: 'Start checklist',
  back: 'Back', addKey: 'Add key', keyIn: 'In', keyOut: 'Out', keyLost: 'Lost',
  remove: 'Remove', addMatch: 'New match',
  msScheduled: 'Scheduled', msOngoing: 'Live', msFinished: 'Finished', msCancelled: 'Cancelled',
  shPlanned: 'Planned', shMissed: 'Missed',
  scope: 'Access', wholeArea: 'Whole area', singlePlace: 'Single place',
  latestCount: 'Latest count', person: 'Person', roleLbl: 'Role',
  openIssues: 'Open issues', teamsIn: 'Teams in', live: 'LIVE',
  startTime: 'Start', endTime: 'End', details: 'Details',
  noScope: 'No access assigned'
};

const no: Partial<Record<Key, string>> = {
  dashboard: 'Oversikt', incidents: 'Hendelser', tasks: 'Oppgaver', logout: 'Logg ut',
  signIn: 'Logg inn', email: 'E-post', password: 'Passord', create: 'Opprett', cancel: 'Avbryt',
  openIncidents: 'Åpne hendelser', openTasks: 'Åpne oppgaver', myTasks: 'Mine oppgaver',
  shifts: 'Vakter', staff: 'Personale', teams: 'Lag', checkIn: 'Sjekk inn', checkOut: 'Sjekk ut'
};
const de: Partial<Record<Key, string>> = {
  dashboard: 'Übersicht', incidents: 'Vorfälle', tasks: 'Aufgaben', logout: 'Abmelden',
  signIn: 'Anmelden', email: 'E-Mail', password: 'Passwort', create: 'Erstellen', cancel: 'Abbrechen',
  openIncidents: 'Offene Vorfälle', openTasks: 'Offene Aufgaben', myTasks: 'Meine Aufgaben',
  shifts: 'Schichten', staff: 'Personal', teams: 'Teams', checkIn: 'Einchecken', checkOut: 'Auschecken'
};
const es: Partial<Record<Key, string>> = {
  dashboard: 'Resumen', incidents: 'Incidencias', tasks: 'Tareas', logout: 'Cerrar sesión',
  signIn: 'Iniciar sesión', email: 'Correo', password: 'Contraseña', create: 'Crear', cancel: 'Cancelar',
  openIncidents: 'Incidencias abiertas', openTasks: 'Tareas abiertas', myTasks: 'Mis tareas',
  shifts: 'Turnos', staff: 'Personal', teams: 'Equipos', checkIn: 'Registrar entrada', checkOut: 'Registrar salida'
};
const fr: Partial<Record<Key, string>> = {
  dashboard: 'Aperçu', incidents: 'Incidents', tasks: 'Tâches', logout: 'Déconnexion',
  signIn: 'Connexion', email: 'E-mail', password: 'Mot de passe', create: 'Créer', cancel: 'Annuler',
  openIncidents: 'Incidents ouverts', openTasks: 'Tâches ouvertes', myTasks: 'Mes tâches',
  shifts: 'Vacations', staff: 'Personnel', teams: 'Équipes', checkIn: 'Arrivée', checkOut: 'Départ'
};

const dicts: Record<Lang, Partial<Record<Key, string>>> = { sv, en, no, de, es, fr };

export function t(lang: Lang, key: Key): string {
  return dicts[lang]?.[key] ?? sv[key] ?? key;
}
export type { Key as TKey };
