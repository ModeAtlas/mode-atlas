(function ModeAtlasWordBankPage(){
  'use strict';
// Word Bank is local-first. cloud-sync.js owns Firebase/auth/hydration globally.

function refreshProfileShell() {
  window.ModeAtlasProfile?.refresh?.();
}

    const STORAGE_KEY = 'kanaWordBank';

    const elements = {
      kanaInput: document.getElementById('kanaInput'),
      addWordBtn: document.getElementById('addWordBtn'),
      clearInputBtn: document.getElementById('clearInputBtn'),
      statusMsg: document.getElementById('statusMsg'),
      entries: document.getElementById('entries'),
      searchInput: document.getElementById('searchInput'),
      sortSelect: document.getElementById('sortSelect'),
      filterSelect: document.getElementById('filterSelect'),
      clearAllBtn: document.getElementById('clearAllBtn'),
      statTotal: document.getElementById('statTotal'),
      statEnglish: document.getElementById('statEnglish'),
      statFavorites: document.getElementById('statFavorites'),
      statMissing: document.getElementById('statMissing'),
      addJumpBtn: document.getElementById('wordBankAddJumpBtn'),
      addPanel: document.getElementById('wordBankAddPanel'),
      actionsBtn: document.getElementById('wordBankActionsBtn'),
      actionsPanel: document.getElementById('wordBankActionsPanel'),
      introLead: document.getElementById('wordBankIntroLead'),
      libraryCount: document.getElementById('wordBankLibraryCount'),
      resultsMeta: document.getElementById('wordBankResultsMeta')
    };

    const baseMap = {
      'あ':'a','い':'i','う':'u','え':'e','お':'o',
      'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
      'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
      'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
      'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
      'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
      'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
      'や':'ya','ゆ':'yu','よ':'yo',
      'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
      'わ':'wa','を':'wo','ん':'n',
      'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
      'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
      'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
      'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
      'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
      'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
      'ゔ':'vu','ゎ':'wa',
      'ア':'a','イ':'i','ウ':'u','エ':'e','オ':'o',
      'カ':'ka','キ':'ki','ク':'ku','ケ':'ke','コ':'ko',
      'サ':'sa','シ':'shi','ス':'su','セ':'se','ソ':'so',
      'タ':'ta','チ':'chi','ツ':'tsu','テ':'te','ト':'to',
      'ナ':'na','ニ':'ni','ヌ':'nu','ネ':'ne','ノ':'no',
      'ハ':'ha','ヒ':'hi','フ':'fu','ヘ':'he','ホ':'ho',
      'マ':'ma','ミ':'mi','ム':'mu','メ':'me','モ':'mo',
      'ヤ':'ya','ユ':'yu','ヨ':'yo',
      'ラ':'ra','リ':'ri','ル':'ru','レ':'re','ロ':'ro',
      'ワ':'wa','ヲ':'wo','ン':'n',
      'ガ':'ga','ギ':'gi','グ':'gu','ゲ':'ge','ゴ':'go',
      'ザ':'za','ジ':'ji','ズ':'zu','ゼ':'ze','ゾ':'zo',
      'ダ':'da','ヂ':'ji','ヅ':'zu','デ':'de','ド':'do',
      'バ':'ba','ビ':'bi','ブ':'bu','ベ':'be','ボ':'bo',
      'パ':'pa','ピ':'pi','プ':'pu','ペ':'pe','ポ':'po',
      'ァ':'a','ィ':'i','ゥ':'u','ェ':'e','ォ':'o',
      'ヴ':'vu','ヮ':'wa'
    };

    const yoonMap = {
      'きゃ':'kya','きゅ':'kyu','きょ':'kyo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
      'しゃ':'sha','しゅ':'shu','しょ':'sho','じゃ':'ja','じゅ':'ju','じょ':'jo',
      'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
      'にゃ':'nya','にゅ':'nyu','にょ':'nyo','ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
      'びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
      'みゃ':'mya','みゅ':'myu','みょ':'myo','りゃ':'rya','りゅ':'ryu','りょ':'ryo',
      'ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo','ゔゅ':'vyu',
      'シェ':'she','ジェ':'je','チェ':'che','ティ':'ti','ディ':'di','トゥ':'tu','ドゥ':'du',
      'ファ':'fa','フィ':'fi','フェ':'fe','フォ':'fo','フュ':'fyu',
      'ウィ':'wi','ウェ':'we','ウォ':'wo',
      'ヴァ':'va','ヴィ':'vi','ヴェ':'ve','ヴォ':'vo','ヴュ':'vyu',
      'キャ':'kya','キュ':'kyu','キョ':'kyo','ギャ':'gya','ギュ':'gyu','ギョ':'gyo',
      'シャ':'sha','シュ':'shu','ショ':'sho','ジャ':'ja','ジュ':'ju','ジョ':'jo',
      'チャ':'cha','チュ':'chu','チョ':'cho',
      'ニャ':'nya','ニュ':'nyu','ニョ':'nyo','ヒャ':'hya','ヒュ':'hyu','ヒョ':'hyo',
      'ビャ':'bya','ビュ':'byu','ビョ':'byo','ピャ':'pya','ピュ':'pyu','ピョ':'pyo',
      'ミャ':'mya','ミュ':'myu','ミョ':'myo','リャ':'rya','リュ':'ryu','リョ':'ryo'
    };

    let wordBank = loadWordBank();
    const expandedEntries = new Set();

    function loadWordBank() {
      try {
        const parsed = window.ModeAtlasStorage.json(STORAGE_KEY, []);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function saveWordBank(nextWordBank = wordBank) {
      const store = window.ModeAtlasStorage;
      if (!store?.setJSON?.(STORAGE_KEY, nextWordBank)) return false;

      wordBank = nextWordBank;
      if (window.KanaCloudSync?.markSectionUpdated) window.KanaCloudSync.markSectionUpdated('wordBank');
      else store.now?.('kanaWordBankUpdatedAt');
      window.KanaCloudSync?.scheduleSync?.();
      return true;
    }

    function normalizeKana(value) {
      return (value || '').trim().replace(/\s+/g, '');
    }

    function getTimestamp() {
      return new Date().toISOString();
    }

    function showStatus(message, type = 'success') {
      window.ModeAtlasFeedback?.status?.(elements.statusMsg, message, type);
    }

    function clearStatus() {
      window.ModeAtlasFeedback?.clearStatus?.(elements.statusMsg);
    }

    function getRomajiForKana(input) {
      const kana = normalizeKana(input);
      if (!kana) return '';

      let result = '';
      let geminate = false;

      for (let i = 0; i < kana.length; i++) {
        const char = kana[i];
        const next = kana[i + 1] || '';
        const pair = char + next;

        if (char === 'っ' || char === 'ッ') {
          geminate = true;
          continue;
        }

        if (char === 'ー') {
          const lastVowel = getLastVowel(result);
          if (lastVowel) result += lastVowel;
          continue;
        }

        let chunk = '';
        let consumedPair = false;

        if (yoonMap[pair]) {
          chunk = yoonMap[pair];
          consumedPair = true;
        } else {
          chunk = baseMap[char] || char;
        }

        if (geminate && chunk) {
          const consonant = getLeadingConsonant(chunk);
          if (consonant) result += consonant;
          geminate = false;
        }

        result += chunk;
        if (consumedPair) i++;
      }

      result = result.replace(/nn([bmp])/g, 'n$1');
      return result;
    }

    function getLeadingConsonant(chunk) {
      const match = chunk.match(/^[^aeiou]+/i);
      if (!match) return '';
      if (match[0] === 'ch') return 'c';
      if (match[0] === 'sh') return 's';
      if (match[0] === 'ts') return 't';
      return match[0][0] || '';
    }

    function getLastVowel(text) {
      const match = text.match(/[aeiou](?!.*[aeiou])/i);
      return match ? match[0].toLowerCase() : '';
    }

    function classifyKanaType(kana) {
      if (!kana) return 'mixed';
      const onlyHiragana = /^[\u3041-\u3096ー]+$/.test(kana);
      const onlyKatakana = /^[\u30A1-\u30FA\u30FC]+$/.test(kana);
      if (onlyHiragana) return 'hiragana';
      if (onlyKatakana) return 'katakana';
      return 'mixed';
    }

    function buildEntry(kana) {
      const now = getTimestamp();
      return {
        id: `wb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kana,
        romaji: getRomajiForKana(kana),
        english: '',
        notes: '',
        favorite: false,
        createdAt: now,
        updatedAt: now
      };
    }

    function addWord() {
      const kana = normalizeKana(elements.kanaInput.value);
      if (!kana) {
        showStatus('Enter a kana word first.', 'warning');
        return;
      }

      const existing = wordBank.find(entry => entry.kana === kana);
      if (existing) {
        showStatus(`"${kana}" is already in your Word Bank.`, 'warning');
        renderEntries(existing.id);
        return;
      }

      const entry = buildEntry(kana);
      const nextWordBank = [entry, ...wordBank];
      if (!saveWordBank(nextWordBank)) {
        showStatus('Could not save this word. Please try again.', 'error');
        return;
      }
      expandedEntries.add(entry.id);
      elements.kanaInput.value = '';
      clearStatus();
      showStatus(`Added ${kana} to your Word Bank.`, 'success');
      renderEntries(entry.id);
      window.ModeAtlasDialog?.close?.(true);
    }

    function updateEntry(id, patch) {
      const index = wordBank.findIndex(entry => entry.id === id);
      if (index === -1) return;

      const next = { ...wordBank[index], ...patch, updatedAt: getTimestamp() };
      next.kana = normalizeKana(next.kana);
      next.romaji = getRomajiForKana(next.kana);
      const nextWordBank = wordBank.slice();
      nextWordBank[index] = next;
      if (!saveWordBank(nextWordBank)) {
        showStatus('Could not save your changes. Please try again.', 'error');
        return false;
      }
      renderEntries(id);
      return true;
    }

    async function deleteEntry(id) {
      const entry = wordBank.find(item => item.id === id);
      if (!entry) return;
      const confirmed = await window.ModeAtlasFeedback?.confirm?.({
        kicker: 'Word Bank',
        title: `Delete ${entry.kana}?`,
        message: 'This removes the word from your Word Bank. This action cannot be undone.',
        confirmLabel: 'Delete word',
        cancelLabel: 'Keep word',
        tone: 'danger'
      });
      if (!confirmed) return;
      const nextWordBank = wordBank.filter(item => item.id !== id);
      if (!saveWordBank(nextWordBank)) {
        showStatus('Could not delete this word. Please try again.', 'error');
        return;
      }
      renderEntries();
      showStatus(`Deleted ${entry.kana}.`, 'success');
    }

    async function clearAllWords() {
      if (!wordBank.length) {
        window.ModeAtlasFeedback?.toast?.('Your Word Bank is already empty.', 'warning');
        window.ModeAtlasDialog?.close?.(true);
        return;
      }
      const confirmed = await window.ModeAtlasFeedback?.confirm?.({
        kicker: 'Word Bank',
        title: 'Clear the entire Word Bank?',
        message: 'Every saved word will be removed. This action cannot be undone.',
        confirmLabel: 'Clear all words',
        cancelLabel: 'Keep words',
        tone: 'danger'
      });
      if (!confirmed) return;
      if (!saveWordBank([])) {
        window.ModeAtlasFeedback?.toast?.('Could not clear the Word Bank. Please try again.', 'error', 4200);
        return;
      }
      renderEntries();
      window.ModeAtlasDialog?.close?.(true);
      window.ModeAtlasFeedback?.toast?.('All words cleared.', 'success');
    }

    function getFilteredEntries() {
      const query = elements.searchInput.value.trim().toLowerCase();
      const sort = elements.sortSelect.value;
      const filter = elements.filterSelect.value;

      let items = wordBank.filter(entry => {
        const type = classifyKanaType(entry.kana);
        const matchesQuery = !query || [entry.kana, entry.romaji, entry.english, entry.notes]
          .join(' ')
          .toLowerCase()
          .includes(query);

        let matchesFilter = true;
        if (filter === 'favorites') matchesFilter = entry.favorite;
        else if (filter === 'missingEnglish') matchesFilter = !entry.english.trim();
        else if (filter === 'withNotes') matchesFilter = !!entry.notes.trim();
        else if (filter === 'hiragana') matchesFilter = type === 'hiragana';
        else if (filter === 'katakana') matchesFilter = type === 'katakana';
        else if (filter === 'mixed') matchesFilter = type === 'mixed';

        return matchesQuery && matchesFilter;
      });

      items.sort((a, b) => {
        if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sort === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt);
        if (sort === 'kanaAZ') return a.kana.localeCompare(b.kana, 'ja');
        if (sort === 'kanaZA') return b.kana.localeCompare(a.kana, 'ja');
        if (sort === 'romajiAZ') return a.romaji.localeCompare(b.romaji);
        if (sort === 'englishAZ') return (a.english || '').localeCompare(b.english || '');
        return 0;
      });

      return items;
    }

    function updateStats() {
      const total = wordBank.length;
      const withEnglish = wordBank.filter(entry => String(entry.english || '').trim()).length;
      const favorites = wordBank.filter(entry => entry.favorite).length;
      const missingEnglish = total - withEnglish;
      elements.statTotal.textContent = total;
      elements.statEnglish.textContent = withEnglish;
      elements.statFavorites.textContent = favorites;
      elements.statMissing.textContent = missingEnglish;
      [elements.statTotal, elements.statEnglish, elements.statFavorites, elements.statMissing].forEach(el => el?.classList.remove('ma-skeleton-text'));
      updateExperienceState({ total, favorites, missingEnglish });
    }

    function updateExperienceState({ total, favorites, missingEnglish }) {
      const populated = total > 0;
      document.body?.classList?.toggle?.('ma-wordbank-populated', populated);
      if (document.body?.dataset) document.body.dataset.maWordBankExperience = populated ? 'collection' : 'empty';
      if (elements.introLead) {
        elements.introLead.textContent = populated
          ? `${total} saved word${total === 1 ? '' : 's'}${favorites ? ` · ${favorites} favourite${favorites === 1 ? '' : 's'}` : ''}${missingEnglish ? ` · ${missingEnglish} still need${missingEnglish === 1 ? 's' : ''} a meaning` : ''}.`
          : 'Keep useful Japanese words close, then add meaning and notes as your vocabulary grows.';
      }
      if (elements.libraryCount) {
        elements.libraryCount.textContent = populated
          ? `${total} word${total === 1 ? '' : 's'} in your collection. Search, filter, or open a row to edit it.`
          : 'Add your first word to start a searchable vocabulary collection.';
      }
    }

    function formatDate(iso) {
      if (!iso) return 'Unknown';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleString([], {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    }

    function formatCompactDate(iso) {
      if (!iso) return 'Unknown';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }


    function createEl(tag, className = "", text = "") {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== "") el.textContent = text;
      return el;
    }

    function createIcon(name, className = "ma-icon") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", className);
      svg.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      const base = window.ModeAtlasVersionFile?.appUrl?.('/assets/mode-atlas-icons.svg') || '/assets/mode-atlas-icons.svg';
      use.setAttribute("href", `${base}#icon-${name}`);
      svg.append(use);
      return svg;
    }

    function safeEntryDomId(id) {
      return String(id || "entry").replace(/[^A-Za-z0-9_-]/g, "_");
    }

    function makeTextInput({ id, label, value, field, entryId, placeholder = "" }) {
      const wrap = createEl("div", "field-small ma-field");
      const labelEl = document.createElement("label");
      labelEl.setAttribute("for", id);
      labelEl.textContent = label;
      labelEl.className = "ma-field__label";

      const input = document.createElement("input");
      input.id = id;
      input.type = "text";
      input.className = "ma-input";
      input.name = field === "kana" ? `kana_word_${safeEntryDomId(entryId)}` : `word_english_${safeEntryDomId(entryId)}`;
      input.value = value || "";
      input.placeholder = placeholder;
      input.dataset.field = field;
      input.dataset.id = entryId;
      input.autocomplete = "off";
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "off");
      input.spellcheck = false;
      input.setAttribute("enterkeyhint", "done");

      wrap.append(labelEl, input);
      return wrap;
    }

    function makeEntryCard(entry) {
      const entryId = String(entry.id || "");
      const safeId = safeEntryDomId(entryId);
      const type = classifyKanaType(entry.kana);
      const englishMissing = !String(entry.english || "").trim();
      const isExpanded = expandedEntries.has(entryId);

      const details = createEl("details", "wordbank-entry");
      details.id = `entry-${safeId}`;
      details.dataset.id = entryId;
      details.open = isExpanded;

      const summary = createEl("summary", "card-summary");
      summary.dataset.id = entryId;

      const main = createEl("div", "card-summary-main");
      const wordLine = createEl("div", "wordbank-word-line");
      wordLine.append(createEl("div", "kana", entry.kana || ""));
      if (entry.favorite) {
        const favouriteMark = createEl("span", "wordbank-favourite-mark");
        favouriteMark.title = "Favourite";
        favouriteMark.append(createIcon("star-filled", "ma-icon ma-icon--small"));
        wordLine.append(favouriteMark);
      }
      main.append(
        wordLine,
        createEl("div", `wordbank-meaning ${englishMissing ? "is-missing" : ""}`.trim(), entry.english || "Add English meaning"),
        createEl("div", "romaji", entry.romaji || "—")
      );

      const typeCol = createEl("div", "summary-col");
      typeCol.append(
        createEl("div", "summary-label ma-kicker", "Type"),
        createEl("div", "summary-value", `${type}${entry.notes?.trim() ? " · notes" : ""}${englishMissing ? " · needs meaning" : ""}`)
      );

      const dateCol = createEl("div", "summary-col summary-date");
      dateCol.append(createEl("div", "summary-label ma-kicker", "Updated"), createEl("div", "summary-value", formatCompactDate(entry.updatedAt || entry.createdAt)));

      const toggle = createEl("div", "summary-toggle");
      toggle.append(createIcon("chevron", "ma-icon ma-icon--small"));
      summary.append(main, typeCol, dateCol, toggle);

      const body = createEl("div", "card-body");
      const cardTop = createEl("div", "card-top ma-section-head");
      const meta = createEl("div", "meta ma-action-row");
      meta.append(createEl("span", "tag ma-pill ma-pill--small", type));
      if (englishMissing) meta.append(createEl("span", "tag ma-pill ma-pill--small", "missing English"));

      const star = createEl("button", "ma-icon-button star-btn");
      star.type = "button";
      star.dataset.action = "favorite";
      star.dataset.id = entryId;
      star.title = entry.favorite ? "Remove from favourites" : "Add to favourites";
      star.setAttribute("aria-label", star.title);
      star.append(createIcon(entry.favorite ? "star-filled" : "star"));
      meta.append(star);
      cardTop.append(meta);

      const fields = createEl("div", "fields");
      const fieldGrid = createEl("div", "field-grid");
      fieldGrid.append(
        makeTextInput({ id: `kana-${safeId}`, label: "Kana", value: entry.kana, field: "kana", entryId }),
        makeTextInput({ id: `english-${safeId}`, label: "English", value: entry.english, field: "english", entryId, placeholder: "Add meaning now or later" })
      );

      const notesGrid = createEl("div", "field-grid single");
      const notesWrap = createEl("div", "field-small ma-field");
      const notesLabel = document.createElement("label");
      notesLabel.setAttribute("for", `notes-${safeId}`);
      notesLabel.textContent = "Notes";
      notesLabel.className = "ma-field__label";

      const notes = document.createElement("textarea");
      notes.id = `notes-${safeId}`;
      notes.className = "ma-textarea";
      notes.name = `word_notes_${safeId}`;
      notes.dataset.field = "notes";
      notes.dataset.id = entryId;
      notes.placeholder = "Add notes, usage, reminders, mnemonics, etc.";
      notes.autocomplete = "off";
      notes.setAttribute("autocorrect", "off");
      notes.setAttribute("autocapitalize", "off");
      notes.spellcheck = false;
      notes.value = entry.notes || "";
      notesWrap.append(notesLabel, notes);
      notesGrid.append(notesWrap);
      fields.append(fieldGrid, notesGrid);

      const actions = createEl("div", "card-actions");
      actions.append(createEl("div", "small-muted", `Added ${formatDate(entry.createdAt)} · Updated ${formatDate(entry.updatedAt)}`));

      const inline = createEl("div", "inline-actions ma-action-row");
      const save = createEl("button", "ma-button ma-button--primary", "Save changes");
      save.type = "button";
      save.dataset.action = "save";
      save.dataset.id = entryId;
      const del = createEl("button", "ma-icon-button wordbank-delete-btn");
      del.type = "button";
      del.dataset.action = "delete";
      del.dataset.id = entryId;
      del.title = "Delete word";
      del.setAttribute("aria-label", `Delete ${entry.kana || 'word'}`);
      del.append(createIcon("delete"));
      inline.append(save, del);
      actions.append(inline);

      body.append(cardTop, fields, actions);
      details.append(summary, body);
      return details;
    }

    function renderEntries(focusId = null) {
      updateStats();
      const items = getFilteredEntries();
      const queryActive = !!elements.searchInput.value.trim();
      const filterActive = elements.filterSelect.value !== 'all';
      if (elements.resultsMeta) {
        elements.resultsMeta.textContent = wordBank.length
          ? `${items.length} of ${wordBank.length} word${wordBank.length === 1 ? '' : 's'} shown`
          : '';
      }

      if (!items.length) {
        const empty = createEl("div", "empty ma-empty-state");
        const title = createEl("h3", "", wordBank.length ? 'No words match this view.' : 'Start your Word Bank.');
        const copy = createEl("p", "", wordBank.length
          ? 'Try a different search or remove the current filter.'
          : 'Add a Japanese word now. Romaji is generated automatically, and you can add its meaning or notes whenever you are ready.');
        const actions = createEl('div','wordbank-empty-actions ma-action-row');
        if (wordBank.length && (queryActive || filterActive)) {
          const clearView = createEl('button','ma-button ma-button--ghost','Clear search and filters');
          clearView.type = 'button';
          clearView.addEventListener('click', () => {
            elements.searchInput.value = '';
            elements.filterSelect.value = 'all';
            renderEntries();
            elements.searchInput.focus();
          });
          actions.append(clearView);
        }
        const addFirst = createEl("button", "ma-button ma-button--primary", wordBank.length ? 'Add another word' : 'Add your first word');
        addFirst.type = "button";
        addFirst.addEventListener("click", openAddWordDialog);
        actions.append(addFirst);
        empty.append(title, copy, actions);
        elements.entries.replaceChildren(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach(entry => fragment.append(makeEntryCard(entry)));
      elements.entries.replaceChildren(fragment);

      if (focusId) {
        const target = Array.from(elements.entries.querySelectorAll("details.wordbank-entry"))
          .find(node => node.dataset.id === String(focusId));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function openAddWordDialog(){
      clearStatus();
      window.ModeAtlasDialog?.feature?.({
        kicker: 'Word Bank',
        title: 'Add word',
        message: 'Enter kana first. Mode Atlas saves the word immediately and generates its romaji.',
        contentNode: elements.addPanel,
        dismissOnBackdrop: true
      });
      window.setTimeout(() => elements.kanaInput?.focus(), 80);
    }

    function openCollectionActionsDialog(){
      window.ModeAtlasDialog?.feature?.({
        kicker: 'Word Bank',
        title: 'Word Bank settings',
        contentNode: elements.actionsPanel,
        dismissOnBackdrop: true
      });
    }

    elements.addJumpBtn?.addEventListener('click', openAddWordDialog);
    elements.actionsBtn?.addEventListener('click', openCollectionActionsDialog);

    elements.addWordBtn.addEventListener('click', addWord);
    elements.kanaInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      addWord();
    });
    elements.addWordBtn.disabled = false;
    elements.addWordBtn.setAttribute('aria-disabled', 'false');
    elements.clearInputBtn.addEventListener('click', () => {
      elements.kanaInput.value = '';
      clearStatus();
      });

    [elements.searchInput, elements.sortSelect, elements.filterSelect].forEach(el => {
      el.addEventListener('input', () => renderEntries());
      el.addEventListener('change', () => renderEntries());
    });

    elements.entries.addEventListener('toggle', event => {
      const details = event.target.closest('details.wordbank-entry');
      if (!details) return;
      const id = details.dataset.id || details.id.replace('entry-', '');
      if (details.open) expandedEntries.add(id);
      else expandedEntries.delete(id);
    });

    elements.entries.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === 'delete') {
        void deleteEntry(id);
        return;
      }

      if (action === 'favorite') {
        const current = wordBank.find(entry => entry.id === id);
        if (!current) return;
        updateEntry(id, { favorite: !current.favorite });
        return;
      }

      if (action === 'save') {
        const kanaField = document.querySelector(`[data-field="kana"][data-id="${id}"]`);
        const englishField = document.querySelector(`[data-field="english"][data-id="${id}"]`);
        const notesField = document.querySelector(`[data-field="notes"][data-id="${id}"]`);
        const nextKana = normalizeKana(kanaField?.value || '');
        if (!nextKana) {
          showStatus('Kana cannot be empty.', 'error');
          return;
        }

        const duplicate = wordBank.find(entry => entry.id !== id && entry.kana === nextKana);
        if (duplicate) {
          showStatus(`Cannot save. "${nextKana}" already exists in your Word Bank.`, 'error');
          renderEntries(duplicate.id);
          return;
        }

        const saved = updateEntry(id, {
          kana: nextKana,
          english: (englishField?.value || '').trim(),
          notes: (notesField?.value || '').trim()
        });
        if (saved) showStatus(`Saved ${nextKana}.`, 'success');
      }
    });


    elements.clearAllBtn.addEventListener('click', clearAllWords);

    renderEntries();

    const refreshWordBankFromStorage = () => {
      wordBank = loadWordBank();
      renderEntries();
      refreshProfileShell();
    };

    window.addEventListener('modeAtlasCloudDataChanged', (event) => {
      const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
      if (!sections.length || sections.includes('wordBank')) refreshWordBankFromStorage();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted === true) refreshWordBankFromStorage();
    });
    window.addEventListener('storage', (event) => {
      if (!event.key || event.key === STORAGE_KEY) refreshWordBankFromStorage();
    });
})();
