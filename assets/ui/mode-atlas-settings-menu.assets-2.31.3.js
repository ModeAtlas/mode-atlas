(function ModeAtlasSettingsMenuMarkup(){
  'use strict';
  if (window.ModeAtlasSettingsMenu) return;

  const icon = (href, name, cls = '') => `<svg class="ma-icon ${cls}" aria-hidden="true"><use href="${href('assets/mode-atlas-icons.svg')}#icon-${name}"></use></svg>`;

  window.ModeAtlasSettingsMenu = {
    markup({ href }){
      return `
        <div class="ma-drawer-backdrop ma-settings-backdrop" id="settingsBackdrop" data-ma-drawer-close="settings"></div>
        <aside class="ma-drawer ma-shared-settings-drawer" id="settingsDrawer" data-ma-shared-drawer="settings" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="settingsDrawerTitle">
          <div class="ma-drawer-head ma-settings-head">
            <div>
              <div class="ma-menu-kicker">Mode Atlas</div>
              <div class="ma-drawer-title" id="settingsDrawerTitle">Settings</div>
            </div>
            <button class="ma-button ma-button--ghost ma-icon-button ma-drawer-close" id="settingsCloseBtn" type="button" data-ma-drawer-close="settings" aria-label="Close settings" title="Close settings">${icon(href,'close')}</button>
          </div>

          <section class="ma-settings-section" aria-labelledby="maPreferencesTitle">
            <div class="ma-settings-section-head">
              <div class="ma-menu-kicker">Preferences</div>
              <div class="ma-settings-section-title" id="maPreferencesTitle">Study environment</div>
            </div>
            <div class="ma-setting-list">
              <div class="ma-setting-row ma-display-panel">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Display</div>
                                  </div>
                <div class="ma-setting-row__control ma-segmented ma-settings-segmented ma-settings-segmented--display" style="--ma-segment-count:4">
                  <button class="ma-button ma-display-option" data-display="auto" type="button">Auto</button>
                  <button class="ma-button ma-display-option" data-display="desktop" type="button">Desktop</button>
                  <button class="ma-button ma-display-option" data-display="tablet" type="button">iPad</button>
                  <button class="ma-button ma-display-option" data-display="phone" type="button">Phone</button>
                </div>
              </div>

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

          <details class="ma-settings-disclosure" open>
            <summary>
              <span><span class="ma-menu-kicker">Secondary tools</span><strong>Data & app</strong></span>
              ${icon(href,'chevron')}
            </summary>
            <div class="ma-setting-list ma-settings-data-list">
              <div class="ma-setting-row ma-setting-row--stack ma-save-section">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Save data</div>
                  <div class="ma-setting-row__description">Back up or restore your full Mode Atlas save.</div>
                </div>
                <div class="ma-setting-row__control ma-action-row ma-settings-inline-actions">
                  <button class="ma-button ma-button--primary" type="button" data-ma-unified-export>${icon(href,'download')}<span>Export</span></button>
                  <button class="ma-button" type="button" data-ma-unified-copy>Copy</button>
                  <button class="ma-button" type="button" data-ma-unified-import>${icon(href,'upload')}<span>Import</span></button>
                </div>
                <input type="file" accept=".json,application/json" data-ma-unified-file class="ma-file-input" hidden />
                <div class="ma-status ma-settings-status" data-ma-save-status role="status" aria-live="polite"></div>
              </div>

              <div class="ma-setting-row ma-setting-row--stack ma-tools-panel">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Application</div>
                  <div class="ma-setting-row__description">Version <span data-ma-current-version></span> · installation and update tools.</div>
                </div>
                <div class="ma-setting-row__control ma-action-row ma-settings-inline-actions">
                  <button class="ma-button" type="button" data-ma-about-open>${icon(href,'info')}<span>About</span></button>
                  <button class="ma-button" type="button" data-ma-install>Install app</button>
                  <button class="ma-button ma-button--primary" id="maCheckUpdatesBtn" type="button" data-ma-check-updates>${icon(href,'refresh')}<span data-ma-update-label>Check for updates</span></button>
                </div>
                <div class="ma-status ma-settings-status" id="maUpdateStatus">Current version: <span data-ma-current-version></span></div>
              </div>

              <div class="ma-setting-row ma-setting-row--stack">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Repair save data</div>
                  <div class="ma-setting-row__description">Use only if saved progress looks incomplete or inconsistent.</div>
                </div>
                <div class="ma-setting-row__control"><button class="ma-button" type="button" data-ma-repair-data>Repair save data</button></div>
              </div>

              <div class="ma-setting-row ma-setting-row--stack ma-setting-row--danger">
                <div class="ma-setting-row__copy">
                  <div class="ma-setting-row__label">Reset Mode Atlas</div>
                  <div class="ma-setting-row__description">Permanently clears local and synced study data after confirmation.</div>
                </div>
                <div class="ma-setting-row__control"><button class="ma-button ma-button--danger" type="button" data-ma-unified-reset>${icon(href,'delete')}<span>Reset data</span></button></div>
              </div>
            </div>
          </details>
        </aside>`;
    }
  };
})();
