// Lätt i18n. SV är källa; saknad nyckel faller tillbaka till SV.
export type Lang = 'sv' | 'en' | 'no' | 'de' | 'es' | 'fr';
export const LANGS: Lang[] = ['sv', 'en', 'no', 'de', 'es', 'fr'];

const sv = {
  dashboard: 'Översikt', incidents: 'Incidenter', tasks: 'Uppgifter', logout: 'Logga ut',
  gOverview: 'Översikt', gOps: 'Drift', gArea: 'Områdesdrift', gMgmt: 'Ledning', gComms: 'Kommunikation',
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
  startTime: 'Start', endTime: 'Slut', person: 'Person',
  shPlanned: 'Planerat', shMissed: 'Missat',
  addMatch: 'Ny match', homeTeam: 'Hemmalag', awayTeam: 'Bortalag', category: 'Klass',
  msScheduled: 'Planerad', msOngoing: 'Pågår', msFinished: 'Slut', msCancelled: 'Inställd',
  addEntry: 'Logga händelse', newCount: 'Ny räkning', latestCount: 'Senaste räkning',
  countLbl: 'Antal', startRun: 'Starta checklista',
  tmExpected: 'Väntas', tmCheckedIn: 'Incheckad', tmCheckedOut: 'Utcheckad',
  back: 'Tillbaka', save: 'Spara', remove: 'Ta bort', name: 'Namn',
  addClassroom: 'Nytt klassrum', addKey: 'Ny nyckel',
  keyIn: 'Inne', keyOut: 'Utlämnad', keyLost: 'Förlorad',
  roleLbl: 'Roll', scopeTitle: 'Behörighet', wholeArea: 'Helt område', singlePlace: 'Enskild plats',
  searchLbl: 'Sök…', openIssues: 'Öppna fel', teamsIn: 'Incheckade lag',
  live: 'LIVE', upcoming: 'Kommande',
  // ---- Del 3 ----
  reports: 'Rapporter', news: 'Nyheter', chat: 'Chatt', docs: 'Dokument',
  crisis: 'Krisläge', settings: 'Inställningar', more: 'Mer',
  edit: 'Redigera', deleteLbl: 'Radera', confirmDelete: 'Radera? Detta går inte att ångra.',
  comments: 'Kommentarer', send: 'Skicka', writeMsg: 'Skriv meddelande…',
  pinnedLbl: 'Fäst', pin: 'Fäst', unpin: 'Släpp', newPost: 'Nytt inlägg', minTier: 'Synlig från nivå',
  general: 'Allmänt', leadershipCh: 'Ledning',
  addDoc: 'Nytt dokument', urlLbl: 'Länk (URL)', categoryLbl: 'Kategori', openDoc: 'Öppna',
  activateCrisis: 'Aktivera krisläge', deactivateCrisis: 'Avaktivera',
  crisisActive: 'KRISLÄGE AKTIVT', crisisMsg: 'Krismeddelande', crisisInactive: 'Krisläge inaktivt.',
  requestSwap: 'Begär byte', swapReqs: 'Bytesförfrågningar', approve: 'Godkänn', reject: 'Neka',
  swPending: 'Väntar', swApproved: 'Godkänt', swRejected: 'Nekat',
  checkinCode: 'Incheckningskod', showQr: 'Visa QR', codeCheckin: 'Checka in med kod',
  codeLbl: 'Kod', wrongCode: 'Ingen matchande kod på dina pass.', checkedInOk: 'Incheckad!',
  perDay7: 'Incidenter · 7 dagar', bySeverity: 'Per allvarlighet', fillRate: 'Passtäckning just nu',
  occupancyLbl: 'Beläggning per skola', openVsResolved: 'Öppna / lösta',
  eventName: 'Eventnamn', primaryColor: 'Primärfärg (hex)', saveSettings: 'Spara inställningar',
  settingsSaved: 'Sparat. Slår igenom direkt för alla.', resetLbl: 'Rensa överstyrning',
  scope: 'Behörighet', noScope: 'Ingen behörighet', perDay: 'Per dag',
  aiTitle: 'AI-assistent', aiSub: 'Dagsrapporter, flaggade matcher och säkerhetsrutter',
  aiOverview: 'Översikt', aiSecurity: 'Säkerhet', aiMorning: 'Morgon', aiEvening: 'Kväll', aiManual: 'Manuell',
  aiWorking: 'Genererar…', aiNoReport: 'Ingen rapport ännu – tryck Generera, eller vänta på nästa schemalagda körning (07:00/21:00).',
  generate: 'Generera', askAi: 'Fråga AI:n', askPlaceholder: 'Fråga om läget…',
  history: 'Historik', historySub: 'Vem som gjort vad – alla ändringar loggas',
  invite: 'Bjud in', inviteSent: 'Inbjudan skickad – personen får ett mejl.', sendInvite: 'Skicka inbjudan',
  riskLbl: 'Risknivå', riskGreen: 'Grön', riskYellow: 'Gul', riskRed: 'Röd',
  riskLegend: 'Grön = planvärd + domare · Gul = matchdelegat kopplas in · Röd = säkerhetsgruppen',
  autoAssign: 'Fördela lag automatiskt', autoAssigned: 'lag fördelades till klassrum',
  detailsLbl: 'Detaljer', assignedTo: 'Tilldelad', reportedBy: 'Rapporterad av', createdLbl: 'Skapad'
};

type Key = keyof typeof sv;

const en: Partial<Record<Key, string>> = {
  dashboard: 'Overview', incidents: 'Incidents', tasks: 'Tasks', logout: 'Sign out',
  gOverview: 'Overview', gOps: 'Operations', gArea: 'Area ops', gMgmt: 'Management', gComms: 'Communication',
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
  startTime: 'Start', endTime: 'End', person: 'Person',
  shPlanned: 'Planned', shMissed: 'Missed',
  addMatch: 'New match', homeTeam: 'Home team', awayTeam: 'Away team', category: 'Category',
  msScheduled: 'Scheduled', msOngoing: 'Live', msFinished: 'Finished', msCancelled: 'Cancelled',
  addEntry: 'Log entry', newCount: 'New count', latestCount: 'Latest count',
  countLbl: 'Count', startRun: 'Start checklist',
  tmExpected: 'Expected', tmCheckedIn: 'Checked in', tmCheckedOut: 'Checked out',
  back: 'Back', save: 'Save', remove: 'Remove', name: 'Name',
  addClassroom: 'New classroom', addKey: 'New key',
  keyIn: 'In', keyOut: 'Out', keyLost: 'Lost',
  roleLbl: 'Role', scopeTitle: 'Access', wholeArea: 'Whole area', singlePlace: 'Single place',
  searchLbl: 'Search…', openIssues: 'Open issues', teamsIn: 'Teams checked in',
  live: 'LIVE', upcoming: 'Upcoming',
  reports: 'Reports', news: 'News', chat: 'Chat', docs: 'Documents',
  crisis: 'Crisis mode', settings: 'Settings', more: 'More',
  edit: 'Edit', deleteLbl: 'Delete', confirmDelete: 'Delete? This cannot be undone.',
  comments: 'Comments', send: 'Send', writeMsg: 'Write a message…',
  pinnedLbl: 'Pinned', pin: 'Pin', unpin: 'Unpin', newPost: 'New post', minTier: 'Visible from tier',
  general: 'General', leadershipCh: 'Leadership',
  addDoc: 'New document', urlLbl: 'Link (URL)', categoryLbl: 'Category', openDoc: 'Open',
  activateCrisis: 'Activate crisis mode', deactivateCrisis: 'Deactivate',
  crisisActive: 'CRISIS MODE ACTIVE', crisisMsg: 'Crisis message', crisisInactive: 'Crisis mode inactive.',
  requestSwap: 'Request swap', swapReqs: 'Swap requests', approve: 'Approve', reject: 'Reject',
  swPending: 'Pending', swApproved: 'Approved', swRejected: 'Rejected',
  checkinCode: 'Check-in code', showQr: 'Show QR', codeCheckin: 'Check in with code',
  codeLbl: 'Code', wrongCode: 'No matching code on your shifts.', checkedInOk: 'Checked in!',
  perDay7: 'Incidents · 7 days', bySeverity: 'By severity', fillRate: 'Shift coverage now',
  occupancyLbl: 'Occupancy per school', openVsResolved: 'Open / resolved',
  eventName: 'Event name', primaryColor: 'Primary color (hex)', saveSettings: 'Save settings',
  settingsSaved: 'Saved. Applies instantly for everyone.', resetLbl: 'Clear override',
  scope: 'Access', noScope: 'No access', perDay: 'Per day',
  aiTitle: 'AI assistant', aiSub: 'Daily reports, flagged matches and security routes',
  aiOverview: 'Overview', aiSecurity: 'Security', aiMorning: 'Morning', aiEvening: 'Evening', aiManual: 'Manual',
  aiWorking: 'Generating…', aiNoReport: 'No report yet – press Generate, or wait for the next scheduled run (07:00/21:00).',
  generate: 'Generate', askAi: 'Ask the AI', askPlaceholder: 'Ask about the situation…',
  history: 'History', historySub: 'Who did what – every change is logged',
  invite: 'Invite', inviteSent: 'Invitation sent – they will receive an email.', sendInvite: 'Send invitation',
  riskLbl: 'Risk level', riskGreen: 'Green', riskYellow: 'Yellow', riskRed: 'Red',
  riskLegend: 'Green = pitch host + referee · Yellow = match delegate · Red = security group',
  autoAssign: 'Auto-assign teams', autoAssigned: 'teams assigned to classrooms',
  detailsLbl: 'Details', assignedTo: 'Assigned to', reportedBy: 'Reported by', createdLbl: 'Created'
};

const no: Partial<Record<Key, string>> = {
  dashboard: 'Oversikt', incidents: 'Hendelser', tasks: 'Oppgaver', logout: 'Logg ut',
  signIn: 'Logg inn', email: 'E-post', password: 'Passord', create: 'Opprett', cancel: 'Avbryt',
  openIncidents: 'Åpne hendelser', openTasks: 'Åpne oppgaver', myTasks: 'Mine oppgaver',
  shifts: 'Vakter', news: 'Nyheter', chat: 'Chat', docs: 'Dokumenter'
};
const de: Partial<Record<Key, string>> = {
  dashboard: 'Übersicht', incidents: 'Vorfälle', tasks: 'Aufgaben', logout: 'Abmelden',
  signIn: 'Anmelden', email: 'E-Mail', password: 'Passwort', create: 'Erstellen', cancel: 'Abbrechen',
  openIncidents: 'Offene Vorfälle', openTasks: 'Offene Aufgaben', myTasks: 'Meine Aufgaben',
  shifts: 'Schichten', news: 'Nachrichten', chat: 'Chat', docs: 'Dokumente'
};
const es: Partial<Record<Key, string>> = {
  dashboard: 'Resumen', incidents: 'Incidencias', tasks: 'Tareas', logout: 'Cerrar sesión',
  signIn: 'Iniciar sesión', email: 'Correo', password: 'Contraseña', create: 'Crear', cancel: 'Cancelar',
  openIncidents: 'Incidencias abiertas', openTasks: 'Tareas abiertas', myTasks: 'Mis tareas',
  shifts: 'Turnos', news: 'Noticias', chat: 'Chat', docs: 'Documentos'
};
const fr: Partial<Record<Key, string>> = {
  dashboard: 'Aperçu', incidents: 'Incidents', tasks: 'Tâches', logout: 'Déconnexion',
  signIn: 'Connexion', email: 'E-mail', password: 'Mot de passe', create: 'Créer', cancel: 'Annuler',
  openIncidents: 'Incidents ouverts', openTasks: 'Tâches ouvertes', myTasks: 'Mes tâches',
  shifts: 'Gardes', news: 'Actualités', chat: 'Chat', docs: 'Documents'
};

const dicts: Record<Lang, Partial<Record<Key, string>>> = { sv, en, no, de, es, fr };

export function t(lang: Lang, key: Key): string {
  return dicts[lang]?.[key] ?? sv[key] ?? key;
}
export type { Key as TKey };
