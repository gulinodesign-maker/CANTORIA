# Cantoria — GitHub Actions e TestFlight

Questo repository contiene una PWA. Il workflow **Build iOS / TestFlight** crea su un runner
macOS il progetto Xcode con Capacitor 8. Non è ancora una build iOS verificata.
L'upload a TestFlight avviene solo scegliendo manualmente `distribution: testflight`.

## Prima di creare i secret
1. È necessaria una membership Apple Developer Program attiva, con accesso a App Store Connect.
2. In Apple Developer registra un **App ID esplicito** (Bundle ID) unico.
3. In App Store Connect → Apps → + crea una scheda iOS Cantoria con quel Bundle ID.
4. In GitHub → Settings → Secrets and variables → Actions → **Variables**:
   - `IOS_BUNDLE_ID`: Bundle ID esatto, uguale a quello Apple (esempio fittizio: `it.example.cantoria`).
   - `APPLE_TEAM_ID`: Team ID del programma Apple Developer (10 caratteri).

## GitHub → Actions → Repository secrets
| Name | Value |
|---|---|
| `APP_STORE_KEY_ID` | Key ID della API key App Store Connect |
| `APP_STORE_ISSUER_ID` | Issuer ID della API key del team |
| `APP_STORE_PRIVATE_KEY` | Contenuto integrale del file `AuthKey_....p8`, incluse le righe BEGIN/END |
| `IOS_DISTRIBUTION_P12_BASE64` | Contenuto base64, su una riga, del certificato **Apple Distribution** con chiave privata (.p12) |
| `IOS_DISTRIBUTION_P12_PASSWORD` | Password usata durante l'esportazione del .p12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Contenuto base64, su una riga, del profilo di distribuzione **App Store Connect** (.mobileprovision) |
| `IOS_KEYCHAIN_PASSWORD` | Password casuale per il portachiavi temporaneo del runner, generata dall'utente |

In App Store Connect → Users and Access → Integrations → App Store Connect API
crea una API key con un ruolo sufficiente per il caricamento delle build (ad esempio **App Manager**),
quindi copia **Key ID** e **Issuer ID**. Scarica il .p8 una sola volta.
Non mettere file .p8, .p12 o .mobileprovision nel repository pubblico.

Il file .p12 **deve contenere la chiave privata**, non basta un certificato .cer.
Su macOS esportalo da Accesso Portachiavi dopo avere creato o installato il certificato
Apple Distribution. Crea il profilo Apple "App Store Connect" associato al medesimo
Bundle ID, Team e certificato. Per convertire file locali in base64 su macOS:

```sh
base64 -i CantoriaDistribution.p12 | tr -d '\n'
base64 -i Cantoria_AppStore.mobileprovision | tr -d '\n'
```

Incolla gli output **solo nei rispettivi campi GitHub Secret**, mai in chat,
nel README o in un commit. Conserva separatamente le credenziali originali.

## Esecuzione
- GitHub → Actions → **Build iOS / TestFlight** → Run workflow.
- Prima usa `distribution: simulator` per compilare senza firma e recuperare
  `Cantoria-Xcode-<run>.zip` dagli artifact del run.
- Dopo avere configurato i secret, scegli `distribution: testflight`.
  Il workflow firma, esporta un .ipa e lo invia ad App Store Connect.
- Il caricamento riuscito **non garantisce** che Apple abbia già elaborato la build:
  controlla App Store Connect → TestFlight, poi assegna i tester desiderati.

## Limitazioni e controlli prima della beta
- Il codice iOS non è stato ancora compilato su un runner macOS in questa sessione.
- L'icona nativa viene ingrandita dal PNG ufficiale di 192 px presente nel repository:
  sostituire con l'originale approvato ad alta risoluzione prima del rilascio definitivo.
- Biblioteca e Messe sono salvate localmente. I dati della PWA Safari **non passano
  automaticamente** all'app iOS: esportare il backup JSON da Safari e importarlo nell'app.
- Testare su iPhone acquisizione foto, PDF, import/export, salvataggi e gesti prima
  di invitare tester esterni.
