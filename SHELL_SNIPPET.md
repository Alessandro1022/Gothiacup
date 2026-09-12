# Två rader att lägga in i `components/Shell.tsx`

## 1. Ikoner
Hitta raden som börjar med `Newspaper, MessageSquare, FileText, ...` och lägg till
`Map as MapIcon` och `Building2` i samma import från `lucide-react`.

Exempel:
```
  Newspaper, MessageSquare, FileText, Siren, Settings2, Sparkles, History, Map as MapIcon, Building2
} from 'lucide-react';
```

## 2. Navigationslänkar

Under gruppen **Områdesdrift**, efter raden med `/arenas`, lägg till:
```
        { href: '/map', label: 'Karta', Icon: MapIcon, minTier: 2 },
```

Under gruppen **Ledning**, efter raden med `/history`, lägg till:
```
        { href: '/structure', label: 'Struktur', Icon: Building2, minTier: 5 },
```

Klart. Inga andra ändringar behövs.
