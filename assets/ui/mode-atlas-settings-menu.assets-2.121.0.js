/* Settings owns preference layout; account navigation owns its sheet and focus. */
(function ModeAtlasSettingsMenuMarkup(){
  'use strict';
  if(window.ModeAtlasSettingsMenu)return;
  window.ModeAtlasSettingsMenu={markup({href}){
    const native=!!window.ModeAtlasEnv?.isNativeApp;
    const icon=name=>`<svg class="ma-icon" aria-hidden="true"><use href="${href('assets/mode-atlas-icons.svg')}#icon-${name}"></use></svg>`;
    const heading=(id,title,symbol)=>`<h3 class="ma-settings-section-title" id="${id}">${icon(symbol)}<span>${title}</span></h3>`;
    const action=(label,symbol,attribute,extra='')=>`<button class="ma-settings-action ${extra}" type="button" ${attribute}>${icon(symbol)}<span>${label}</span>${icon('arrow')}</button>`;
    return `
      <section class="ma-settings-section" aria-labelledby="maPreferencesTitle">
        ${heading('maPreferencesTitle','Make it yours','settings')}
        <div class="ma-settings-preferences">
          ${native?'':`<div class="ma-preference-row ma-display-panel"><span class="ma-setting-row__label">Display</span><div class="ma-setting-row__control ma-segmented ma-settings-segmented ma-settings-segmented--display">${['auto','desktop','tablet','phone'].map(value=>`<button class="ma-button ma-display-option" data-display="${value}" type="button">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div></div>`}
          <div class="ma-preference-row ma-sound-panel"><span class="ma-setting-row__label">Sound</span><div class="ma-setting-row__control ma-segmented ma-settings-segmented" style="--ma-segment-count:3">${[['soft','On'],['loud','Loud'],['off','Off']].map(([value,label])=>`<button class="ma-button ma-sound-toggle" data-ma-sound-choice="${value}" type="button">${label}</button>`).join('')}</div></div>
          ${native?`<div class="ma-preference-row"><span class="ma-setting-row__label">Haptics</span><div class="ma-setting-row__control ma-segmented ma-settings-segmented" style="--ma-segment-count:2"><button class="ma-button" type="button" data-ma-haptic-choice="on" aria-pressed="true">On</button><button class="ma-button" type="button" data-ma-haptic-choice="off" aria-pressed="false">Off</button></div></div>`:''}
          ${action('Themes & rewards','palette','data-ma-rewards-open="rewards"','ma-theme-panel')}
        </div>
      </section>
      ${native?(window.ModeAtlasNativeSettings?.markup?.()||''):''}
      <section class="ma-settings-section" aria-labelledby="maApplicationTitle">
        ${heading('maApplicationTitle','Explore & support','compass')}
        <div class="ma-settings-action-grid">
          ${action('Learning tours','compass','data-ma-tour')}
          ${action('Send feedback','message','data-ma-support')}
          ${action('About','info','data-ma-about-open')}
          ${native?'':action('Install app','download','data-ma-install')}
        </div>
        ${native?'':action('<span data-ma-update-label>Check for updates</span>','refresh','id="maCheckUpdatesBtn" data-ma-check-updates')}
        ${native?'':'<div class="ma-status ma-settings-status" id="maUpdateStatus" role="status" aria-live="polite"></div>'}
        <p class="ma-settings-version">Mode Atlas <span data-ma-current-version></span></p>
      </section>
      <section class="ma-settings-section ma-save-section" aria-labelledby="maDataTitle">
        ${heading('maDataTitle','Data & account','shield')}
        <div class="ma-settings-action-grid">
          ${action('Repair save','refresh','data-ma-repair-data')}
          ${action('Share guest learning','shield','data-ma-usage-settings hidden')}
          ${action('Reset data','delete','data-ma-unified-reset','ma-settings-action--danger')}
        </div>
        ${action('Delete account & data','delete','id="settingsDeleteAccountBtn" hidden','ma-settings-action--danger')}
        <div class="ma-status ma-settings-status" data-ma-save-status role="status" aria-live="polite"></div>
      </section>`;
  }};
})();
