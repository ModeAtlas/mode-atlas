(function ModeAtlasSettingsMenuMarkup(){
  'use strict';
  if (window.ModeAtlasSettingsMenu) return;

  const icon = (href, name, cls = '') => `<svg class="ma-icon ${cls}" aria-hidden="true"><use href="${href('assets/mode-atlas-icons.svg')}#icon-${name}"></use></svg>`;

  window.ModeAtlasSettingsMenu = {
    markup({ href }){
      const native = !!window.ModeAtlasEnv?.isNativeApp;
      return `
          <section class="ma-settings-section" aria-labelledby="maPreferencesTitle">
            <div class="ma-settings-section-head">
              <h3 class="ma-settings-section-title" id="maPreferencesTitle">Preferences</h3>
            </div>
            <div class="ma-setting-list">
              ${native ? '' : `<div class="ma-setting-row ma-display-panel">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Display</div>
                </div>
                <div class="ma-setting-row__control ma-segmented ma-settings-segmented ma-settings-segmented--display" style="--ma-segment-count:4">
                  <button class="ma-button ma-display-option" data-display="auto" type="button">Auto</button>
                  <button class="ma-button ma-display-option" data-display="desktop" type="button">Desktop</button>
                  <button class="ma-button ma-display-option" data-display="tablet" type="button">Tablet</button>
                  <button class="ma-button ma-display-option" data-display="phone" type="button">Phone</button>
                </div>
              </div>`}

              <div class="ma-setting-row ma-sound-panel">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Sound</div>
                </div>
                <div class="ma-setting-row__control ma-segmented ma-settings-segmented" style="--ma-segment-count:3">
                  <button type="button" class="ma-button ma-sound-toggle" data-ma-sound-choice="soft">On</button>
                  <button type="button" class="ma-button ma-sound-toggle" data-ma-sound-choice="loud">Loud</button>
                  <button type="button" class="ma-button ma-sound-toggle" data-ma-sound-choice="off">Off</button>
                </div>
              </div>

              ${native ? `<div class="ma-setting-row"><div class="ma-setting-row__copy"><div class="ma-setting-row__label">Haptics</div></div><div class="ma-setting-row__control ma-segmented ma-settings-segmented" style="--ma-segment-count:2"><button type="button" class="ma-button" data-ma-haptic-choice="on" aria-pressed="true">On</button><button type="button" class="ma-button" data-ma-haptic-choice="off" aria-pressed="false">Off</button></div></div>` : ''}

              <div class="ma-setting-row ma-theme-panel">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Appearance</div>
                </div>
                <div class="ma-setting-row__control ma-segmented ma-settings-segmented" style="--ma-segment-count:3">
                  <button class="ma-button ma-theme-choice-btn" type="button" data-ma-theme-choice="dark">Dark</button>
                  <button class="ma-button ma-theme-choice-btn" type="button" data-ma-theme-choice="light">Light</button>
                  <button class="ma-button ma-theme-choice-btn" type="button" data-ma-theme-choice="system">System</button>
                </div>
              </div>
            </div>
          </section>

          ${native ? (window.ModeAtlasNativeSettings?.markup?.() || '') : ''}

          <section class="ma-settings-section" aria-labelledby="maDataTitle">
            <h3 class="ma-settings-section-title" id="maDataTitle">Data and account</h3>
            <div class="ma-setting-list ma-settings-data-list">
              <div class="ma-setting-row ma-setting-row--stack ma-save-section">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__description">Progress saves automatically on this device. Sign in to sync across devices.</div>
                </div>
                <div class="ma-setting-row__control ma-action-row ma-settings-inline-actions">
                  <button class="ma-button" type="button" data-ma-repair-data>Repair save</button>
                  <button class="ma-button ma-button--danger" type="button" data-ma-unified-reset>${icon(href,'delete')}<span>Reset data</span></button>
                  <button class="ma-button ma-button--danger" id="settingsDeleteAccountBtn" type="button" hidden>Delete account &amp; data</button>
                </div>
                <div class="ma-status ma-settings-status" data-ma-save-status role="status" aria-live="polite"></div>
              </div>

            </div>
          </section>
          <section class="ma-settings-section" aria-labelledby="maApplicationTitle">
            <h3 class="ma-settings-section-title" id="maApplicationTitle">Application</h3>
            <div class="ma-setting-list">
              <div class="ma-setting-row ma-setting-row--stack ma-tools-panel">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__description">Version <span data-ma-current-version></span></div>
                </div>
                <div class="ma-setting-row__control ma-action-row ma-settings-inline-actions">
                  <button class="ma-button" type="button" data-ma-about-open>${icon(href,'info')}<span>About</span></button>
                  ${native ? '' : '<button class="ma-button" type="button" data-ma-install>Install app</button>'}
                  ${native ? '' : `<button class="ma-button ma-button--primary" id="maCheckUpdatesBtn" type="button" data-ma-check-updates>${icon(href,'refresh')}<span data-ma-update-label>Check for updates</span></button>`}
                </div>
                ${native ? '' : '<div class="ma-status ma-settings-status" id="maUpdateStatus" role="status" aria-live="polite"></div>'}
              </div>

            </div>
          </section>
        `;
    }
  };
})();
