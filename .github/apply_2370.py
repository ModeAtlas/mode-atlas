from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel,text): (ROOT/rel).write_text(text,encoding='utf-8')
def replace_once(src,old,new,label):
    n=src.count(old)
    if n!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {n}')
    return src.replace(old,new,1)

# Word Bank HTML: open collection composition rather than nested cards.
html=read('wordbank/index.html')
start=html.index('    <section class="hero ma-card ma-page-hero ma-page-intro">')
end=html.index('      <div class="wordbank-add-host" aria-hidden="true">')
new_markup='''    <section class="wordbank-intro ma-page-hero" aria-labelledby="wordBankTitle">
      <div class="wordbank-intro__copy">
        <span class="ma-kicker">Personal vocabulary</span>
        <h1 id="wordBankTitle">Word Bank</h1>
        <p id="wordBankIntroLead">Keep useful Japanese words close, then add meaning and notes as your vocabulary grows.</p>
      </div>
      <div class="wordbank-hero-actions">
        <button class="ma-button ma-button--primary" id="wordBankAddJumpBtn" type="button">
          <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-edit"></use></svg>
          <span>Add word</span>
        </button>
        <button class="ma-icon-button" id="wordBankActionsBtn" type="button" aria-label="Word Bank settings" title="Word Bank settings">
          <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-settings"></use></svg>
        </button>
      </div>
      <div class="wordbank-overview" aria-label="Word Bank summary">
        <div><span>Total words</span><strong class="ma-skeleton-text" id="statTotal">—</strong></div>
        <div><span>With English</span><strong class="ma-skeleton-text" id="statEnglish">—</strong></div>
        <div><span>Favourites</span><strong class="ma-skeleton-text" id="statFavorites">—</strong></div>
        <div><span>Needs meaning</span><strong class="ma-skeleton-text" id="statMissing">—</strong></div>
      </div>
    </section>

    <section class="wordbank-library ma-page-section" aria-labelledby="wordBankLibraryTitle">
      <header class="library-head ma-section-head">
        <div>
          <span class="ma-kicker">Your collection</span>
          <h2 id="wordBankLibraryTitle">Saved words</h2>
          <p id="wordBankLibraryCount">Your saved vocabulary, ready to search and update.</p>
        </div>
      </header>

      <div class="toolbar ma-toolbar-shared ma-toolbar-shared--sticky">
        <div class="field ma-field search-field">
          <label class="ma-field__label" for="searchInput">Search</label>
          <div class="wordbank-input-with-icon">
            <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-search"></use></svg>
            <input class="ma-input" id="searchInput" type="text" name="wordbank_search" placeholder="Kana, romaji, English, or notes" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
          </div>
        </div>
        <div class="field ma-field">
          <label class="ma-field__label" for="sortSelect">Sort</label>
          <select class="ma-select" id="sortSelect">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="kanaAZ">Kana A-Z</option>
            <option value="kanaZA">Kana Z-A</option>
            <option value="romajiAZ">Romaji A-Z</option>
            <option value="englishAZ">English A-Z</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
        <div class="field ma-field">
          <label class="ma-field__label" for="filterSelect">Filter</label>
          <select class="ma-select" id="filterSelect">
            <option value="all">All entries</option>
            <option value="favorites">Favourites only</option>
            <option value="missingEnglish">Missing English</option>
            <option value="withNotes">With notes</option>
            <option value="hiragana">Hiragana only</option>
            <option value="katakana">Katakana only</option>
            <option value="mixed">Mixed / other</option>
          </select>
        </div>
      </div>

      <div class="wordbank-results-meta" id="wordBankResultsMeta" aria-live="polite"></div>
      <div class="entries" id="entries">
        <div class="ma-skeleton-block" aria-hidden="true"></div>
        <div class="ma-skeleton-block" aria-hidden="true"></div>
      </div>
    </section>

'''
html=html[:start]+new_markup+html[end:]
write('wordbank/index.html',html)

# Word Bank runtime: state-aware copy, distinct empty states, list-row ownership.
js=read('assets/pages/mode-atlas-wordbank-page.js')
js=replace_once(js,
"      actionsBtn: document.getElementById('wordBankActionsBtn'),\n      actionsPanel: document.getElementById('wordBankActionsPanel')",
"      actionsBtn: document.getElementById('wordBankActionsBtn'),\n      actionsPanel: document.getElementById('wordBankActionsPanel'),\n      introLead: document.getElementById('wordBankIntroLead'),\n      libraryCount: document.getElementById('wordBankLibraryCount'),\n      resultsMeta: document.getElementById('wordBankResultsMeta')",
'elements state copy')
js=replace_once(js,
'''    function updateStats() {
      const total = wordBank.length;
      const withEnglish = wordBank.filter(entry => entry.english.trim()).length;
      const favorites = wordBank.filter(entry => entry.favorite).length;
      const missingEnglish = total - withEnglish;
      elements.statTotal.textContent = total;
      elements.statEnglish.textContent = withEnglish;
      elements.statFavorites.textContent = favorites;
      elements.statMissing.textContent = missingEnglish;
      [elements.statTotal, elements.statEnglish, elements.statFavorites, elements.statMissing].forEach(el => el?.classList.remove('ma-skeleton-text'));
    }
''',
'''    function updateStats() {
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
      document.body.classList.toggle('ma-wordbank-populated', populated);
      document.body.dataset.maWordBankExperience = populated ? 'collection' : 'empty';
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
''','stats and experience state')
js=replace_once(js,
'''    function formatDate(iso) {
      if (!iso) return 'Unknown';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleString([], {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    }
''',
'''    function formatDate(iso) {
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
''','compact date')
js=replace_once(js,'const details = createEl("details", "card ma-card ma-card--soft");','const details = createEl("details", "wordbank-entry");','entry list surface')
js=replace_once(js,
'createEl("div", "summary-value", `${type}${englishMissing ? " · missing English" : ""}`)',
'createEl("div", "summary-value", `${type}${entry.notes?.trim() ? " · notes" : ""}${englishMissing ? " · needs meaning" : ""}`)',
'entry metadata')
js=replace_once(js,
'      dateCol.append(createEl("div", "summary-label ma-kicker", "Added"), createEl("div", "summary-value", formatDate(entry.createdAt)));',
'      dateCol.append(createEl("div", "summary-label ma-kicker", "Updated"), createEl("div", "summary-value", formatCompactDate(entry.updatedAt || entry.createdAt)));',
'entry date')
old_render='''    function renderEntries(focusId = null) {
      updateStats();
      const items = getFilteredEntries();

      if (!items.length) {
        const empty = createEl("div", "empty ma-card ma-empty-state");
        empty.append(createEl("div", "", "No matching words yet."));
        const addFirst = createEl("button", "ma-button ma-button--primary", "Add a word");
        addFirst.type = "button";
        addFirst.addEventListener("click", openAddWordDialog);
        empty.append(addFirst);
        elements.entries.replaceChildren(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach(entry => fragment.append(makeEntryCard(entry)));
      elements.entries.replaceChildren(fragment);

      if (focusId) {
        const target = Array.from(elements.entries.querySelectorAll("details.card"))
          .find(node => node.dataset.id === String(focusId));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
'''
new_render='''    function renderEntries(focusId = null) {
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
          const clearView = createEl('button','ma-button ma-button--ghost','Clear search & filters');
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
'''
js=replace_once(js,old_render,new_render,'render entries states')
js=replace_once(js,"const details = event.target.closest('details.card');","const details = event.target.closest('details.wordbank-entry');",'toggle list selector')
write('assets/pages/mode-atlas-wordbank-page.js',js)

css=r'''/* Word Bank page composition. Shared controls, forms, status, dialogs and
   navigation remain shared owners; this file owns the collection layout only. */

body.ma-wordbank-page{
  margin:0;
  min-height:100vh;
  overflow-x:hidden;
  color:var(--ma-text);
  background:var(--ma-page-bg-words);
}
.ma-wordbank-page .wrap{
  --ma-page-max:var(--ma-content-max);
  margin-bottom:64px;
}

/* The page header is context, not another card. */
.wordbank-intro{
  width:min(1180px,100%);
  margin:0 auto;
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:end;
  gap:28px 40px;
  padding:clamp(42px,6vw,72px) 0 30px;
  border-bottom:1px solid var(--ma-border);
}
.wordbank-intro__copy{max-width:760px;min-width:0;}
.wordbank-intro__copy .ma-kicker{--ma-kicker-color:var(--ma-words);}
.wordbank-intro h1{
  margin:7px 0 0;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(2.7rem,5.7vw,5rem);
  font-weight:860;
  line-height:.95;
  letter-spacing:-.065em;
}
.wordbank-intro__copy p{
  max-width:700px;
  margin:16px 0 0;
  color:var(--ma-text-soft);
  font-size:clamp(.98rem,1.45vw,1.1rem);
  line-height:1.6;
}
.wordbank-hero-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;}
.wordbank-actions-host,.wordbank-add-host{display:none;}
.wordbank-actions-dialog-content,.wordbank-add-dialog-content{display:grid;gap:var(--ma-space-4);}
.wordbank-add-dialog-content .wordbank-add-group{margin-top:0;}
.wordbank-add-group .ma-field__label{margin-top:0;}
.btn-row{--ma-action-gap:var(--ma-space-2);margin-top:var(--ma-space-4);}
#statusMsg{margin-top:var(--ma-space-3);min-height:22px;}

.wordbank-overview{
  grid-column:1 / -1;
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  margin-top:6px;
  border-top:1px solid var(--ma-border);
}
.wordbank-overview>div{
  min-width:0;
  display:grid;
  gap:5px;
  padding:18px 22px 2px 0;
  border-right:1px solid var(--ma-border);
}
.wordbank-overview>div+div{padding-left:22px;}
.wordbank-overview>div:last-child{border-right:0;}
.wordbank-overview span{color:var(--ma-muted);font-size:.72rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase;}
.wordbank-overview strong{color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:1.7rem;font-variant-numeric:tabular-nums;line-height:1;}
.ma-wordbank-page.ma-wordbank-populated .wordbank-intro{padding-top:30px;}
.ma-wordbank-page.ma-wordbank-populated .wordbank-intro h1{font-size:clamp(2.3rem,4.4vw,3.7rem);}
.ma-wordbank-page.ma-wordbank-populated .wordbank-intro__copy p{margin-top:10px;font-size:.94rem;}

/* Library is the page, not a card inside the page. */
.wordbank-library{
  width:min(1180px,100%);
  margin:0 auto;
  padding:clamp(40px,6vw,64px) 0 0;
}
.library-head{--ma-section-head-gap:var(--ma-space-4);margin-bottom:24px;}
.library-head .ma-kicker{--ma-kicker-color:var(--ma-words);}
.library-head h2{
  margin:6px 0 0;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(2rem,3.6vw,3.15rem);
  letter-spacing:-.05em;
  line-height:1;
}
.library-head p{max-width:700px;margin:10px 0 0;color:var(--ma-muted);font-size:.92rem;line-height:1.5;}

.toolbar{
  grid-template-columns:minmax(240px,1.55fr) minmax(150px,.65fr) minmax(150px,.65fr);
  padding:12px;
  border:1px solid var(--ma-border);
  border-radius:var(--ma-radius-lg);
  background:color-mix(in srgb,var(--ma-card-2) 92%,transparent);
  box-shadow:var(--ma-shadow-soft);
}
.toolbar.ma-toolbar-shared--sticky{top:calc(var(--ma-nav-sticky-offset,12px) + 76px);z-index:3;}
.toolbar .ma-field__label{margin-top:0;}
.wordbank-input-with-icon{position:relative;}
.wordbank-input-with-icon>.ma-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--ma-muted);pointer-events:none;}
.wordbank-input-with-icon .ma-input{padding-left:40px;}
.wordbank-results-meta{min-height:20px;margin:13px 2px 7px;color:var(--ma-muted);font-size:.75rem;font-weight:750;}

.entries{
  display:grid;
  gap:0;
  border-top:1px solid var(--ma-border);
  border-bottom:1px solid var(--ma-border);
}

/* Saved vocabulary is a scan-friendly list. */
.wordbank-entry{
  min-width:0;
  border-bottom:1px solid var(--ma-border);
  background:transparent;
}
.wordbank-entry:last-child{border-bottom:0;}
.card-summary{
  display:grid;
  grid-template-columns:minmax(260px,1fr) minmax(160px,.34fr) minmax(145px,.32fr) auto;
  gap:24px;
  align-items:center;
  min-height:94px;
  padding:15px 10px;
  cursor:pointer;
  list-style:none;
  transition:background var(--ma-motion-fast) ease;
}
.card-summary::-webkit-details-marker{display:none;}
.card-summary:hover{background:color-mix(in srgb,var(--ma-card-2) 34%,transparent);}
.card-summary:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:-3px;}
.card-summary-main{min-width:0;}
.wordbank-word-line{display:flex;align-items:center;gap:9px;min-width:0;}
.kana{min-width:0;overflow-wrap:anywhere;color:var(--ma-text-strong);font-family:var(--ma-font-jp);font-size:clamp(1.55rem,2.3vw,1.9rem);font-weight:900;line-height:1.1;letter-spacing:-.03em;}
.wordbank-favourite-mark{display:inline-flex;flex:0 0 auto;color:var(--ma-warning);}
.wordbank-meaning{margin-top:5px;overflow:hidden;color:var(--ma-text);font-size:.98rem;font-weight:800;text-overflow:ellipsis;white-space:nowrap;}
.wordbank-meaning.is-missing{color:var(--ma-muted);font-weight:650;font-style:italic;}
.romaji{margin-top:3px;color:color-mix(in srgb,var(--ma-words) 65%,var(--ma-text));font-size:.82rem;font-weight:760;word-break:break-word;}
.summary-col{min-width:0;}
.summary-label{--ma-kicker-size:.66rem;--ma-kicker-spacing:.06em;margin-bottom:5px;}
.summary-value{overflow:hidden;color:var(--ma-text-soft);font-size:.82rem;text-overflow:ellipsis;white-space:nowrap;}
.summary-date{text-align:right;}
.summary-toggle{width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:50%;color:var(--ma-muted);background:transparent;transition:background var(--ma-motion-fast) ease,color var(--ma-motion-fast) ease;}
.card-summary:hover .summary-toggle{background:var(--ma-surface-inset);}
.summary-toggle .ma-icon{transform:rotate(90deg);transition:transform var(--ma-motion-fast) ease;}
.wordbank-entry[open] .summary-toggle .ma-icon{transform:rotate(-90deg);}
.wordbank-entry[open] .summary-toggle{color:var(--ma-text);}

.card-body{
  padding:20px 18px 20px;
  border-top:1px solid var(--ma-border);
  background:color-mix(in srgb,var(--ma-card-3) 42%,transparent);
}
.card-top{--ma-section-head-gap:var(--ma-space-3);margin-bottom:14px;}
.meta{--ma-action-gap:var(--ma-space-2);}
.meta .tag{--ma-pill-bg:var(--ma-card-2);--ma-pill-border:var(--ma-border);--ma-pill-color:var(--ma-muted);}
.star-btn{color:var(--ma-warning);}
.fields{display:grid;gap:12px;}
.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.field-grid.single{grid-template-columns:1fr;}
.card-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:16px;}
.small-muted{color:var(--ma-muted);font-size:.75rem;}
.inline-actions{--ma-action-gap:var(--ma-space-2);}
.wordbank-delete-btn{color:var(--ma-danger);border-color:color-mix(in srgb,var(--ma-danger) 34%,var(--ma-border));}

.empty{
  min-height:260px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding:42px 20px;
  border:0;
  text-align:center;
  background:transparent;
}
.empty h3{margin:0;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.55rem,3vw,2.2rem);letter-spacing:-.04em;}
.empty p{max-width:560px;margin:0;color:var(--ma-muted);font-size:.92rem;line-height:1.55;}
.wordbank-empty-actions{--ma-action-gap:10px;justify-content:center;margin-top:10px;}

@media(max-width:820px){
  .wordbank-intro{grid-template-columns:1fr;align-items:start;padding-top:38px;}
  .wordbank-hero-actions{justify-content:flex-start;}
  .wordbank-overview{grid-template-columns:repeat(2,minmax(0,1fr));}
  .wordbank-overview>div{padding:14px 16px 14px 0;border-bottom:1px solid var(--ma-border);}
  .wordbank-overview>div+div{padding-left:16px;}
  .wordbank-overview>div:nth-child(2){border-right:0;}
  .wordbank-overview>div:nth-child(n+3){border-bottom:0;}
  .toolbar{grid-template-columns:1fr;position:static;}
  .card-summary{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:14px;}
  .summary-col{display:none;}
  .summary-toggle{grid-column:2;grid-row:1;}
}

@media(max-width:600px){
  .ma-wordbank-page .wrap{margin-bottom:40px;}
  .wordbank-intro{padding:28px 0 22px;gap:20px;}
  .wordbank-intro h1,.ma-wordbank-page.ma-wordbank-populated .wordbank-intro h1{font-size:clamp(2.25rem,12vw,3.1rem);}
  .wordbank-hero-actions{width:100%;}
  .wordbank-hero-actions #wordBankAddJumpBtn{flex:1;width:auto;}
  .wordbank-library{padding-top:32px;}
  .wordbank-overview strong{font-size:1.45rem;}
  .card-summary{min-height:82px;padding:13px 4px;}
  .card-body{padding:18px 10px;}
  .field-grid{grid-template-columns:1fr;}
  .card-top,.card-actions{align-items:stretch;flex-direction:column;}
  .inline-actions{width:100%;}
  .inline-actions .ma-button{flex:1;}
  .wordbank-empty-actions{width:100%;flex-direction:column;}
  .wordbank-empty-actions .ma-button{width:100%;}
}

body[data-effective-display-mode="tablet"] .toolbar{grid-template-columns:1fr;position:static;}
body[data-effective-display-mode="tablet"] .card-summary{grid-template-columns:minmax(0,1fr) auto;align-items:start;}
body[data-effective-display-mode="tablet"] .summary-col{display:none;}
body[data-effective-display-mode="phone"] .wordbank-intro{grid-template-columns:1fr;}
body[data-effective-display-mode="phone"] .toolbar,
body[data-effective-display-mode="phone"] .field-grid{grid-template-columns:1fr;}
body[data-effective-display-mode="phone"] .wordbank-overview{grid-template-columns:repeat(2,minmax(0,1fr));}
body[data-effective-display-mode="phone"] .card-summary{grid-template-columns:minmax(0,1fr) auto;}
body[data-effective-display-mode="phone"] .summary-col{display:none;}

@media(prefers-reduced-motion:reduce){.card-summary,.summary-toggle{transition:none;}}
'''
write('assets/css/mode-atlas-wordbank-page.css',css)

# Release metadata.
version=read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.36.1';","var VERSION = '2.37.0';").replace("var CACHE_REVISION = 'assets-2.36.1';","var CACHE_REVISION = 'assets-2.37.0';")
write('assets/app/mode-atlas-version.js',version)
for rel in ('package.json','package-lock.json'):
    data=json.loads(read(rel)); data['version']='2.37.0'
    if rel=='package-lock.json': data.setdefault('packages',{}).setdefault('',{})['version']='2.37.0'
    write(rel,json.dumps(data,indent=2)+'\n')
write('README.md',read('README.md').replace('Version: 2.36.1','Version: 2.37.0'))
changelog=read('CHANGELOG.md')
entry='''## 2.37.0 - 2026-08-16
- Reworked Word Bank from nested hero/library/entry cards into an open, collection-first vocabulary surface with scan-friendly rows.
- Added collection-aware page copy: empty libraries explain how to begin, while established libraries lead with saved-word, favourite, and missing-meaning context instead of repeating product onboarding copy.
- Kept kana, meaning, and romaji as the primary scan targets while moving type, update date, notes state, favourite controls, and editing into quieter supporting positions.
- Added distinct empty-library and zero-filter-result states, including a one-click clear-search-and-filters action when the collection exists but the current view is empty.
- Preserved Word Bank schema, romaji generation, persistence order, duplicate handling, cloud sync, import/export ownership, and destructive-confirmation behavior.

'''
if not changelog.startswith('## 2.37.0'): changelog=entry+changelog
write('CHANGELOG.md',changelog)

# Contract test.
tests=read('tests/frontend.test.js')
append=r'''

test('2.37 Word Bank is collection-first, state-aware, and keeps editing progressive', () => {
  const html = read('wordbank/index.html');
  const js = read('assets/pages/mode-atlas-wordbank-page.js');
  const css = read('assets/css/mode-atlas-wordbank-page.css');

  assert.match(html, /class="wordbank-intro ma-page-hero"/);
  assert.doesNotMatch(html, /class="hero ma-card ma-page-hero/);
  assert.match(html, /class="wordbank-overview"/);
  assert.match(html, /class="wordbank-library ma-page-section"/);
  assert.doesNotMatch(html, /library-panel ma-card/);
  assert.match(js, /function updateExperienceState/);
  assert.match(js, /ma-wordbank-populated/);
  assert.match(js, /No words match this view\./);
  assert.match(js, /Start your Word Bank\./);
  assert.match(js, /Clear search & filters/);
  assert.match(js, /createEl\("details", "wordbank-entry"\)/);
  assert.doesNotMatch(js, /createEl\("details", "card ma-card ma-card--soft"\)/);
  assert.match(css, /\.wordbank-entry\{/);
  assert.match(css, /\.ma-wordbank-page\.ma-wordbank-populated \.wordbank-intro/);
});
'''
if '2.37 Word Bank is collection-first' not in tests: tests=tests.rstrip()+append
write('tests/frontend.test.js',tests)
