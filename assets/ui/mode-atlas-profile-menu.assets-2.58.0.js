(function ModeAtlasProfileMenuMarkup(){
  'use strict';
  if (window.ModeAtlasProfileMenu) return;

  const icon = (href, name, cls = '') => `<svg class="ma-icon ${cls}" aria-hidden="true"><use href="${href('assets/mode-atlas-icons.svg')}#icon-${name}"></use></svg>`;

  window.ModeAtlasProfileMenu = {
    markup({ href }){
      return `
        <div class="ma-drawer-backdrop ma-profile-backdrop" id="profileBackdrop" data-ma-drawer-close="profile"></div>
        <aside class="ma-drawer ma-shared-profile-drawer" id="profileDrawer" data-ma-shared-drawer="profile" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="profileDrawerTitle">
          <div class="ma-drawer-head ma-profile-head">
            <div>
              <div class="ma-menu-kicker">Your account</div>
              <div class="ma-drawer-title" id="profileDrawerTitle">Profile</div>
            </div>
            <button class="ma-button ma-button--ghost ma-icon-button ma-drawer-close" id="profileCloseBtn" type="button" data-ma-drawer-close="profile" aria-label="Close profile" title="Close profile">${icon(href,'close')}</button>
          </div>

          <section class="ma-card ma-card--soft ma-profile-card ma-account-card" aria-label="Google account">
            <div class="ma-account-user">
              <img class="ma-account-avatar" id="profileAvatar" alt="" />
              <div class="ma-account-copy">
                <div class="ma-account-name" id="profileName">Guest</div>
                <div class="ma-account-email" id="profileEmail">Not signed in</div>
              </div>
            </div>
            <div class="ma-auth-actions">
              <button class="ma-button ma-button--primary ma-button--wide" id="profileAuthBtn" data-profile-auth type="button">
                <span data-profile-auth-label>Sign in with Google</span>
              </button>
            </div>
          </section>

          <section class="ma-card ma-card--soft ma-profile-card ma-sync-card" aria-label="Sync status">
            <div class="ma-profile-card-head">
              <div>
                <div class="ma-menu-kicker">Save status</div>
                <div class="ma-profile-card-title">Cloud sync</div>
              </div>
              <span class="ma-status-chip ma-status-chip--info" id="profileSyncChip">Checking</span>
            </div>
            <div class="ma-sync-status-line">
              <span class="ma-sync-dot" id="profileSyncDot" aria-hidden="true"></span>
              <strong id="profileSyncSummary">Checking sync status…</strong>
            </div>
            <div class="ma-sync-detail" id="profileSyncDetail">Your current save status will appear here.</div>
            <div class="ma-sync-meta" id="profileSyncMeta">Last cloud sync: Never synced</div>
          </section>

          <section class="ma-card ma-card--soft ma-profile-card ma-progression-card" aria-label="Atlas Level and learning activity">
            <div class="ma-profile-card-head">
              <div>
                <div class="ma-menu-kicker">Account progression</div>
                <div class="ma-profile-card-title">Atlas Level <span id="profileAtlasLevel">1</span></div>
              </div>
              ${icon(href,'achievement','ma-icon--lg')}
            </div>
            <div class="ma-level-xp-line">
              <strong id="profileAtlasXp">0 XP</strong>
              <span id="profileAtlasXpNext">0 / 100 XP</span>
            </div>
            <div class="ma-level-progress" role="progressbar" aria-label="Atlas Level progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="profileAtlasProgress">
              <span id="profileAtlasXpBar"></span>
            </div>
            <div class="ma-level-activity" aria-label="Learning activity">
              <div><span>Reading</span><strong id="profileReadingCorrect">0</strong><small>correct kana</small></div>
              <div><span>Writing</span><strong id="profileWritingCorrect">0</strong><small>correct kana</small></div>
            </div>
            <div class="ma-progression-footer">
              <div class="ma-achievement-summary"><strong id="profileAchievementCount">0</strong><span>achievements</span></div>
              <button class="ma-button ma-button--ghost ma-button--small" type="button" data-ma-achievements-open>${icon(href,'achievement')}<span>Achievements</span></button>
            </div>
          </section>
        </aside>`;
    }
  };
})();
