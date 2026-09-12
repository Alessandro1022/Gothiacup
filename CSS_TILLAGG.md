# Lägg till sist i `app/globals.css`

```css
/* ---- Chattfixar ---- */
.chat-input { align-items: center; }
.chat-input .input { min-width: 0; flex: 1; }
.chat-input .btn { flex: 0 0 auto; white-space: nowrap; }
.chat-msg .chat-bubble { color: var(--ink); }
.chat-msg.mine .chat-bubble { color: #fff; }
@media (max-width: 600px) { .send-label { display: none; } }

/* ---- Klickbara KPI-kort ---- */
a.card { display: block; transition: transform .1s ease, box-shadow .12s ease; }
a.card:active { transform: scale(.985); }
a.card:hover { border-color: var(--primary); }
```
