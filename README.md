# Cantoria — PWA iPhone/iPad (prototipo 0.4.4 · build 20261119.5)

Prima versione sperimentale di **Cantoria**, un archivio di spartiti e scalette per le Messe, ottimizzato per iPhone e iPad.

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

