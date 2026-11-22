## CANTORIA 1.1 (38) — display sempre acceso quando l'app iOS è attiva (22 novembre 2026)

- Schermo iPhone/iPad mantenuto acceso automaticamente in tutte le sezioni mentre CANTORIA è in primo piano, non soltanto durante il riconoscimento degli accordi.
- Protezione implementata nativamente con UIApplication.isIdleTimerDisabled e osservatori del ciclo di vita UIKit, per funzionare anche in WKWebView quando navigator.wakeLock non è supportato.
- Quando CANTORIA diventa inattiva, va in background o il dispositivo viene bloccato, il timer di spegnimento di sistema viene ripristinato.
- Script idempotente inserito nel percorso di generazione Capacitor dopo npx cap sync ios; verifica di sicurezza obbligatoria e test automatici su template AppDelegate.
- Versione 1.1 build 38. I controlli contro avvio nero, firma Apple e pubblicazione TestFlight rimangono attivi.

---

## Cantoria 1.1 (37) — ordine Home e icona Impostazioni a ingranaggio (22 novembre 2026)

- Home, ordine visivo: Acquisisci, Biblioteca, Messe, Impostazioni; in portrait su due righe da due e in landscape su quattro colonne.
- L'icona Impostazioni diventa un ingranaggio stilizzato in SVG a contorno, mantenendo colori, bordo e sfondo semitrasparente verde al 15%.
- I colori degli altri tasti sono associati alla funzione (data-nav) invece che alla posizione, così non si alterano quando vengono riordinati.
- Nessun cambiamento al motore di rilevamento degli accordi e alla scaletta delle Messe.
- Build 37, aggiornamento della cache offline, test specifico e rilascio TestFlight automatico.

---

## Cantoria 1.1 (36) — continuità del rilevamento accordi durante il live (22 novembre 2026)

- Microfono ripristinato se la traccia di acquisizione termina oppure resta muta a lungo; AudioContext sospeso riattivato su ritorno in primo piano.
- Rilevamento a 80 ms sempre pianificato anche dopo sospensione iOS o eccezioni Web Audio; schermo mantenuto acceso attraverso Wake Lock quando supportato, rilasciato a stop.
- La partitura può riallinearsi ad accordi vicini quando quello precedente non viene riconosciuto: massimo due cambi saltati e solo se il riconoscimento è forte, stabile e distinguibile.
- Nessun avanzamento inventato per timer durante pause o silenzio. Le frecce avanti/indietro restano disponibili mentre il microfono ascolta.
- Nuovi test automatici simulano un live prolungato, la sospensione iOS, una traccia microfono terminata e il recupero di un accordo perso.
- Build 36; firma Apple cloud e controlli contro lo schermo nero invariati.

---

## Cantoria 1.1 (35) — sfondo verde delle icone Home al 15% (22 novembre 2026)

- I quattro riquadri Home usano background rgba(23,68,55,.15), senza modificare bordi, icone e testo.
- Il titolo e la data della Messa restano centrati e il conteggio resta a destra.
- Numero build 35, cache service worker aggiornata, nuova pipeline TestFlight.

---

## Cantoria 1.1 (34) — Home con sfondo icone verde 50% e titolo Messa centrato (21 novembre 2026)

- I quattro riquadri delle icone Home usano lo sfondo verde rgba(23,68,55,.5); la trasparenza riguarda solo lo sfondo e lascia le icone leggibili.
- Titolo, etichetta e data della scaletta Messa centrati nell'intestazione, conteggio canti ancora a destra e tasto Indietro invariato.
- Layout Biblioteca e lista Messa landscape invariati; regressioni testate automaticamente.
- Versione app 1.1 build 34; nuovo rilascio TestFlight, la pipeline sostituisce la build precedente.

---

## Cantoria 1.1 (33) — nuova pubblicazione TestFlight con ripristino simulatore (21 novembre 2026)

- Nuovo archivio iOS, numero di build 33, stesse funzionalità della build 32.
- Il controllo obbligatorio contro l'avvio con schermo nero usa comandi del simulatore con un tempo massimo e terminazione dei processi bloccati.
- Se la prima prova fallisce, il simulatore viene spento e inizializzato nuovamente e il controllo viene ripetuto una sola volta.
- La firma e il caricamento su Apple rimangono vietati finché l'avvio visibile nel simulatore non viene confermato; non si salta il controllo per velocizzare il rilascio.
- Il nuovo commit attiva automaticamente la pubblicazione e la regola di concorrenza annulla il vecchio tentativo. Il sistema watchdog non crea tentativi mentre un rilascio è in esecuzione.
- Test automatico dedicato alla politica di timeout/ripristino e ai controlli di sicurezza.

---

## Cantoria 1.1 (32) — elenco canti Messa a tutta larghezza in landscape (21 novembre 2026)

- Nella scaletta della Messa la visualizzazione landscape ora presenta una singola card per riga, larga quanto lo schermo disponibile, esattamente come nella Biblioteca.
- Card più compatte in orizzontale: titolo e autore centrati, ornamento verde/oro proporzionato, tasti rimozione e ripristino disponibili sul lato destro senza sovrapporsi al testo.
- In portrait non viene alterata l'impaginazione preesistente.
- La pressione prolungata di circa mezzo secondo continua a permettere il trascinamento per cambiare l'ordine dei canti; l'ordine rimane salvato dopo il rilascio.
- Test automatici specifici per layout landscape, stile portrait invariato, pulsanti, card trascinabili e lista Biblioteca non modificata.
- Versione 1.1 build 32. Nessuna modifica al riconoscimento degli accordi della build 31.

---

## Cantoria 1.1 (31) — brani importati e diagnosi microfono (21 novembre 2026)

- Il riconoscimento dei brani importati supporta accordi italiani e internazionali (DO/C, SOL/G, LA-/Am, FA#-/F#m). La trasposizione comprende le sigle internazionali e i bassi in accordi slash.
- SOL2 e RE4 (anche RE⁴) sono riconosciuti come accordi sospesi. Il confronto fra simboli equivalenti usa le reali note dell'accordo, non la grafia.
- Riparato il filtro del test microfono: prima ignorava note sotto circa 77/255 anche quando segnalava un ingresso audio. Ora usa soglie spettrali adattive, due conferme e messaggi distinti per assenza di audio e note insufficienti.
- Il rilevatore dello spartito conserva il ciclo rapido della build 30, con controllo dei passaggi cronologici. Il test di Impostazioni ha una diversa smussatura del segnale, più adatta alla diagnosi.
- I brani importati privi di accordi riconoscibili segnalano come procedere; le fotografie senza partitura vanno prima convertite in accordi e testo.
- Test automatici su importazione e riproduzione con microfono, DO maggiore debole, armonici, accordi sospesi e permessi.
- Versione 1.1 build 31; da verificare sul dispositivo reale.

---

## Cantoria 1.1 (30) — riconoscimento audio più rapido e accordi attaccati separati (21 novembre 2026)

- Il riconoscimento microfono durante il canto verifica i nuovi accordi ogni 80 ms anziché 155 ms, usa due conferme consecutive anziché tre e riduce il ritardo fra accordi diversi da 450 a 130 ms, senza mai saltare in avanti nella partitura. Accordi consecutivi identici richiedono un nuovo attacco udibile o una pausa.
- Ridotta l'inerzia dell'analisi spettrale e dell'accumulo temporale: i campioni recenti hanno peso maggiore, mentre una breve finestra resta disponibile per accordi arpeggiati. Sono stime teoriche dei tempi; la velocità su iPhone reale dipende dal microfono e dal suono.
- L'OCR fotografico distingue sigle italiane attaccate come SOLDO, MI-LA-, FA7+DO, RE/LADO, SI7DO e ricostruisce più accordi. Non separa parole del testo in minuscolo o simboli parziali non validi.
- In presenza di riquadri OCR per singoli caratteri sono usati per ricostruire le posizioni originali; quando l'OCR fornisce solo un riquadro unico viene suddiviso in modo proporzionale e segnalato per verifica. Nessun accordo viene inventato senza una sigla valida.
- La trascrizione fotograﬁca segnala anche il numero di simboli separati da gruppi attaccati. Le pill e gli ancoraggi musicali vengono conservati separatamente.
- Aggiunti test su velocità, ordine cronologico, accordi simili/uguali, sigle unite, coordinate indipendenti e protezione delle parole ordinarie.
- Versione 1.1 build 30; tutte le precedenti funzionalità restano disponibili.

---

## Cantoria 1.1 (29) — elimina sillaba o parola (21 novembre 2026)

- Nella finestra **Modifica sillaba** sono stati aggiunti due pulsanti: **Elimina sillaba** ed **Elimina parola**. Il secondo rimuove l'intera parola, comprese le sillabe separate da |, anche quando è selezionata una sillaba centrale.
- Entrambe le eliminazioni chiedono conferma; Annulla torna all'editor senza perdere né modificare lo spartito.
- Gli accordi legati alle sillabe cancellate vengono eliminati; gli altri mantengono la rispettiva sillaba, grazie al ricalcolo degli indici. Le posizioni rispetto alla fotografia sono contrassegnate per verifica.
- Gli spazi rimanenti vengono normalizzati. Se la cancellazione elimina tutto il testo di una riga, si rimuove anche la riga vuota.
- Il nuovo testo viene salvato soltanto dopo la conferma, e in caso di impossibilità di salvataggio l'operazione viene annullata con ripristino della riga originale.
- Test di regressione per sillabe, parole monosillabiche e multisillabiche, accordi prima/dopo la selezione, ultima parola e conferma.
- Versione 1.1 build 29, con tutte le funzioni precedenti.

---

## Cantoria 1.1 (28) — riordino brani tramite long press (21 novembre 2026)

- In una **Messa da celebrare**, tieni premuta una card per circa mezzo secondo e trascinala sopra o sotto gli altri brani. Un'anteprima segue il dito; le altre card cambiano posizione durante il trascinamento.
- Al rilascio il nuovo ordine viene salvato. Se il salvataggio fallisce viene ripristinato l'ordine precedente. Biblioteca, altre Messe e dati dei brani non vengono modificati.
- Scorrimento automatico vicino ai bordi, supporto portrait/landscape e griglie a più colonne.
- Il tocco breve continua ad aprire il brano; i pulsanti interni non attivano il trascinamento. Le Messe già celebrate non si possono riordinare.
- Test di regressione per hold, drag, salvataggio, annullamento, blocco Messe archiviate e mantenimento dei dati.
- Versione 1.1, build 28.

---

## Cantoria 1.1 (27) — diagnosi microfono in Impostazioni (21 novembre 2026)

- Nuovo pannello **Diagnosi riconoscimento accordi** nella schermata Impostazioni, utilizzabile anche senza aprire un canto. Pulsanti **Avvia test** e **Ferma test**, con accesso diretto al microfono e rilascio delle risorse allo stop.
- L'accordo maggior/minore riconosciuto compare in grande (es. DO quando vengono suonate le note DO–MI–SOL); sono mostrati in diretta il livello del segnale, le note rilevate e la corrispondenza musicale. L'assenza del segnale e i problemi di autorizzazione sono mostrati separatamente.
- La diagnosi utilizza il medesimo estrattore delle frequenze del lettore, ma valuta tutti gli accordi maggiori e minori senza dipendere dalla sequenza dello spartito: permette di capire se il guasto è nel microfono o nel riconoscimento.
- Il microfono si spegne al termine del test, cambiando schermata e chiudendo l'app. Nessuna registrazione viene salvata o inviata in rete.
- In landscape i pulsanti precedente/successivo accordo sono realmente inseriti nel gruppo di sinistra, subito dopo Play/Stop; in portrait stretto restano su una riga inferiore. Corretto il rischio di sovrapposizione con il titolo.
- Test automatici dedicati all'analisi di DO, SOL, LA- e RE-, al ciclo di vita del microfono e alla gestione degli errori.
- Versione applicazione 1.1, build iOS/PWA 27. La sensibilità reale richiede ancora una prova con strumento musicale su iPhone.

---

## Cantoria 1.1 (26) — attesa del primo accordo e microfono diretto (21 novembre 2026)

- Toccando il pulsante ♫ si attiva direttamente il microfono senza una finestra di scelta della sorgente. La funzione «Carica audio» è rimossa dall’interfaccia.
- Quando il microfono è attivo, la posizione degli accordi torna all’inizio e compare «In attesa del primo accordo: ...». Il brano entra in modalità di seguito soltanto quando il primo accordo viene riconosciuto stabilmente.
- Dopo il primo accordo riconosciuto il lettore procede cronologicamente senza saltare sezioni, con i controlli manuali precedente/successivo sempre disponibili.
- Riconoscimento potenziato per accordi realmente suonati: una breve finestra di circa un secondo accumula le note di accordi arpeggiati e permette due note con fondamentale riconoscibile soltanto quando la classificazione globale le conferma.
- Corretto il layout: le frecce sono una sezione indipendente nella toolbar, e sugli schermi stretti si spostano nella seconda riga senza sovrapporsi ai tasti di trasporto. Stato di ascolto visibile vicino al titolo.
- Test sintetici in CI; la verifica della precisione tramite microfono iPhone rimane necessaria.

---

## Cantoria 1.1 (25) — ripristino riconoscimento accordi (21 novembre 2026)

- Corretto il blocco del microfono introdotto dalla build 23: la vecchia classificazione sceglieva l’accordo più probabile nell’intero brano, ma l’avanzamento sequenziale accettava solo la sigla successiva esatta.
- Adesso l’analisi armonica valuta direttamente l’accordo atteso, richiede evidenza reale di più note della sua triade e non salta ad altre strofe o pagine.
- Accetta l’accordo atteso anche quando una nota aggiuntiva rende un altro accordo globalmente più probabile; evita falsi avanzamenti con accordi che condividono soltanto due note.
- Conservati i pulsanti manuali precedenti/successivi, l’indicatore luminoso del microfono, il riconoscimento di attacchi distinti e la continuità in landscape.
- Test nuovi con sequenze di spettri simulati da una sorgente microfono, inclusi accordi errati intermedi e passaggio di pagina.
- Versione 1.1, build 25.

---

## Cantoria 1.1 (24) — navigazione manuale accordi e stato microfono (21 novembre 2026)

- Due nuove frecce nella barra del lettore per tornare all’accordo precedente o avanzare al successivo, mantenendo attivo l’ascolto del microfono o del file audio.
- In landscape le frecce sono accanto ai comandi Play/Stop; in portrait stretto appaiono su una seconda riga per non sovrapporsi al titolo.
- Il pulsante con la nota musicale diventa oro e mostra un indicatore arancione durante l’ascolto effettivo dal microfono; torna normale quando l’ascolto termina.
- La progressione manuale è limitata agli accordi realmente presenti nella partitura, incluse le altre pagine. Resta attiva la sequenza cronologica introdotta nella build 23.
- Numero build iOS/PWA 24, versione applicativa 1.1 invariata.

---

## Cantoria 1.1 (23) — riconoscimento cronologico degli accordi (21 novembre 2026)

- Il riconoscimento tramite microfono e audio segue esclusivamente l'accordo successivo nella sequenza della partitura, senza saltare a una strofa o pagina più avanti.
- Ripetizioni consecutive dello stesso accordo richiedono un nuovo attacco rilevabile o una pausa, senza avanzamenti sul solo accordo sostenuto.
- La sequenza include tutto il canto anche in landscape, con cambio automatico alla pagina dell'accordo raggiunto.
- La versione rimane 1.1, il numero di build diventa 23 perché la 22 è già assegnata alle correzioni dei backup e della navigazione.

---

## Cantoria 1.1 (6) — schede compatte e metadati del brano (21 novembre 2026)

- **Biblioteca:** la card mostra solo intestazione con titolo e azioni («Alla messa», «Esporta», «Crea PDF»). Rimossi pill tonalità/stato e descrizione/sezioni, ridotta l'altezza mantenendo l'angolo liturgico.
- **Impostazioni brano:** sotto i comandi di tonalità sono sempre disponibili i campi **Titolo** e **Autore**. Si salvano insieme premendo **Salva**, con validazione del titolo obbligatorio e recupero dei dati in caso di errore nel salvataggio.
- Durante la trasposizione `+`/`−`, le modifiche non ancora salvate nei due campi restano intatte. Chiudere le impostazioni senza salvare annulla le modifiche.
- Titolo e autore restano parte del modello dati del brano, del backup JSON e dell'esportazione `.cantoria.json`.
- PWA e pacchetto iOS aggiornati alla build `1.1 (6)`. Test layout e gestione metadati aggiunti al workflow di verifica.

---

# Cantoria — Foto → Partitura (beta 0.5.0)

## Cantoria 1.1 (5) — tonalità armonica e comandi (21 novembre 2026)

- L'inferenza della tonalità dai canti fotografati considera qualità degli accordi, accordi diatonici, inizi delle sezioni e cadenze dominante–tonica; non usa più semplicemente l'accordo più frequente.
- Gli accordi SOL, DO, RE, MI−, SI−, LA− possono appartenere a SOL maggiore o alla relativa MI minore: senza indizi funzionali sufficienti viene mostrato **Da verificare**. La melodia e gli accordi incerti dall'OCR devono essere confrontati con l'originale.
- Nel menu del brano, **Analisi tonalità e verifica degli accordi** mostra candidati, conteggi, progressioni cadenzali e limiti dell'analisi. L'utente può scegliere la tonalità manualmente; l'impostazione manuale non viene sovrascritta.
- I canti fotografati non confermati con tonalità precedentemente dedotta vengono rivalutati quando si apre la nuova versione; i dati con `keySource: manual` rimangono invariati.
- I controlli di ritorno all'inizio e riproduzione usano icone SVG verde bosco e oro coerenti con il resto dell'interfaccia.
- PWA: cache `cantoria-shell-v1.1-build5`; iOS: `release.json` 1.1 (5), bundle aggiornato con `harmony-analysis.js` e `audio-follow.js`. Test: `node scripts/test-harmony.js`.

**Nota:** riconoscimento fotografico sperimentale. Una tonalità plausibile non è una conferma musicologica e non risolve accordi OCR da controllare.

---

## Acquisizione fotografica

Dalla schermata **Acquisisci**: scatta o scegli una foto, premi **Riconosci testo e accordi**, correggi la trascrizione, quindi premi **Crea partitura modificabile**. La trascrizione interpreta sezioni INTRO/STROFA/RITORNELLO e sigle italiane degli accordi su righe dedicate. Puoi anche **Salva solo la foto** e convertirla successivamente.

- Separa le sillabe con `|`, per esempio `Be|ne|det|to`. Dopo la conversione usa una **pressione prolungata** su una parola per dividerla in sillabe, oppure su un accordo per modificare la sillaba di ancoraggio.
- La foto originale resta collegata e si trova dal menu del brano → **Vedi fotografia originale**.
- Gli ancoraggi sono ipotesi, e i canti restano **da verificare**. Non sono ancora riconosciute note, durate o pentagrammi (OMR).
- L'OCR usa Tesseract.js sul dispositivo e al primo utilizzo necessita di Internet per libreria e dati linguistici. Se il download fallisce puoi comunque correggere o inserire la trascrizione manualmente.
- `score-ocr.js` viene incluso nel pacchetto iOS Capacitor e nella cache PWA; i test si eseguono con `node scripts/test-photo-ocr.js`.
- I dati sono locali: fai periodicamente un backup JSON.

---

# Cantoria — PWA iPhone/iPad (prototipo 0.4.9 · build 20261119.10)

Prima versione sperimentale di **Cantoria**, un archivio di spartiti e scalette per le Messe, ottimizzato per iPhone e iPad.

## Novità 0.4.9 — OCR fotografico (prima versione)

- In **Acquisisci** puoi scattare o scegliere una foto e premere **Riconosci testo (OCR)**. Il motore Tesseract.js riconosce parole italiane e inglesi, mostra il testo modificabile e lo salva nella bozza insieme alla fotografia.
- L'OCR è disponibile anche sulle **bozze fotografiche già in Biblioteca**: puoi ripetere il riconoscimento e salvare le correzioni senza eliminare la foto.
- Il riconoscimento si esegue sul dispositivo, ma la **prima attivazione richiede Internet** per scaricare libreria e modelli OCR. L'app funziona anche senza OCR e conserva il normale salvataggio fotografico.
- **Limite**: non vengono letti automaticamente pentagrammi, note, indicazioni armoniche affidabili o ancoraggi degli accordi alle sillabe. Il testo OCR va verificato e corretto prima dell'uso liturgico.
- Nel workflow **iOS / TestFlight** i nomi della chiave API e l'Apple Team ID sono stati allineati ai repository secrets configurati. Restano necessari un bundle identifier iOS valido, il certificato Apple Distribution e il provisioning profile per la firma.
- Corretto il controllo automatico del codice musicale/PDF, precedentemente interrotto da un limite di estrazione errato.

## Avvio

La web app è interamente contenuta in `index.html`: non richiede Node.js, build o compilazioni. Il file include lo stile grafico e il codice di funzionamento. `manifest.webmanifest` e `sw.js` permettono l'installazione come PWA e una cache offline di base.

### Pubblicazione tramite GitHub Pages

1. Apri **Settings → Pages** di questo repository.
2. In **Build and deployment** imposta **Deploy from a branch**.
3. Scegli `main` e `/(root)`, poi **Save**.
4. Apri **https://gulinodesign-maker.github.io/CANTORIA/** in Safari, dopo che GitHub Pages ha completato la pubblicazione.
5. Su iPhone: Safari → Condividi → **Aggiungi alla schermata Home**.

## Novità v0.3.2

- **Portrait iPhone/iPad:** spartito in un unico flusso con **scroll verticale continuo** dall'alto verso il basso, senza pagine né cambio pagina con swipe orizzontale. Apertura editor e salvataggio mantengono la posizione di lettura.
- **Landscape:** impaginazione in colonne, cambio pagina con swipe orizzontale e indicatore pagine restano attivi.
- **Barra del lettore:** controlli di trasposizione − / conteggio semitoni / + e tasto PDF più compatti per lasciare spazio allo spartito. La tonalità rimane accanto al titolo.
- **PDF A4:** ripristinata l'impostazione avorio/verde bosco/ocra; bande colorate arrotondate (pill) sotto gli accordi, distinte per tipo di sezione, testo serif e accordi ancorati alla sillaba anche dopo il trasporto. È un PDF vettoriale multipagina generato localmente.
- **Verifiche:** JavaScript compilato senza errori di sintassi e PDF di prova generato, contenente le pill. Il comportamento sul dispositivo reale e la resa di stampa finale richiedono comunque una prova su iPhone/iPad.
- **Cache PWA:** aggiornata alla versione 0.3.2.

## Novità v0.3.1

- **Tonalità corrente a destra del titolo** del brano nella barra superiore (ad esempio SOL maggiore o DO diesis maggiore). Toccando la tonalità si modifica quella originale.
- Pulsanti **− / +** ingranditi nel lettore. **Tra i due pulsanti** ora appare un contatore numerico di semitoni **0, +1, +2, −1...**; toccando il contatore si azzera la trasposizione.
- Il tasto **PDF** apre un pannello con **Condividi o salva su File**, **Apri PDF** e **Scarica PDF**, per consentire un'alternativa se il flusso nativo di condivisione non è supportato sul dispositivo.
- Il PDF A4 continua a essere generato direttamente dal browser, completo e multipagina, con accordi trasposti.
- Cache offline aggiornata per distribuire la nuova interfaccia alle PWA già installate. In caso di vecchia schermata: aprire il sito in Safari, ricaricare e riavviare la web app.
- **Test:** sintassi JavaScript verificata e struttura PDF generata in un test. Da confermare ancora i gesti e il pannello di condivisione sull'iPhone reale.

## Novità v0.2

- Home semplificata con quattro pulsanti in griglia 2×2: Biblioteca, Acquisisci brano, Impostazioni, Nuova Messa.
- Navigazione inferiore rimossa; nelle altre sezioni c'è il tasto Home.
- Lettore senza barra inferiore: titolo centrato nella barra superiore, pagina indicata sotto il titolo, swipe per scorrere.
- Layout responsive: una colonna su iPhone verticale; due colonne su iPhone orizzontale e iPad quando le dimensioni lo consentono. I righi non si dividono tra le colonne; adattamento del carattere alla larghezza.
- Pressione prolungata su accordo per correggere accordo/sillaba; pressione prolungata su sillaba per correggere il testo e aggiungere/modificare l'accordo. Conferma con “Salva”.
- Restano attivi gli accordi ancorati alle sillabe e il PDF A4 completo.

**Importante:** la pubblicazione della versione nuova non cancella automaticamente i dati già salvati nel browser. Prima di testare una nuova versione, è consigliato esportare un backup dalle Impostazioni.

## Funzionalità disponibili

- Biblioteca con canto dimostrativo.
- Creazione di Messe, scelta e riordino della scaletta.
- Lettore portrait con scroll verticale continuo; lettore landscape a pagine e swipe.
- Trasposizione degli accordi (notazione italiana).
- Legame accordo–sillaba tramite indice della sillaba, modificabile manualmente.
- Foto da fotocamera o libreria come **riferimento per trascrivere a mano**.
- Esportazione PDF A4 direttamente dall'app (condivisione su iOS ove supportata, altrimenti download).
- Salvataggio **locale nel browser**, backup e ripristino JSON.
- Grafica avorio, verde bosco, senape e fasce vintage degli accordi.

## Limiti attuali (importante)

- Non è ancora presente riconoscimento automatico affidabile di fotografie (OCR + ancoraggio sillabe).
- I dati rimangono nello spazio di archiviazione **locale** di Safari: non sono salvati su GitHub e non sono sincronizzati fra dispositivi. Per ora esporta backup JSON regolari; il cloud arriverà con un database e un servizio dedicati.
- Il canto dimostrativo non va usato per esecuzioni senza verifica del testo e degli accordi con la fonte originale.
- Questo repository è pubblico: **non caricare spartiti privati o dati personali nei file GitHub**.

## Tecnologie

HTML/CSS/JavaScript senza dipendenze esterne; manifest PWA; service worker. La struttura musicale associa gli accordi a identificativi di sillaba anziché a coordinate grafiche. Il progetto potrà essere modularizzato e, se desiderato, impacchettato come app iOS tramite Capacitor.

**Stato:** v0.3.1. Esportazione PDF e gesti di condivisione da verificare su iPhone/iPad reali. Il riconoscimento fotografico automatico resta da realizzare: foto → OCR testo/accordi → revisione delle sillabe e degli ancoraggi → salvataggio in biblioteca.


## Novità 0.4.0 — Condivisione singoli brani

- Nel lettore il pulsante **☰** in alto a destra apre un solo pannello con tonalità corrente e originale, trasporto in semitoni e opzioni PDF e file Cantoria.
- **Esporta file Cantoria** crea un file `.cantoria.json` contenente un singolo brano con accordi ancorati alle sillabe e dati musicali completi (formato `cantoria-song`, versione 1). Puoi condividerlo dal menu nativo, incluso AirDrop quando il dispositivo lo consente, o scaricarlo.
- **Biblioteca → Importa brano** importa il file ricevuto aggiungendolo alla biblioteca locale con un nuovo identificativo; non sovrascrive i canti già presenti.
- Dalla scheda di ogni brano della biblioteca puoi anche usare **Esporta brano**.
- L'app web/PWA non registra i tipi di documento di iOS: un file ricevuto con AirDrop va prima salvato su File e poi selezionato in **Biblioteca → Importa brano**. L'apertura diretta da AirDrop nell'app sarà disponibile dopo la creazione del progetto nativo iOS con il tipo di documento Cantoria registrato.
- **Impostazioni** indica versione e build attuali.

## Novità 0.4.1 — Identità cattolica

- Home con croce, cornice ad arco ispirata agli elementi delle chiese, verde liturgico, oro e avorio.
- Titoli e testi esplicitamente rivolti ai canti della Chiesa cattolica e alla celebrazione della Santa Messa.
- La Biblioteca rimane invariata nella struttura dei brani: accordi e ancoraggi alle sillabe conservati.
- Aggiornati nome e descrizione della PWA e la cache offline per distribuire la nuova versione.

**Build:** `20261119.2`. È ancora una web app installabile da Safari, non una versione nativa App Store. L'aspetto su iPhone/iPad va verificato sul dispositivo.

## Novità 0.4.2 — Angolo liturgico curvo

- Motivo grafico fedele al riferimento: angolo verde bosco, **curva oro** e **croce dorata** sulla Home, nella testata delle sezioni e sulle schede della Biblioteca.
- Testata del lettore più sobria su fondo avorio, con piccolo richiamo all'angolo in verde e oro senza aumentare l'altezza della barra e con menu ☰ sempre a destra.
- Nel PDF A4 l'angolo superiore sinistro ora usa un tracciato curvo vettoriale e una croce disegnata a linee, anziché un triangolo rigido e il segno +.
- Aggiornata la cache PWA e l'indicazione **Versione 0.4.2 · Build 20261119.3** in Impostazioni.

Verifiche visive su Safari e della stampa PDF ancora da confermare sul dispositivo reale.


## Novità 0.4.3 — Icona approvata e interfaccia essenziale

- Nuova icona scelta dall'utente: angolo verde bosco con curva ambra, croce dorata sulla parte verde, due crome verdi sulla parte avorio. Il file PNG deriva dalla seconda anteprima approvata; è presente anche un disegno SVG per le icone scalabili.
- Home senza sottotitoli e testi descrittivi, soltanto il titolo e quattro tasti: Biblioteca, Acquisisci, Impostazioni, Nuova Messa.
- Menu ☰ del brano compatto: tonalità corrente, trasporto, esportazione PDF e file Cantoria; cambio tonalità originale e funzioni secondarie sono a comparsa.
- Biblioteca e pagine principali ripulite dalle spiegazioni ridondanti.
- Impostazioni: Versione 0.4.3 · Build 20261119.4.
- PWA: nuovo riferimento apple-touch-icon PNG e cache aggiornata. L'icona di una PWA già installata potrebbe richiedere la rimozione dalla schermata Home e una nuova installazione per aggiornarsi.

Nota: condivisione/importazione e layout grafico vanno ancora verificati in Safari su iPhone e iPad.

## Novità 0.4.4 — Acquisizione solo fotografica

- **Indietro:** nelle testate delle sezioni il pulsante è ora all'estrema destra, verde bosco con freccia oro; il titolo rimane centrato.
- **Acquisisci un canto:** eliminati l'inserimento manuale di sillabe e accordi e il precedente modulo “Spartito strutturato”. Sono disponibili solo **Scatta una foto** e **Scegli una foto**.
- La foto selezionata viene mostrata in anteprima. Si può aggiungere facoltativamente un titolo e salvare il canto in Biblioteca come **bozza fotografica**.
- Le bozze possono essere riaperte per vedere l'immagine originale ed esportate/importate come file Cantoria (comprensivi della foto).
- L'immagine viene ridimensionata e compressa prima del salvataggio locale; l'archiviazione del browser resta limitata.
- **OCR non ancora implementato:** la bozza non genera automaticamente testo, accordi, ancoraggi alle sillabe né PDF. Queste funzioni saranno abilitate dopo un sistema di riconoscimento con verifica dell'utente.
- **Impostazioni:** Versione **0.4.4**, Build **20261119.5**; aggiornamento della cache PWA.
- Controllata la sintassi JavaScript. Prova fotocamera, salvataggio e lettura della bozza ancora da confermare in Safari su iPhone/iPad.


## Versione 0.4.5 — Icona originale approvata

- Sostituita l'icona generica della PWA con **la fotografia dell'icona scelta dall'utente**, fedele al riferimento: croce oro sull'angolo verde, separatore ambrato curvo e due note verdi su avorio.
- Icona PNG 192×192 ritagliata dal file sorgente caricato, salvata in `assets/cantoria-icona-ufficiale-045.png` per evitare la cache dell'icona precedente.
- Modificati `apple-touch-icon`, favicon e manifest, senza icone SVG alternative nel manifest che possano interferire con la scelta di Safari.
- Aggiornate la cache offline e l'indicazione in Impostazioni a **Versione 0.4.5 · Build 20261119.6**.
- Su iOS, la schermata Home può conservare la vecchia icona anche dopo l'aggiornamento: rimuovere l'icona precedente, ricaricare il sito in Safari e aggiungerlo nuovamente alla Home.

## Novità 0.4.6 — Messe e menu brano

- **Home:** quattro pulsanti direttamente sul fondo avorio, senza card o rettangoli bianchi, leggermente più in alto; «Nuova Messa» rinominata **Messe**.
- **Messe:** pagina con «Crea nuova Messa», elenco delle scalette **in programma** e **Storico** delle Messe segnate come celebrate. Si possono indicare nome e data, segnare una Messa come celebrata, aprire il report e **riutilizzare** una scaletta passata in una nuova Messa.
- Riutilizzando una scaletta vengono copiati ordine dei canti, momenti e trasposizioni con nuovi identificativi; il report della celebrazione originale resta archiviato e non è sovrascritto. I titoli dei canti vengono conservati in uno snapshot al momento dell'archiviazione.
- **Opzioni brano:** meno, tonalità corrente con semitoni e più **affiancati nella stessa riga** in tre riquadri della stessa altezza; il riquadro centrale si può toccare per azzerare il trasporto.
- Nello stesso menu, sezione comprimibile **«Modifica titolo e autore»** con pulsante Salva. L'autore compare in Biblioteca e insieme al titolo è incluso nell'esportazione del file Cantoria.
- **Versione 0.4.6 · Build 20261119.7** in Impostazioni e nuova cache PWA.
- I dati e lo storico delle Messe restano nel **salvataggio locale del browser** e nel backup JSON; non sono ancora sincronizzati tra dispositivi.
- Controllata la sintassi JavaScript e verificata la presenza dei file aggiornati su GitHub. Il funzionamento nell'app Safari reale richiede un test sul dispositivo.
