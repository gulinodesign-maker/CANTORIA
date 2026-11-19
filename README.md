# Cantoria — PWA iPhone/iPad (prototipo 0.3.1)

Prima versione sperimentale di **Cantoria**, un archivio di spartiti e scalette per le Messe, ottimizzato per iPhone e iPad.

## Avvio

La web app è interamente contenuta in `index.html`: non richiede Node.js, build o compilazioni. Il file include lo stile grafico e il codice di funzionamento. `manifest.webmanifest` e `sw.js` permettono l'installazione come PWA e una cache offline di base.

### Pubblicazione tramite GitHub Pages

1. Apri **Settings → Pages** di questo repository.
2. In **Build and deployment** imposta **Deploy from a branch**.
3. Scegli `main` e `/(root)`, poi **Save**.
4. Apri **https://gulinodesign-maker.github.io/CANTORIA/** in Safari, dopo che GitHub Pages ha completato la pubblicazione.
5. Su iPhone: Safari → Condividi → **Aggiungi alla schermata Home**.

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
- Lettore portrait/landscape, cambio pagina con swipe.
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
