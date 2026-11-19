# CANTORIA — Specifica di allineamento musicale geometrico

## Principio non negoziabile
La relazione fra accordo e carattere/sillaba del testo cantato viene prima dell'estetica. Non è sufficiente riconoscere nomi e ordine degli accordi. La resa su iPhone, iPad, PDF e futuri formati deve conservarne gli ancoraggi, anche se cambiano font, scala o impaginazione. Quando non è possibile confermare una posizione, non si deve inventarla: si segnala la verifica manuale.

## Pipeline
1. Acquisizione di foto, immagini e in futuro PDF/screenshot, mantenendo la copia di riferimento associata al canto.
2. OCR con *bounding box* di righe e parole; preferire i box per carattere/simbolo se disponibili.
3. Segmentazione: titoli candidati, sezioni (INTRO, STROFA, RITORNELLO, FINALE), versi, sequenze armoniche, annotazioni da verificare.
4. Associazione di ciascun accordo a un carattere o a una sillaba, conservando `sourceX`, `sourceBBox`, `sourceLineBBox`, `anchorCharacterIndex`, `offsetX` (eventuale anticipazione), `confidence`, `verified` e `needsReview`.
5. Se esistono solo box delle parole, l'indice del carattere viene **stimato** al loro interno, con `anchorMethod = 'word-estimated'` e `needsReview = true`. Non trattare questa stima come una verifica.
6. Render mediante ancoraggio semantico al carattere visualizzato; l'offset di anticipo viene scalato usando la larghezza del glifo. Gli accordi **non** vengono riposizionati orizzontalmente per distribuire il testo: collisioni eventuali usano soltanto corsie verticali.
7. PDF: trasformare il carattere di riferimento e il relativo anticipo nello stesso sistema geometrico del testo esportato.
8. Correzione manuale: modificare ancoraggi verificati, conservando separatamente bbox e testo originali. Se il testo cambia, invalidare le coordinate semantiche incompatibili e richiedere nuova verifica.
9. Controllo: distinguere `totalRecognized`, `totalAnchored`, `unresolved`, `estimated`, `needsReview`. Nessun accordo incerto deve apparire come verificato.

## Criterio di accettazione
Un musicista che legge la partitura digitale deve poter effettuare tutti i cambi di accordo esattamente sulle stesse sillabe dello spartito originale, anche dopo visualizzazione responsive e PDF. Ogni caso senza coordinate o ambiguo deve essere segnalato e correggibile prima di dichiarare il brano verificato.

## Stato delle funzionalità
- **Implementato in fase sperimentale:** OCR geometrico Tesseract, bbox delle parole/caratteri quando presenti, ancoraggi persistenti, flag di incertezza, correzioni manuali, adattamento grafico senza spostare X, esportazione PDF con ancoraggi ai caratteri, riferimento alla foto originale.
- **Non ancora garantito:** accuratezza musicale reale su tutte le foto, OCR di bassa qualità, OCR musicale di pentagrammi, verifica incrociata automatica perfetta; occorre collaudo su immagini reali e comparazione con la fonte.
- **Da sviluppare:** supporto completo all'importazione PDF multipagina, JPEG multipagina esportabili, gestione evoluta dei versi a capo e degli elementi editoriali, test visuali di regressione su molti dispositivi, verifica di corrispondenza automatica più rigorosa.
- **Integrazione OpenAI opzionale:** utilizzare un modello visivo tramite Responses API **solo tramite un backend autenticato**, con chiave riservata sul server e costi di elaborazione espliciti. Il modello può proporre letture e segnalare incertezze ma **non** sostituisce le coordinate OCR, né determina in modo incontrollato gli ancoraggi definitivi. Non inviare immagini a servizi esterni senza informare l'utente e gestire il consenso e la privacy.

## Formula di trasformazione
`xNuovo = offsetNuovo + (xOriginale - origineOriginale) * scala`.
Per una sillaba responsive l'ancoraggio semantico resta costante; il delta di anticipo si scala per il rapporto fra larghezze del carattere originale e del carattere reso.

## Nota sull'accuratezza
L'etichetta `word-estimated` implica che non sono disponibili vere coordinate per singolo carattere: l'app deve indicare chiaramente che l'ancoraggio è **da verificare**, mai presentarlo come preciso. Il collaudo umano è obbligatorio prima di usare una partitura come verificata.
