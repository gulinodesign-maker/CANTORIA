# Cantoria — PWA iPhone/iPad (prototipo 0.4.0 · build 20261119.1)

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
