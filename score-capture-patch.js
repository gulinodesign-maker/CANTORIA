/* Progressive enhancement for the existing photo capture. No remote photo upload. */
(function () {
  'use strict';
  const baseCaptureHTML = captureHTML;
  const baseSettingsHTML = settingsHTML;

  captureHTML = function () {
    let html = baseCaptureHTML();
    if (!state.photoURL) return html;
    const busy = !!state.ocrBusy;
    let controls = '<div class="photo-ocr-controls">' +
      '<button type="button" class="outline-btn" data-action="recognize-photo"' + (busy ? ' disabled' : '') + '>' +
      (busy ? 'Riconoscimento in corso…' : 'Riconosci testo e accordi dalla foto') + '</button>';
    if (state.ocrError) {
      controls += '<p class="photo-ocr-error" role="alert">' + escape(state.ocrError) + '</p>';
    }
    if (state.ocrDraft !== undefined && state.ocrDraft !== null) {
      controls += '<div class="field"><label for="ocrText">Trascrizione da correggere prima del salvataggio</label>' +
        '<textarea id="ocrText" name="ocrText" rows="12" spellcheck="false">' + escape(state.ocrDraft) + '</textarea>' +
        '<small>Controlla ogni parola e accordo. La posizione degli accordi è approssimativa.</small></div>' +
        '<button class="primary-btn photo-save" type="submit" name="photoMode" value="score">Crea nuova partitura modificabile</button>';
    }
    controls += '<button class="outline-btn photo-save" type="submit" name="photoMode" value="photo">Salva solo la foto</button></div>';
    html = html.replace(
      '<button class="primary-btn photo-save" type="submit">Salva in biblioteca</button>',
      controls
    );
    html = html.replace(
      'La foto sarà salvata come bozza. Il riconoscimento automatico degli accordi non è ancora attivo.',
      'Riconoscimento sperimentale di testo e sigle degli accordi. Non legge note, durate o pentagrammi. Serve una verifica manuale prima di usare la partitura.'
    );
    if (state.ocrTitle) {
      html = html.replace('name="photoSongTitle" placeholder=', 'name="photoSongTitle" value="' + escapeAttr(state.ocrTitle) + '" placeholder=');
    }
    return html;
  };

  settingsHTML = function () {
    return baseSettingsHTML().replace(
      "L'OCR non è ancora disponibile: le foto restano bozze finché testo e accordi non saranno riconosciuti e verificati.",
      "È disponibile il riconoscimento sperimentale di testo e accordi da fotografia, con revisione prima del salvataggio. Le note sul pentagramma e i valori ritmici non sono ancora riconosciuti. Per il primo utilizzo dell'OCR serve una connessione Internet."
    );
  };

  const style = document.createElement('style');
  style.textContent = '.photo-ocr-controls{display:flex;flex-direction:column;gap:12px}.photo-ocr-controls .field{margin:3px 0}.photo-ocr-controls textarea{min-height:180px;font-family:ui-monospace,monospace;font-size:14px}.photo-ocr-error{color:#8c3026;font-size:13px}.photo-ocr-controls .outline-btn{min-height:45px}';
  document.head.appendChild(style);

  root.addEventListener('change', function (event) {
    if (event.target.id === 'photoCameraInput' || event.target.id === 'photoLibraryInput') {
      state.ocrDraft = null;
      state.ocrError = '';
      state.ocrTitle = '';
    }
  }, true);

  root.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action="recognize-photo"]');
    if (!button || !state.photoURL || state.ocrBusy) return;
    event.preventDefault();
    state.ocrTitle = document.querySelector('#photoSongTitle')?.value || '';
    const photo = state.photoURL;
    state.ocrBusy = true;
    state.ocrError = '';
    render();
    try {
      const text = await window.CantoriaOCR.recognize(photo);
      if (state.photoURL !== photo) return;
      if (text.trim().length < 4) throw new Error('Nessun testo leggibile trovato. Prova con una foto più nitida.');
      state.ocrDraft = text;
    } catch (error) {
      console.error('Cantoria OCR:', error);
      if (state.photoURL === photo) {
        state.ocrError = error?.message || 'Riconoscimento non riuscito. Puoi salvare la foto.';
      }
    } finally {
      state.ocrBusy = false;
      if (state.photoURL === photo) render();
    }
  }, true);

  root.addEventListener('submit', function (event) {
    const form = event.target;
    if (form.id !== 'photoSongForm' || event.submitter?.value !== 'score') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!state.photoURL) return;
    const fields = new FormData(form);
    const recognizedText = String(fields.get('ocrText') || '').trim();
    const sections = window.CantoriaOCR.parse(recognizedText);
    if (!sections.length) {
      notify('Non ci sono righe leggibili. Correggi il testo o salva solo la fotografia.');
      return;
    }
    const title = String(fields.get('photoSongTitle') || '').trim() ||
      'Canto da fotografia · ' + new Date().toLocaleDateString('it-IT');
    const song = {
      id: makeId(), title, subtitle: 'Trascrizione OCR da verificare',
      key: '', source: 'Fotografia OCR – da verificare', verified: false,
      photoData: state.photoURL, sections
    };
    store.songs.unshift(song);
    if (!saveStore(store)) {
      store.songs.shift();
      notify('Spazio insufficiente. Salva un backup o libera spazio sul dispositivo.');
      return;
    }
    state.photoURL = null;
    state.ocrDraft = null;
    state.ocrError = '';
    state.ocrTitle = '';
    state.view = 'library';
    openSong(song.id);
    notify('Partitura creata: verifica testo e accordi prima di utilizzarla.');
  }, true);
})();
