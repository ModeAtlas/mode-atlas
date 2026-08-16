from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')

def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return source.replace(old, new, 1)

# ---------------------------------------------------------------------------
# Kana HTML: calm orientation first, detailed progress second.
# ---------------------------------------------------------------------------
kana = read('kana/index.html')
start = kana.index('    <section class="kana-hub-hero')
end = kana.index('</div>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->', start)
content = '''    <section class="kana-hub-hero ma-page-hero" aria-labelledby="kanaHeroTitle">
        <div class="kana-hero-main">
            <div class="hero-tagline"><span aria-hidden="true">かな</span><span class="ma-kicker">Kana Trainer</span></div>
            <h1 id="kanaHeroTitle">Make kana feel automatic.</h1>
            <p class="kana-hero-lead">Build fast recognition in Reading, active recall in Writing, and use Results to keep each practice session focused.</p>
            <div class="kana-hero-actions ma-action-row">
                <a class="kana-primary-action ma-button" id="kanaContinueAction" href="/reading/"><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-play"></use></svg><span class="kana-primary-action__copy"><span>Continue practice</span><strong id="kanaContinueHint">Recommended next step</strong></span></a>
            </div>
        </div>
        <div class="kana-hero-visual" aria-hidden="true">
            <span class="kana-hero-glyph kana-hero-glyph--a">あ</span>
            <span class="kana-hero-glyph kana-hero-glyph--ka">カ</span>
            <span class="kana-hero-glyph kana-hero-glyph--yo">よ</span>
            <div class="kana-hero-script"><strong>ひらがな</strong><span>カタカナ</span></div>
        </div>
    </section>

    <section class="kana-pathways ma-page-section" aria-labelledby="kanaPracticeTitle">
        <header class="kana-pathways-head">
            <span class="ma-kicker">Practice areas</span>
            <h2 id="kanaPracticeTitle">Choose how you want to train.</h2>
            <p>Switch between recognition, recall, and detailed results without leaving Kana Trainer.</p>
        </header>
        <div class="kana-pathway-list">
            <a class="kana-pathway kana-pathway--reading" href="/reading/"><span class="ma-kicker">Recognise</span><strong>Reading</strong><p>See kana and recall the matching romaji quickly and accurately.</p><span class="kana-pathway__action">Start reading <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></a>
            <a class="kana-pathway kana-pathway--writing" href="/writing/"><span class="ma-kicker">Recall</span><strong>Writing</strong><p>See the romaji and choose or type the kana from memory.</p><span class="kana-pathway__action">Start writing <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></a>
            <a class="kana-pathway kana-pathway--results" href="/results/"><span class="ma-kicker">Understand</span><strong>Results</strong><p>Review formal tests, performance trends, and the kana that need more work.</p><span class="kana-pathway__action">View results <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></a>
        </div>
    </section>

    <main class="kana-hub ma-page-section" id="kanaHub">
        <header class="kana-progress-intro">
            <span class="ma-kicker">Your progress</span>
            <h2>Know where you stand. Know what to practise next.</h2>
            <p>Track recognition, recall, mastery, and the kana most worth your attention.</p>
        </header>

        <section class="kana-today-card kana-progress-overview" id="kanaTodayCard" aria-live="polite">
            <div class="ma-skeleton-text">Progress snapshot</div><div class="ma-skeleton-block"></div><div class="ma-skeleton-block"></div>
        </section>

        <section class="kana-section kana-next-panel" id="kanaNextPanel">
            <div class="ma-skeleton-block" aria-hidden="true"></div>
        </section>

        <section class="kana-section kana-mastery-panel">
            <div class="kana-section-head ma-section-head">
                <div>
                    <span class="kana-section-kicker ma-kicker">Mastery overview</span>
                    <h2>Kana mastery</h2>
                    <p>See how your kana are moving from first attempts to fast, reliable recall.</p>
                </div>
                <div class="kana-head-actions ma-action-row">
                    <button type="button" class="kana-ghost-action ma-button" data-ma-mastery-help>How mastery works</button>
                    <button type="button" class="kana-map-action ma-button" data-ma-mastery-open>Open Mastery Map</button>
                </div>
            </div>
            <div class="kana-mastery-grid" id="kanaMasteryGrid"><div class="ma-skeleton-block" aria-hidden="true"></div></div>
            <div class="kana-mastery-focus" id="kanaMasteryFocus"><div class="ma-skeleton-block" aria-hidden="true"></div></div>
        </section>

        <section class="kana-section kana-preset-panel" id="kanaPresetPanel"><div class="ma-skeleton-block" aria-hidden="true"></div></section>
        <section class="kana-section kana-records-panel" id="kanaRecordsPanel"><div class="ma-skeleton-block" aria-hidden="true"></div></section>
    </main>
'''
kana = kana[:start] + content + kana[end:]
write('kana/index.html', kana)

# ---------------------------------------------------------------------------
# Kana CSS: replace the accumulated card-heavy cascade with one canonical page
# composition. Shared components continue to own buttons, headers and dialogs.
# ---------------------------------------------------------------------------
css = r'''/* Kana Trainer hub page.
   Owns kana/index.html composition only. Shared navigation, controls, dialogs,
   theme tokens and responsive page-frame mechanics remain shared owners. */

body.ma-kana-page{
  margin:0;
  min-height:100vh;
  padding:0 24px 24px;
  overflow-x:hidden;
  color:var(--ma-text);
  background:var(--ma-page-bg-kana);
  font-family:var(--ma-font-ui,Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
}
body.ma-kana-page::before{
  content:"";
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  background-image:
    linear-gradient(var(--ma-grid-line) 1px,transparent 1px),
    linear-gradient(90deg,var(--ma-grid-line) 1px,transparent 1px);
  background-size:44px 44px;
  mask-image:radial-gradient(circle at 50% 20%,#000 0%,transparent 76%);
  opacity:.26;
}
.ma-kana-page .shell{
  width:min(var(--ma-content-max),100%);
  margin:0 auto;
  position:relative;
  z-index:1;
}

/* Calm top-level orientation. */
.kana-hub-hero{
  width:min(1180px,100%);
  margin:0 auto;
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(280px,.58fr);
  align-items:center;
  gap:clamp(44px,7vw,96px);
  padding:clamp(54px,8vw,102px) 0 clamp(48px,7vw,88px);
  border-bottom:1px solid var(--ma-border);
}
.kana-hero-main{min-width:0;max-width:760px;}
.hero-tagline{
  display:inline-flex;
  align-items:center;
  gap:10px;
  margin-bottom:18px;
  color:var(--ma-kana);
}
.hero-tagline>span:first-child{
  width:40px;
  height:40px;
  display:grid;
  place-items:center;
  border:1px solid color-mix(in srgb,var(--ma-kana) 42%,var(--ma-border));
  border-radius:14px;
  background:color-mix(in srgb,var(--ma-kana) 10%,var(--ma-card-3));
  color:var(--ma-text-strong);
  font-family:var(--ma-font-jp);
  font-size:.9rem;
  font-weight:900;
  letter-spacing:-.12em;
}
.kana-hero-main h1{
  max-width:9.5ch;
  margin:0;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(3.6rem,7vw,6.4rem);
  font-weight:860;
  line-height:.9;
  letter-spacing:-.07em;
  text-wrap:balance;
}
.kana-hero-lead{
  max-width:660px;
  margin:clamp(22px,3vw,30px) 0 0;
  color:var(--ma-text-soft);
  font-size:clamp(1.02rem,1.55vw,1.18rem);
  line-height:1.65;
}
.kana-hero-actions{--ma-action-gap:12px;margin-top:clamp(28px,4vw,40px);}
.kana-head-actions{--ma-action-gap:10px;}

.kana-primary-action,
.kana-action,
.kana-ghost-action,
.kana-map-action,
.kana-inline-btn{
  --ma-button-bg:var(--ma-control);
  --ma-button-bg-hover:var(--ma-control-hover);
  --ma-button-border:var(--ma-border);
  --ma-button-border-hover:var(--ma-border-strong);
  --ma-button-color:var(--ma-text);
  --ma-button-font-weight:850;
  gap:8px;
}
.kana-primary-action{
  --ma-button-min-height:58px;
  --ma-button-padding:11px 18px;
  --ma-button-radius:18px;
  --ma-button-border:color-mix(in srgb,var(--ma-kana) 44%,var(--ma-border));
  --ma-button-bg:linear-gradient(135deg,color-mix(in srgb,var(--ma-kana) 18%,var(--ma-card-2)),color-mix(in srgb,var(--ma-reading) 11%,var(--ma-card-3)));
  --ma-button-bg-hover:linear-gradient(135deg,color-mix(in srgb,var(--ma-kana) 25%,var(--ma-card-2)),color-mix(in srgb,var(--ma-reading) 16%,var(--ma-card-3)));
  justify-content:flex-start;
  min-width:min(100%,290px);
  text-align:left;
}
.kana-primary-action__copy{display:grid;gap:3px;min-width:0;}
.kana-primary-action__copy>span{font-weight:900;}
.kana-primary-action__copy strong{color:var(--ma-text-soft);font-size:.77rem;font-weight:700;}
.kana-ghost-action,.kana-map-action,.kana-inline-btn{--ma-button-min-height:40px;--ma-button-padding:8px 13px;}
.kana-map-action{--ma-button-border:color-mix(in srgb,var(--ma-kana) 34%,var(--ma-border));}
.kana-inline-btn[href*="reading"]{--ma-button-border:color-mix(in srgb,var(--ma-reading) 34%,var(--ma-border));}

.kana-hero-visual{
  position:relative;
  min-height:320px;
  isolation:isolate;
}
.kana-hero-visual::before{
  content:"";
  position:absolute;
  inset:7% 0 0 5%;
  z-index:-1;
  border-radius:50%;
  background:radial-gradient(circle,color-mix(in srgb,var(--ma-kana) 17%,transparent),transparent 66%);
  filter:blur(16px);
}
.kana-hero-script{
  position:absolute;
  inset:50% auto auto 50%;
  transform:translate(-50%,-50%);
  display:grid;
  gap:4px;
  text-align:center;
  white-space:nowrap;
}
.kana-hero-script strong,.kana-hero-script span{
  font-family:var(--ma-font-jp);
  font-weight:900;
  letter-spacing:.04em;
}
.kana-hero-script strong{color:var(--ma-text-strong);font-size:clamp(2.6rem,5vw,4.5rem);}
.kana-hero-script span{color:var(--ma-muted);font-size:clamp(1.4rem,2.6vw,2.2rem);}
.kana-hero-glyph{
  position:absolute;
  display:grid;
  place-items:center;
  border:1px solid var(--ma-border);
  border-radius:50%;
  background:color-mix(in srgb,var(--ma-card-2) 72%,transparent);
  color:var(--ma-text-soft);
  font-family:var(--ma-font-jp);
  font-weight:900;
  box-shadow:var(--ma-shadow-soft);
  backdrop-filter:blur(8px);
}
.kana-hero-glyph--a{left:2%;top:15%;width:78px;height:78px;font-size:2rem;border-color:color-mix(in srgb,var(--ma-reading) 38%,var(--ma-border));}
.kana-hero-glyph--ka{right:2%;top:9%;width:94px;height:94px;font-size:2.4rem;border-color:color-mix(in srgb,var(--ma-writing) 38%,var(--ma-border));}
.kana-hero-glyph--yo{right:10%;bottom:5%;width:70px;height:70px;font-size:1.8rem;border-color:color-mix(in srgb,var(--ma-results) 36%,var(--ma-border));}

/* Practice destinations are navigation, not dashboard cards. */
.kana-pathways{
  width:min(1180px,100%);
  margin:0 auto;
  padding:clamp(50px,7vw,88px) 0 clamp(58px,8vw,104px);
}
.kana-pathways-head{max-width:720px;margin-bottom:clamp(30px,4vw,44px);}
.kana-pathways-head .ma-kicker{--ma-kicker-color:var(--ma-kana);}
.kana-pathways-head h2,.kana-progress-intro h2{
  margin:8px 0 0;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(2.25rem,4.5vw,4rem);
  font-weight:850;
  letter-spacing:-.055em;
  line-height:.98;
}
.kana-pathways-head p,.kana-progress-intro p{max-width:650px;margin:16px 0 0;color:var(--ma-muted);line-height:1.65;}
.kana-pathway-list{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  border-block:1px solid var(--ma-border);
}
.kana-pathway{
  position:relative;
  min-width:0;
  min-height:236px;
  display:flex;
  flex-direction:column;
  padding:clamp(24px,3vw,34px);
  border-right:1px solid var(--ma-border);
  color:inherit;
  text-decoration:none;
  transition:background var(--ma-motion-fast) ease;
}
.kana-pathway:last-child{border-right:0;}
.kana-pathway::before{content:"";position:absolute;left:clamp(24px,3vw,34px);top:0;width:42px;height:2px;background:var(--ma-kana);}
.kana-pathway--reading::before{background:var(--ma-reading);}.kana-pathway--writing::before{background:var(--ma-writing);}.kana-pathway--results::before{background:var(--ma-results);}
.kana-pathway:hover{background:color-mix(in srgb,var(--ma-card-2) 34%,transparent);}
.kana-pathway:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:-3px;}
.kana-pathway strong{margin-top:12px;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.8rem,3vw,2.55rem);letter-spacing:-.045em;line-height:1;}
.kana-pathway p{max-width:330px;margin:14px 0 28px;color:var(--ma-muted);line-height:1.55;}
.kana-pathway__action{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--ma-text-soft);font-size:.86rem;font-weight:850;}
.kana-pathway__action .ma-icon{width:18px;height:18px;}

/* Progress area: more numerical, but still one clear hierarchy. */
.kana-hub{width:min(1180px,100%);margin:0 auto;display:grid;gap:0;}
.kana-progress-intro{max-width:800px;padding:clamp(56px,7vw,88px) 0 clamp(28px,4vw,40px);}
.kana-progress-intro .ma-kicker{--ma-kicker-color:var(--ma-kana);}
.kana-progress-overview{
  display:grid;
  grid-template-columns:minmax(220px,.8fr) minmax(300px,1.1fr) minmax(260px,.9fr);
  gap:clamp(26px,4vw,54px);
  align-items:center;
  padding:clamp(26px,4vw,38px) 0;
  border-block:1px solid var(--ma-border);
}
.kana-progress-summary{min-width:0;}
.kana-card-kicker,.kana-section-kicker,.kana-next-card>span,.kana-stage-card>span,.kana-focus-card>span,.kana-record-card>span{
  --ma-kicker-color:var(--ma-muted);
  --ma-kicker-weight:900;
  --ma-kicker-spacing:.11em;
  --ma-kicker-size:.72rem;
}
.kana-progress-summary h3{margin:8px 0 0;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.8rem,3vw,2.65rem);letter-spacing:-.045em;line-height:1;}
.kana-progress-summary p{margin:12px 0 0;color:var(--ma-muted);font-size:.92rem;line-height:1.55;}
.kana-hero-map{display:grid;gap:13px;}
.kana-map-row{display:grid;grid-template-columns:78px 1fr 44px;gap:12px;align-items:center;color:var(--ma-muted);font-size:.78rem;font-weight:850;}
.kana-map-row i,.kana-stage-card i,.kana-preset-card i{display:block;height:8px;border:1px solid var(--ma-border);border-radius:999px;background:color-mix(in srgb,var(--ma-border) 62%,transparent);overflow:hidden;}
.kana-map-row i b,.kana-stage-card i b,.kana-preset-card i b{display:block;width:var(--ma-progress,0%);height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--ma-reading),var(--ma-writing));}
.kana-map-row em{color:var(--ma-text-strong);font-style:normal;text-align:right;font-variant-numeric:tabular-nums;}
.kana-hero-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:1px solid var(--ma-border);}
.kana-hero-mini>div{min-width:0;padding:10px 16px;border-right:1px solid var(--ma-border);}
.kana-hero-mini>div:last-child{border-right:0;}
.kana-hero-mini strong,.kana-hero-mini span{display:block;}
.kana-hero-mini strong{color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.55rem,2.7vw,2.25rem);font-variant-numeric:tabular-nums;line-height:1;}
.kana-hero-mini span{margin-top:7px;color:var(--ma-muted);font-size:.72rem;line-height:1.25;}

.kana-section{padding:clamp(54px,7vw,82px) 0;border-bottom:1px solid var(--ma-border);}
.kana-section-head{--ma-section-head-gap:20px;margin-bottom:clamp(24px,4vw,36px);}
.kana-section-head.compact{margin-bottom:clamp(22px,3vw,30px);}
.kana-section-head h2{margin:6px 0 0;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(2rem,3.7vw,3.25rem);letter-spacing:-.05em;line-height:1;}
.kana-section-head p{max-width:680px;margin:10px 0 0;color:var(--ma-muted);line-height:1.55;}

/* Recommendation: one strong surface, supporting information stays open. */
.kana-next-grid{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(230px,.72fr) minmax(230px,.72fr);gap:0;align-items:stretch;}
.kana-next-card{min-width:0;display:flex;flex-direction:column;gap:11px;padding:22px 24px;color:inherit;}
a.kana-next-card{text-decoration:none;}
.kana-next-card--recommended{
  min-height:210px;
  justify-content:space-between;
  margin-right:clamp(22px,3vw,34px);
  border:1px solid color-mix(in srgb,var(--ma-reading) 34%,var(--ma-border));
  border-radius:var(--ma-radius-lg);
  background:radial-gradient(circle at 12% 0%,color-mix(in srgb,var(--ma-reading) 14%,transparent),transparent 44%),var(--ma-surface-soft);
  box-shadow:var(--ma-shadow-soft);
  transition:transform var(--ma-motion-fast) ease,border-color var(--ma-motion-fast) ease,box-shadow var(--ma-motion-fast) ease;
}
.kana-next-card--recommended.writing{border-color:color-mix(in srgb,var(--ma-writing) 34%,var(--ma-border));background:radial-gradient(circle at 12% 0%,color-mix(in srgb,var(--ma-writing) 14%,transparent),transparent 44%),var(--ma-surface-soft);}
.kana-next-card--recommended:hover{transform:translateY(-2px);box-shadow:var(--ma-shadow);border-color:var(--ma-border-strong);}
.kana-next-card--secondary{justify-content:flex-start;border-left:1px solid var(--ma-border);}
.kana-next-card strong{color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.4rem,2.2vw,2rem);letter-spacing:-.04em;line-height:1.08;}
.kana-next-card p{margin:0;color:var(--ma-muted);font-size:.92rem;line-height:1.5;}
.kana-next-card em{margin-top:auto;color:var(--ma-reading);font-size:.88rem;font-style:normal;font-weight:900;}
.kana-focus-kana{font-family:var(--ma-font-jp);word-break:keep-all;overflow-wrap:anywhere;}
.kana-inline-btn{align-self:flex-start;margin-top:auto;}
.kana-dual-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.kana-dual-status>div{padding:10px;border:1px solid var(--ma-border);border-radius:14px;background:var(--ma-surface-inset);}
.kana-dual-status>div.done{border-color:color-mix(in srgb,var(--ma-success) 28%,var(--ma-border));background:var(--ma-status-success-bg);}
.kana-dual-status b,.kana-dual-status strong{display:block;}.kana-dual-status b{color:var(--ma-muted);font-size:.7rem;letter-spacing:.09em;text-transform:uppercase;}.kana-dual-status strong{margin-top:3px;color:var(--ma-text-strong);font-size:1rem;}

/* Mastery uses one shared matrix rather than four nested cards. */
.kana-mastery-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;border:1px solid var(--ma-border);border-radius:var(--ma-radius-lg);background:color-mix(in srgb,var(--ma-card-3) 44%,transparent);}
.kana-stage-card{
  position:relative;
  min-width:0;
  appearance:none;
  display:grid;
  gap:9px;
  padding:22px;
  border:0;
  border-right:1px solid var(--ma-border);
  background:transparent;
  color:inherit;
  font:inherit;
  text-align:left;
  cursor:pointer;
  transition:background var(--ma-motion-fast) ease;
}
.kana-stage-card:last-child{border-right:0;}
.kana-stage-card:hover{background:color-mix(in srgb,var(--ma-card-2) 58%,transparent);}
.kana-stage-card:focus-visible{z-index:1;outline:3px solid var(--ma-focus-ring);outline-offset:-3px;}
.kana-stage-card::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--ma-border-strong);}
.kana-stage-card.learning::before{background:var(--ma-warning);}.kana-stage-card.reviewing::before{background:var(--ma-writing);}.kana-stage-card.mastered::before{background:var(--ma-success);}
.kana-stage-card strong{color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(2rem,3.5vw,3.1rem);letter-spacing:-.055em;line-height:.95;font-variant-numeric:tabular-nums;}
.kana-stage-card p{min-height:2.6em;margin:0;color:var(--ma-muted);font-size:.84rem;line-height:1.35;}
.kana-mastery-focus{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(180px,.7fr) minmax(0,1.35fr);margin-top:24px;border-top:1px solid var(--ma-border);}
.kana-focus-card{min-width:0;padding:22px 24px;border-right:1px solid var(--ma-border);}
.kana-focus-card:last-child{border-right:0;}
.kana-focus-card strong,.kana-record-card strong{display:block;margin-top:8px;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.25rem,1.8vw,1.7rem);letter-spacing:-.035em;line-height:1.14;}
.kana-focus-card p,.kana-record-card p{margin:9px 0 0;color:var(--ma-muted);font-size:.9rem;line-height:1.45;}

/* Preset achievement progression: one matrix, four milestones. */
.kana-preset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;border:1px solid var(--ma-border);border-radius:var(--ma-radius-lg);}
.kana-preset-card{min-width:0;padding:20px;border-right:1px solid var(--ma-border);background:color-mix(in srgb,var(--ma-card-3) 36%,transparent);}
.kana-preset-card:last-child{border-right:0;}.kana-preset-card.done{background:color-mix(in srgb,var(--ma-success) 6%,var(--ma-card-3));}
.kana-preset-card>div{display:flex;align-items:baseline;justify-content:space-between;gap:12px;}
.kana-preset-card strong{color:var(--ma-text-strong);font-size:.95rem;}.kana-preset-card>div>span{color:var(--ma-text-strong);font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap;}
.kana-preset-card p{min-height:2.4em;margin:11px 0 16px;color:var(--ma-muted);font-size:.76rem;font-weight:850;letter-spacing:.07em;line-height:1.25;text-transform:uppercase;}
.kana-preset-card em{display:block;margin-top:10px;color:var(--ma-muted);font-size:.72rem;font-style:normal;font-weight:900;letter-spacing:.08em;text-transform:uppercase;}
.kana-preset-card.done em{color:var(--ma-success);}

/* Performance: two deliberate accuracy surfaces beside a compact records table. */
.kana-record-layout{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);gap:clamp(24px,4vw,42px);align-items:start;}
.kana-accuracy-pair{display:grid;gap:14px;}
.kana-accuracy-card{display:grid;grid-template-columns:112px minmax(0,1fr);align-items:center;gap:22px;min-height:150px;padding:20px;border:1px solid var(--ma-border);border-radius:var(--ma-radius-lg);background:var(--ma-surface-inset);}
.kana-accuracy-card.reading{border-color:color-mix(in srgb,var(--ma-reading) 24%,var(--ma-border));}.kana-accuracy-card.writing{border-color:color-mix(in srgb,var(--ma-writing) 24%,var(--ma-border));}
.kana-ring{--pct:0;--ring-color:var(--ma-reading);width:106px;height:106px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,var(--ma-card-3) 0 55%,transparent 56%),conic-gradient(var(--ring-color) calc(var(--pct)*1%),var(--ma-border) 0);}
.kana-ring strong,.kana-ring span{grid-area:1/1;text-align:center;}.kana-ring strong{transform:translateY(-7px);color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:1.7rem;letter-spacing:-.04em;}.kana-ring span{transform:translateY(18px);color:var(--ma-muted);font-size:.58rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase;}
.kana-accuracy-card h3{margin:0 0 11px;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.35rem,2.2vw,1.9rem);}
.kana-mini-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}.kana-mini-grid>div{padding:9px 11px;border-left:1px solid var(--ma-border);}.kana-mini-grid span,.kana-mini-grid strong{display:block;}.kana-mini-grid span{color:var(--ma-muted);font-size:.72rem;}.kana-mini-grid strong{margin-top:3px;color:var(--ma-text-strong);font-size:1.12rem;font-variant-numeric:tabular-nums;}
.kana-record-side{overflow:hidden;border:1px solid var(--ma-border);border-radius:var(--ma-radius-lg);background:color-mix(in srgb,var(--ma-card-3) 38%,transparent);}
.kana-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}
.kana-record-card{min-width:0;min-height:116px;padding:18px;border-right:1px solid var(--ma-border);border-bottom:1px solid var(--ma-border);}
.kana-record-card:nth-child(2n){border-right:0;}.kana-record-card:nth-last-child(-n+2){border-bottom:0;}
.kana-record-card span,.kana-record-card em{display:block;}.kana-record-card em{margin-top:7px;color:var(--ma-muted);font-size:.78rem;font-style:normal;line-height:1.35;}
.kana-record-card.total{min-height:0;border-top:1px solid var(--ma-border);border-right:0;border-bottom:0;background:color-mix(in srgb,var(--ma-success) 5%,transparent);}

/* Feature-dialog content only; the shared dialog module owns the shell. */
.kana-modal-body{display:grid;gap:16px;}
.kana-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.kana-modal-grid>div,.kana-daily-modal-card{padding:16px;border:1px solid var(--ma-border);border-radius:var(--ma-radius-card);background:var(--ma-surface-inset);}
.kana-modal-grid p{margin:8px 0 0;color:var(--ma-muted);line-height:1.5;}
.kana-daily-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
.kana-daily-modal-card h3{margin-top:0;color:var(--ma-text-strong);}
.kana-daily-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0;}
.kana-daily-summary>div,.kana-daily-history>div{padding:10px;border:1px solid var(--ma-border);border-radius:14px;background:color-mix(in srgb,var(--ma-card-3) 52%,transparent);}
.kana-daily-summary span,.kana-daily-history span,.kana-daily-history em{display:block;color:var(--ma-muted);}
.kana-daily-summary strong{display:block;margin-top:3px;color:var(--ma-text-strong);}
.kana-daily-history{display:grid;gap:8px;}.kana-daily-history>div{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;}.kana-daily-history em{grid-column:1/-1;font-style:normal;font-size:.8rem;}.kana-daily-history p{color:var(--ma-muted);}
.footer-note{margin-top:18px;color:var(--ma-muted);font-size:.8rem;text-align:center;}

@media(max-width:1040px){
  .kana-hub-hero{grid-template-columns:minmax(0,1fr) minmax(240px,.48fr);gap:38px;}
  .kana-progress-overview{grid-template-columns:1fr 1.2fr;}.kana-hero-mini{grid-column:1/-1;border-left:0;border-top:1px solid var(--ma-border);padding-top:18px;}
  .kana-next-grid{grid-template-columns:1fr 1fr;}.kana-next-card--recommended{grid-column:1/-1;margin-right:0;}.kana-next-card--secondary:nth-child(2){border-left:0;}
  .kana-mastery-focus{grid-template-columns:1fr 1fr;}.kana-focus-card:nth-child(2){border-right:0;}.kana-focus-card:last-child{grid-column:1/-1;border-top:1px solid var(--ma-border);}
  .kana-record-layout{grid-template-columns:1fr;}.kana-accuracy-pair{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media(max-width:820px){
  .kana-hub-hero{grid-template-columns:1fr;padding-top:44px;}.kana-hero-main h1{max-width:11ch;}.kana-hero-visual{min-height:240px;max-width:520px;width:100%;margin-inline:auto;}
  .kana-pathway-list{grid-template-columns:1fr;}.kana-pathway{min-height:0;border-right:0;border-bottom:1px solid var(--ma-border);}.kana-pathway:last-child{border-bottom:0;}.kana-pathway p{max-width:560px;}
  .kana-mastery-grid,.kana-preset-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.kana-stage-card:nth-child(2),.kana-preset-card:nth-child(2){border-right:0;}.kana-stage-card:nth-child(-n+2),.kana-preset-card:nth-child(-n+2){border-bottom:1px solid var(--ma-border);}
  .kana-accuracy-pair{grid-template-columns:1fr;}
}
@media(max-width:620px){
  body.ma-kana-page{padding-left:var(--ma-page-gutter-phone);padding-right:var(--ma-page-gutter-phone);}
  .kana-hub-hero{padding-block:34px 48px;}.kana-hero-main h1{font-size:clamp(3rem,16vw,4.8rem);}.kana-hero-lead{font-size:.98rem;}.kana-primary-action{width:100%;}
  .kana-hero-visual{min-height:205px;}.kana-hero-glyph--a{width:60px;height:60px;font-size:1.5rem}.kana-hero-glyph--ka{width:70px;height:70px;font-size:1.8rem}.kana-hero-glyph--yo{width:54px;height:54px;font-size:1.35rem}
  .kana-pathways{padding-block:42px 54px;}.kana-pathway{padding:24px 4px;}.kana-pathway::before{left:4px;}
  .kana-progress-intro{padding-top:48px;}.kana-progress-overview{grid-template-columns:1fr;gap:24px;}.kana-hero-mini{grid-column:auto;grid-template-columns:1fr;border-top:0;}.kana-hero-mini>div{border-right:0;border-bottom:1px solid var(--ma-border);padding:10px 0;}.kana-hero-mini>div:last-child{border-bottom:0;}
  .kana-section{padding-block:48px;}.kana-section-head{align-items:flex-start;flex-direction:column;}.kana-head-actions{width:100%;}.kana-head-actions .ma-button{flex:1 1 auto;}
  .kana-next-grid{grid-template-columns:1fr;}.kana-next-card{padding-inline:0;}.kana-next-card--recommended{padding:20px;margin:0;}.kana-next-card--secondary{border-left:0;border-top:1px solid var(--ma-border);}
  .kana-mastery-grid,.kana-preset-grid{grid-template-columns:1fr;}.kana-stage-card,.kana-preset-card{border-right:0;border-bottom:1px solid var(--ma-border)!important;}.kana-stage-card:last-child,.kana-preset-card:last-child{border-bottom:0!important;}
  .kana-mastery-focus{grid-template-columns:1fr;}.kana-focus-card{border-right:0;border-bottom:1px solid var(--ma-border);padding-inline:0;}.kana-focus-card:nth-child(2){border-right:0;}.kana-focus-card:last-child{grid-column:auto;border-top:0;border-bottom:0;}
  .kana-accuracy-card{grid-template-columns:94px minmax(0,1fr);gap:16px;padding:16px;}.kana-ring{width:90px;height:90px;}.kana-ring strong{font-size:1.45rem;}
  .kana-record-grid{grid-template-columns:1fr;}.kana-record-card,.kana-record-card:nth-child(2n),.kana-record-card:nth-last-child(-n+2){border-right:0;border-bottom:1px solid var(--ma-border);}.kana-record-card:last-child{border-bottom:0;}
  .kana-modal-grid,.kana-daily-modal-grid,.kana-daily-summary{grid-template-columns:1fr;}
}
@media(max-width:430px){
  .kana-hero-visual{min-height:180px;}.kana-hero-script strong{font-size:2.5rem;}.kana-hero-script span{font-size:1.35rem;}.kana-hero-glyph--yo{display:none;}
  .kana-map-row{grid-template-columns:70px 1fr 38px;gap:8px;}.kana-head-actions{flex-direction:column;}.kana-head-actions .ma-button{width:100%;}
  .kana-accuracy-card{grid-template-columns:1fr;text-align:center;}.kana-ring{justify-self:center;}.kana-mini-grid{text-align:left;}
}
@media(prefers-reduced-motion:reduce){.kana-pathway,.kana-next-card--recommended,.kana-stage-card{transition:none;}}
'''
write('assets/css/mode-atlas-kana-page.css', css)

# ---------------------------------------------------------------------------
# Kana rendering: preserve metrics/recommendation algorithms; change only UI
# grouping, copy, and presentation classes so data is not nested in card walls.
# ---------------------------------------------------------------------------
js = read('assets/pages/mode-atlas-kana-page.js')
old = '''        card.replaceChildren(\n            kanaEl('span','kana-card-kicker ma-kicker','Progress map'),\n            kanaEl('h2','',`${mastery.seen}/${mastery.total} kana seen`),\n            kanaEl('p','','A quick visual check-in before you jump back into practice.'),\n            map,\n            mini\n        );'''
new = '''        const summary = kanaEl('div','kana-progress-summary');\n        summary.append(\n            kanaEl('span','kana-card-kicker ma-kicker','Coverage'),\n            kanaEl('h3','',`${mastery.seen}/${mastery.total} kana seen`),\n            kanaEl('p','','See how much of the kana set you have reached and how much is becoming reliable.')\n        );\n        card.replaceChildren(summary, map, mini);'''
js = replace_once(js, old, new, 'progress overview render')
js = replace_once(js, "kanaEl('p','','A simple place to start, with daily review and weak-kana focus close by.')", "kanaEl('p','','Your recommendation, daily challenges, and weakest kana together for a quick decision.')", 'next panel copy')
js = replace_once(js, "const guide = kanaButton('kana-ghost-action ma-button','How to use this hub');", "const guide = kanaButton('kana-ghost-action ma-button','What should I practise?');", 'next panel guide label')
js = replace_once(js, "const recommended = kanaLink(`kana-next-card primary ma-card ma-card--flat ma-card--interactive ${action.kind}`, '', action.href);", "const recommended = kanaLink(`kana-next-card kana-next-card--recommended primary ${action.kind}`, '', action.href);", 'recommended class')
js = replace_once(js, "const daily = kanaEl('div','kana-next-card compact ma-card ma-card--flat');", "const daily = kanaEl('div','kana-next-card kana-next-card--secondary compact');", 'daily class')
js = replace_once(js, "const focus = kanaEl('div','kana-next-card compact ma-card ma-card--flat');", "const focus = kanaEl('div','kana-next-card kana-next-card--secondary compact');", 'focus class')
js = replace_once(js, "const button = kanaButton(`kana-stage-card ma-card ma-card--flat ma-card--interactive ${stage.toLowerCase()}`);", "const button = kanaButton(`kana-stage-card ${stage.toLowerCase()}`);", 'stage class')
js = replace_once(js, "const focusNow = kanaEl('div','kana-focus-card ma-card ma-card--flat');", "const focusNow = kanaEl('div','kana-focus-card');", 'focus now class')
js = replace_once(js, "const avg = kanaEl('div','kana-focus-card ma-card ma-card--flat');", "const avg = kanaEl('div','kana-focus-card');", 'average focus class')
js = replace_once(js, "const slowest = kanaEl('div','kana-focus-card ma-card ma-card--flat');", "const slowest = kanaEl('div','kana-focus-card');", 'slowest focus class')
js = replace_once(js, "const card = kanaEl('article', `kana-preset-card ma-card ma-card--flat ${item.done ? 'done' : ''}`.trim());", "const card = kanaEl('article', `kana-preset-card ${item.done ? 'done' : ''}`.trim());", 'preset class')
js = replace_once(js, "const card = kanaEl('article','kana-record-card ma-card ma-card--flat');", "const card = kanaEl('article','kana-record-card');", 'record class')
js = replace_once(js, "const totalCard = kanaEl('article','kana-record-card total ma-card ma-card--flat');", "const totalCard = kanaEl('article','kana-record-card total');", 'total record class')
js = replace_once(js, "const card = kanaEl('article', `kana-accuracy-card ma-card ma-card--flat ${mode}`);", "const card = kanaEl('article', `kana-accuracy-card ${mode}`);", 'accuracy class')
js = replace_once(js, "heading.title = 'How to use the Kana hub';", "heading.title = 'Choosing your next practice';", 'guide modal title')
js = replace_once(js, "['1. Start with the recommendation', 'The hub chooses review, writing, new kana, or testing based on your saved progress.'],\n            ['2. Check mastery stages', 'New, Learning, Reviewing, and Mastered show where your kana currently sit.'],\n            ['3. Use details only when needed', 'Daily history and the full Mastery Map are in popups so the main page stays clear.']", "['Follow the recommendation', 'Start with the practice that best matches your saved accuracy, speed, and repetition history.'],\n            ['Keep daily challenges moving', 'Reading and Writing daily challenges give you a simple way to keep both recognition and recall active.'],\n            ['Use mastery to target weak spots', 'Mastery stages and the Mastery Map show which kana need more repetitions, accuracy, or speed.']", 'guide modal copy')
write('assets/pages/mode-atlas-kana-page.js', js)

# ---------------------------------------------------------------------------
# Regression contract migration + 2.36 coverage.
# ---------------------------------------------------------------------------
tests = read('tests/frontend.test.js')
tests = replace_once(tests, "  assert.match(kanaJs, /kana-next-card primary ma-card ma-card--flat ma-card--interactive/);\n  assert.match(kanaJs, /kana-stage-card ma-card ma-card--flat ma-card--interactive/);\n  assert.match(kanaJs, /kana-record-card ma-card ma-card--flat/);", "  assert.match(kanaJs, /kana-next-card kana-next-card--recommended primary/);\n  assert.match(kanaJs, /kana-stage-card/);\n  assert.match(kanaJs, /kana-record-card/);\n  assert.doesNotMatch(kanaJs, /kana-next-card[^'\"]*ma-card|kana-stage-card[^'\"]*ma-card|kana-record-card[^'\"]*ma-card/,\n    'Kana progress presentation should not recreate the retired nested card wall');", 'Kana primitive test contract')
append = r'''

test('2.36 Kana hub keeps orientation calm and moves detailed progress below practice navigation', () => {
  const kana = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');
  const heroEnd = kana.indexOf('</section>', kana.indexOf('class="kana-hub-hero'));
  const hero = kana.slice(kana.indexOf('class="kana-hub-hero'), heroEnd);

  assert.match(kana, /class="kana-hub-hero ma-page-hero"/);
  assert.doesNotMatch(kana, /kana-hub-hero[^\n]*ma-card/);
  assert.match(kana, /class="kana-pathway-list"/);
  assert.equal(count(kana, /class="kana-pathway kana-pathway--/g), 3);
  assert.ok(kana.indexOf('kana-pathways') < kana.indexOf('kana-progress-intro'));
  assert.match(kana, /class="kana-today-card kana-progress-overview"/);
  assert.doesNotMatch(kana, /kana-(?:next|mastery|preset|records)-panel[^\n]*ma-card/);
  assert.doesNotMatch(hero, /accuracy|mastered|streak|daily challenge|total answers/i);

  assert.match(kanaJs, /const summary = kanaEl\('div','kana-progress-summary'\)/);
  assert.match(kanaJs, /recommendedAction\(summaries, mastery\)/);
  assert.match(kanaJs, /kana-next-card kana-next-card--recommended primary/);
  assert.doesNotMatch(kanaJs, /kana-stage-card ma-card|kana-preset-card ma-card|kana-accuracy-card ma-card/);

  assert.match(kanaCss, /\.kana-hub-hero\{[\s\S]*?border-bottom:1px solid var\(--ma-border\)/);
  assert.match(kanaCss, /\.kana-pathway-list\{[\s\S]*?border-block:1px solid var\(--ma-border\)/);
  assert.match(kanaCss, /\.kana-progress-overview\{[\s\S]*?grid-template-columns:/);
  assert.match(kanaCss, /\.kana-mastery-grid\{[\s\S]*?border:1px solid var\(--ma-border\)/);
  assert.match(kanaCss, /\.kana-preset-grid\{[\s\S]*?border:1px solid var\(--ma-border\)/);
});
'''
if "2.36 Kana hub keeps orientation calm" in tests:
    raise RuntimeError('2.36 test already present')
tests += append
write('tests/frontend.test.js', tests)

# ---------------------------------------------------------------------------
# Release metadata.
# ---------------------------------------------------------------------------
version = read('assets/app/mode-atlas-version.js')
version = replace_once(version, "var VERSION = '2.35.0';", "var VERSION = '2.36.0';", 'VERSION')
version = replace_once(version, "var CACHE_REVISION = 'assets-2.35.0';", "var CACHE_REVISION = 'assets-2.36.0';", 'CACHE_REVISION')
write('assets/app/mode-atlas-version.js', version)

readme = read('README.md')
readme = replace_once(readme, 'Version: 2.35.0', 'Version: 2.36.0', 'README version')
write('README.md', readme)

for rel in ['package.json', 'package-lock.json']:
    text = read(rel)
    if '2.35.0' not in text:
        raise RuntimeError(f'{rel}: 2.35.0 missing')
    write(rel, text.replace('2.35.0', '2.36.0'))

changelog = read('CHANGELOG.md')
entry = '''## 2.36.0 - 2026-08-16
- Refined Kana Trainer into a clearer sub-homepage: a calm, action-first introduction now leads into practice destinations before any progress data appears.
- Replaced the three large pathway cards with a lighter Reading / Writing / Results navigation band so the top of Kana has more breathing room while keeping each destination distinct.
- Reorganized progress into a dedicated numerical layer for coverage, recommendation, Daily Challenge state, weak kana, mastery, presets, accuracy, records, and total practice volume.
- Removed nested page-specific card ownership from Kana progress rendering and replaced it with shared matrices, separators, and a smaller number of purposeful surfaces rather than hiding the old card wall with overrides.
- Preserved Kana metrics, mastery thresholds, recommendation rules, Daily Challenge behaviour, preset calculations, Results links, save schemas, storage, and cloud-sync behaviour.

'''
if changelog.startswith('## 2.36.0'):
    raise RuntimeError('changelog already updated')
write('CHANGELOG.md', entry + changelog)
