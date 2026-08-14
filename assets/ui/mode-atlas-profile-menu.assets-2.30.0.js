(function ModeAtlasProfileMenuMarkup(){
  'use strict';
  if (window.ModeAtlasProfileMenu) return;

  window.ModeAtlasProfileMenu = {
    markup({ href }){
      return `
        <div class="ma-drawer-backdrop ma-profile-backdrop" id="profileBackdrop" data-ma-drawer-close="profile"></div>
        <aside class="ma-drawer ma-shared-profile-drawer" id="profileDrawer" data-ma-shared-drawer="profile" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="profileDrawerTitle">
          <div class="ma-drawer-head ma-profile-head">
            <div>
              <div class="ma-menu-kicker">Mode Atlas</div>
              <div class="ma-drawer-title" id="profileDrawerTitle">Profile</div>
            </div>
            <button class="ma-button ma-button--small ma-button--ghost ma-drawer-close" id="profileCloseBtn" type="button" data-ma-drawer-close="profile" aria-label="Close profile">Close</button>
          </div>

          <section class="ma-card ma-card--soft ma-profile-card ma-account-card" aria-label="Google account">
            <div class="ma-account-user">
              <img class="ma-account-avatar" id="profileAvatar" alt="" />
              <div>
                <div class="ma-account-name" id="profileName">Guest</div>
                <div class="ma-account-email" id="profileEmail">Not signed in</div>
              </div>
            </div>
            <div class="ma-auth-actions">
              <button class="ma-button ma-button--primary" id="profileSignInBtn" data-profile-sign-in type="button">Sign in with Google</button>
              <button class="ma-button" id="profileSignOutBtn" data-profile-sign-out type="button" hidden>Sign out</button>
            </div>
          </section>

          <section class="ma-card ma-card--soft ma-profile-card ma-sync-card" aria-label="Sync status">
            <div class="section-kicker">Sync status</div>
            <div class="ma-sync-status-line">
              <span class="ma-sync-dot" id="profileSyncDot" aria-hidden="true"></span>
              <strong id="profileSyncSummary">Checking sync status…</strong>
            </div>
            <div class="ma-sync-detail" id="profileSyncDetail">Your current save status will appear here.</div>
            <div class="ma-sync-meta" id="profileSyncMeta">Last cloud sync: Never synced</div>
          </section>

          <section class="ma-card ma-card--soft ma-profile-card ma-branch-card" aria-label="Branches">
            <div class="section-kicker">Branches</div>
            <div class="ma-branch-grid">
              <a class="ma-button ma-branch-button" href="${href('')}">Mode Atlas</a>
              <a class="ma-button ma-branch-button" href="${href('kana/')}">Kana Trainer</a>
              <a class="ma-button ma-branch-button" href="${href('wordbank/')}">Word Bank</a>
              <button class="ma-button ma-branch-button ma-placeholder" type="button" disabled>Listening</button>
              <button class="ma-button ma-branch-button ma-placeholder" type="button" disabled>Grammar</button>
              <button class="ma-button ma-branch-button ma-placeholder" type="button" disabled>Reading</button>
            </div>
          </section>

          <section class="ma-card ma-card--soft ma-profile-card ma-achievement-card-summary" aria-label="Achievements">
            <div class="section-kicker">Achievements</div>
            <div class="ma-achievement-summary"><strong id="profileAchievementCount">0</strong><span>unlocked milestones</span></div>
            <button class="ma-button ma-button--primary" type="button" data-ma-achievements-open>Open achievements</button>
          </section>
        </aside>`;
    }
  };
})();
