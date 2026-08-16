from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel,text): (ROOT/rel).write_text(text,encoding='utf-8')

def replace_once(src,old,new,label):
    count=src.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old,new,1)

index=read('index.html')
main='''  <main class="shell ma-page-frame atlas-home">
    <section class="atlas-hero ma-page-hero" aria-labelledby="atlasHeroTitle">
      <div class="atlas-hero__stage">
        <div class="atlas-hero__copy">
          <div data-ma-home-visitor>
            <div class="atlas-eyebrow ma-kicker">Japanese learning, one skill at a time</div>
            <h1 id="atlasHeroTitle">Build Japanese skills that stick.</h1>
            <p class="atlas-hero__lead">Practise kana, keep useful vocabulary close, and move into new areas of Japanese with focused tools that give each skill room to breathe.</p>
            <div class="atlas-hero__actions ma-action-row">
              <a class="ma-button ma-button--primary atlas-primary-action" href="/kana/" data-ma-branch-entry><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg><span>Start with Kana Trainer</span></a>
              <a class="atlas-text-link" href="#branches">Explore learning tools <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div data-ma-home-user hidden>
            <div class="atlas-eyebrow ma-kicker">Welcome back</div>
            <h1 id="atlasReturningTitle">Pick up where you left off.</h1>
            <p class="atlas-hero__lead">Continue your last session or choose another part of Japanese to work on today.</p>
            <div class="home-continue" id="homeContinueCard" aria-live="polite">
              <div class="home-continue__copy"><span class="ma-kicker">Continue studying</span><strong id="homeContinueTitle">Kana Reading</strong><span id="homeContinueMeta">Ready when you are</span></div>
              <a class="ma-button ma-button--primary home-continue__action" id="homeContinueAction" href="/reading/" data-ma-branch-entry><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-play"></use></svg><span>Continue</span></a>
            </div>
            <a class="atlas-text-link atlas-text-link--returning" href="#branches">Choose something else <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <div class="atlas-showcase" aria-label="A preview of Mode Atlas learning tools">
          <div class="atlas-showcase__glow" aria-hidden="true"></div>
          <div class="atlas-preview atlas-preview--reading" aria-hidden="true">
            <div class="atlas-preview__top"><span>Reading Practice</span><span class="atlas-preview__dot"></span></div>
            <div class="atlas-preview__prompt">あ</div>
            <div class="atlas-preview__answer">a</div>
            <div class="atlas-preview__caption">Recognise kana at a glance</div>
          </div>
          <div class="atlas-preview atlas-preview--words" aria-hidden="true">
            <div class="atlas-preview__top"><span>Word Bank</span><span>語</span></div>
            <div class="atlas-word-preview"><strong>日本</strong><span>にほん · Japan</span></div>
            <div class="atlas-word-preview"><strong>水</strong><span>みず · water</span></div>
            <div class="atlas-word-preview"><strong>友達</strong><span>ともだち · friend</span></div>
          </div>
          <div class="atlas-preview atlas-preview--writing" aria-hidden="true">
            <div class="atlas-preview__top"><span>Writing Practice</span><span>書</span></div>
            <div class="atlas-writing-preview"><span>shi</span><div><b>し</b><b>つ</b><b>そ</b><b>ん</b></div></div>
          </div>
        </div>
      </div>
    </section>

    <section class="atlas-tools ma-page-section" id="branches" aria-labelledby="atlasToolsTitle">
      <div class="atlas-section-intro">
        <div class="section-kicker">Start where you are</div>
        <h2 id="atlasToolsTitle">Focused tools for the skill in front of you.</h2>
        <p>Choose one area, give it your attention, and come back whenever you are ready for the next.</p>
      </div>

      <article class="atlas-product atlas-product--kana">
        <div class="atlas-product__copy">
          <div class="atlas-product__meta"><span>Kana Trainer</span><span class="atlas-availability">Available</span></div>
          <h3>Make hiragana and katakana feel automatic.</h3>
          <p>Build recognition in Reading, strengthen recall in Writing, then use Results to see where your next practice session will matter most.</p>
          <a class="ma-button ma-button--primary atlas-product__action" href="/kana/" data-ma-branch-entry>Open Kana Trainer <svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></a>
        </div>
        <div class="atlas-product__visual atlas-kana-visual" aria-hidden="true">
          <div class="atlas-mode-card atlas-mode-card--reading"><span>読</span><div><strong>Reading</strong><small>Recognise kana quickly</small></div></div>
          <div class="atlas-mode-card atlas-mode-card--writing"><span>書</span><div><strong>Writing</strong><small>Recall the right kana</small></div></div>
          <div class="atlas-mode-card atlas-mode-card--results"><span>測</span><div><strong>Results</strong><small>See what to work on next</small></div></div>
        </div>
      </article>

      <article class="atlas-product atlas-product--words">
        <div class="atlas-product__copy">
          <div class="atlas-product__meta"><span>Word Bank</span><span class="atlas-availability">Available</span></div>
          <h3>Keep the Japanese you want to remember.</h3>
          <p>Save vocabulary as you find it, add the meaning that matters to you, and build a personal collection you can return to anytime.</p>
          <a class="ma-button ma-button--primary atlas-product__action" href="/wordbank/" data-ma-branch-entry>Open Word Bank <svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></a>
        </div>
        <div class="atlas-product__visual atlas-bank-visual" aria-hidden="true">
          <div class="atlas-bank-row"><div><strong>勉強</strong><span>べんきょう</span></div><span>study</span></div>
          <div class="atlas-bank-row"><div><strong>時間</strong><span>じかん</span></div><span>time</span></div>
          <div class="atlas-bank-row"><div><strong>好き</strong><span>すき</span></div><span>like</span></div>
          <div class="atlas-bank-note">Your words. Your collection.</div>
        </div>
      </article>
    </section>

    <section class="atlas-benefits ma-page-section" aria-label="What Mode Atlas helps you do">
      <div class="atlas-benefit"><span class="section-kicker">Practise</span><strong>Spend more time recalling.</strong><p>Focused sessions keep the learning task clear so you can get straight into Japanese.</p></div>
      <div class="atlas-benefit"><span class="section-kicker">Remember</span><strong>Keep useful Japanese close.</strong><p>Build around the kana and vocabulary you actually want to carry forward.</p></div>
      <div class="atlas-benefit"><span class="section-kicker">Grow</span><strong>Move into more Japanese over time.</strong><p>New learning areas can join Mode Atlas without making the tools you already use feel crowded.</p></div>
    </section>

    <section class="atlas-future ma-page-section" aria-labelledby="futureTitle">
      <div class="atlas-future__copy"><div class="section-kicker">More ahead</div><h2 id="futureTitle">Keep going when you are ready.</h2><p>Kana and vocabulary are the beginning. More ways to practise Japanese are planned for Mode Atlas.</p></div>
      <div class="atlas-future__list" aria-label="Future learning tools"><span>Listening</span><span>Grammar</span><span>Reading Comprehension</span></div>
    </section>

    <footer class="footer"><div><strong>Mode Atlas</strong> · Japanese learning · v<span data-ma-app-version></span></div><div><a href="/">mode-atlas.app</a> · <a href="mailto:support@mode-atlas.com">support@mode-atlas.com</a></div></footer>
  </main>
'''
index,count=re.subn(r'  <main class="shell ma-page-frame">[\s\S]*?  </main>\n(?=<!-- MODE_ATLAS_BODY_ASSETS_START -->)',lambda _m:main,index,count=1)
if count!=1: raise RuntimeError('Atlas main replacement failed')
write('index.html',index)

css=r'''/* Mode Atlas homepage composition.
   Shared navigation, controls, typography primitives and theme tokens remain
   owned by the shared UI layers. This file owns only the Atlas homepage. */

body.ma-atlas-page{
  margin:0;
  min-height:100vh;
  overflow-x:hidden;
  color:var(--ma-text);
  background:var(--ma-page-bg-atlas);
}
body.ma-atlas-page::before{
  content:"";
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:
    radial-gradient(circle at 74% 16%,color-mix(in srgb,var(--ma-atlas) 10%,transparent),transparent 30%),
    radial-gradient(circle at 18% 38%,color-mix(in srgb,var(--ma-kana) 5%,transparent),transparent 26%);
}
body.ma-atlas-page::after{
  content:"学";
  position:fixed;
  right:-.08em;
  bottom:-.28em;
  z-index:0;
  pointer-events:none;
  color:color-mix(in srgb,var(--ma-watermark) 62%,transparent);
  font-family:var(--ma-font-jp);
  font-size:clamp(18rem,34vw,34rem);
  font-weight:900;
  line-height:1;
  transform:rotate(-8deg);
}
.ma-atlas-page a{color:inherit;}
.ma-atlas-page .shell{--ma-page-max:var(--ma-content-max);padding-bottom:var(--ma-space-8);}
[data-ma-home-visitor][hidden],[data-ma-home-user][hidden]{display:none!important;}

/* Hero */
.atlas-hero{padding-block:clamp(48px,7vw,96px) clamp(54px,8vw,108px);}
.atlas-hero__stage{
  position:relative;
  display:grid;
  grid-template-columns:minmax(0,.94fr) minmax(420px,1.06fr);
  align-items:center;
  gap:clamp(48px,7vw,104px);
}
.atlas-hero__copy{position:relative;z-index:2;min-width:0;}
.atlas-eyebrow{
  --ma-kicker-color:var(--ma-atlas);
  display:inline-flex;
  align-items:center;
  gap:10px;
  margin-bottom:20px;
}
.atlas-eyebrow::before{
  content:"";
  width:7px;
  height:7px;
  border-radius:50%;
  background:var(--ma-reading);
  box-shadow:0 0 18px color-mix(in srgb,var(--ma-reading) 48%,transparent);
}
.atlas-hero h1{
  max-width:9.4ch;
  margin:0;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(3.5rem,7vw,6.5rem);
  font-weight:860;
  letter-spacing:-.072em;
  line-height:.9;
  text-wrap:balance;
}
.atlas-hero__lead{
  max-width:620px;
  margin:clamp(24px,3vw,34px) 0 0;
  color:var(--ma-text-soft);
  font-size:clamp(1.02rem,1.6vw,1.2rem);
  line-height:1.65;
}
.atlas-hero__actions{
  --ma-action-gap:18px;
  align-items:center;
  margin-top:clamp(28px,4vw,42px);
}
.atlas-primary-action,
.atlas-product--kana .atlas-product__action{
  --ma-button-bg:linear-gradient(180deg,color-mix(in srgb,var(--ma-atlas) 34%,var(--ma-card-2)),color-mix(in srgb,var(--ma-atlas) 20%,var(--ma-card-3)));
  --ma-button-bg-hover:linear-gradient(180deg,color-mix(in srgb,var(--ma-atlas) 42%,var(--ma-card-2)),color-mix(in srgb,var(--ma-atlas) 26%,var(--ma-card-3)));
  --ma-button-border:color-mix(in srgb,var(--ma-atlas) 56%,var(--ma-border));
}
.atlas-text-link{
  display:inline-flex;
  align-items:center;
  gap:8px;
  min-height:40px;
  color:var(--ma-text-soft);
  font-size:.9rem;
  font-weight:800;
  text-decoration:none;
}
.atlas-text-link:hover{color:var(--ma-text-strong);}
.atlas-text-link:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:4px;border-radius:8px;}
.atlas-text-link--returning{margin-top:18px;}

.home-continue{
  max-width:620px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
  margin-top:clamp(28px,4vw,42px);
  padding:18px 0;
  border-block:1px solid var(--ma-border);
}
.home-continue__copy{min-width:0;display:grid;gap:5px;}
.home-continue__copy .ma-kicker{--ma-kicker-color:var(--ma-atlas);}
.home-continue__copy strong{
  overflow:hidden;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(1.25rem,2vw,1.55rem);
  text-overflow:ellipsis;
  white-space:nowrap;
}
.home-continue__copy>span:last-child{color:var(--ma-muted);font-size:var(--ma-text-sm);font-weight:700;}
.home-continue__action{flex:0 0 auto;}

/* Editorial product preview rather than a decorative constellation. */
.atlas-showcase{
  position:relative;
  min-height:520px;
  isolation:isolate;
}
.atlas-showcase__glow{
  position:absolute;
  inset:10% 4% 3% 10%;
  z-index:-1;
  border-radius:42%;
  background:radial-gradient(circle,color-mix(in srgb,var(--ma-atlas) 20%,transparent),transparent 66%);
  filter:blur(22px);
}
.atlas-preview{
  position:absolute;
  box-sizing:border-box;
  border:1px solid var(--ma-border-strong);
  border-radius:22px;
  background:linear-gradient(180deg,color-mix(in srgb,var(--ma-card-2) 94%,transparent),color-mix(in srgb,var(--ma-card-3) 97%,transparent));
  box-shadow:0 24px 68px color-mix(in srgb,#000 28%,transparent);
  backdrop-filter:blur(16px);
}
.atlas-preview__top{
  min-height:42px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:0 16px;
  border-bottom:1px solid var(--ma-border);
  color:var(--ma-muted);
  font-size:.73rem;
  font-weight:850;
  letter-spacing:.03em;
}
.atlas-preview__dot{width:7px;height:7px;border-radius:50%;background:var(--ma-reading);}
.atlas-preview--reading{
  z-index:3;
  left:0;
  top:58px;
  width:min(70%,390px);
  min-height:344px;
  padding-bottom:22px;
  transform:rotate(-2.5deg);
}
.atlas-preview__prompt{
  display:grid;
  place-items:center;
  min-height:156px;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-jp);
  font-size:6rem;
  font-weight:800;
}
.atlas-preview__answer{
  width:46%;
  margin:0 auto;
  padding:10px 14px;
  border:1px solid var(--ma-border);
  border-radius:12px;
  background:var(--ma-surface-inset);
  color:var(--ma-text-soft);
  font-size:1rem;
  font-weight:800;
  text-align:center;
}
.atlas-preview__caption{margin-top:18px;color:var(--ma-muted);font-size:.74rem;font-weight:750;text-align:center;}
.atlas-preview--words{
  z-index:4;
  right:0;
  top:12px;
  width:min(59%,330px);
  min-height:254px;
  overflow:hidden;
  transform:rotate(2.2deg);
}
.atlas-word-preview{display:grid;grid-template-columns:minmax(0,.4fr) minmax(0,1fr);gap:12px;padding:14px 16px;border-bottom:1px solid var(--ma-border);}
.atlas-word-preview:last-child{border-bottom:0;}
.atlas-word-preview strong{color:var(--ma-text-strong);font-family:var(--ma-font-jp);font-size:1.05rem;}
.atlas-word-preview span{color:var(--ma-muted);font-size:.75rem;align-self:center;}
.atlas-preview--writing{
  z-index:5;
  right:4%;
  bottom:16px;
  width:min(61%,350px);
  min-height:214px;
  transform:rotate(-1deg);
}
.atlas-writing-preview{display:grid;gap:20px;padding:24px 22px;}
.atlas-writing-preview>span{color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:2.1rem;font-weight:850;text-align:center;}
.atlas-writing-preview>div{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;}
.atlas-writing-preview b{display:grid;place-items:center;min-height:48px;border:1px solid var(--ma-border);border-radius:10px;background:var(--ma-surface-inset);color:var(--ma-text-soft);font-family:var(--ma-font-jp);font-size:1.2rem;}
.atlas-writing-preview b:first-child{border-color:color-mix(in srgb,var(--ma-writing) 52%,var(--ma-border));background:color-mix(in srgb,var(--ma-writing) 15%,var(--ma-card-3));color:var(--ma-text-strong);}

/* Product sections */
.atlas-tools{padding-block:clamp(44px,7vw,92px);}
.atlas-section-intro{max-width:760px;margin-bottom:clamp(42px,6vw,72px);}
.section-kicker{color:var(--ma-atlas);font-size:var(--ma-text-xs);font-weight:900;letter-spacing:.13em;text-transform:uppercase;}
.atlas-section-intro h2,.atlas-future h2{
  margin:8px 0 0;
  color:var(--ma-text-strong);
  font-family:var(--ma-font-display);
  font-size:clamp(2.25rem,4.5vw,4.1rem);
  font-weight:850;
  letter-spacing:-.055em;
  line-height:.98;
}
.atlas-section-intro p,.atlas-future__copy p{max-width:620px;margin:18px 0 0;color:var(--ma-muted);font-size:1rem;line-height:1.65;}
.atlas-product{
  position:relative;
  display:grid;
  grid-template-columns:minmax(0,.92fr) minmax(380px,1.08fr);
  align-items:center;
  gap:clamp(42px,7vw,100px);
  min-height:430px;
  padding-block:clamp(46px,7vw,84px);
  border-top:1px solid var(--ma-border);
}
.atlas-product:last-child{border-bottom:1px solid var(--ma-border);}
.atlas-product--words .atlas-product__copy{order:2;}
.atlas-product--words .atlas-product__visual{order:1;}
.atlas-product__meta{display:flex;align-items:center;gap:12px;color:var(--ma-muted);font-size:.75rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;}
.atlas-availability{padding:4px 8px;border:1px solid color-mix(in srgb,var(--ma-success) 32%,var(--ma-border));border-radius:var(--ma-radius-pill);background:var(--ma-status-success-bg);color:var(--ma-success);font-size:.65rem;letter-spacing:.06em;}
.atlas-product h3{max-width:12ch;margin:18px 0 0;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(2.15rem,4vw,3.8rem);font-weight:850;letter-spacing:-.055em;line-height:.98;}
.atlas-product__copy>p{max-width:560px;margin:20px 0 0;color:var(--ma-text-soft);font-size:1rem;line-height:1.68;}
.atlas-product__action{margin-top:28px;}
.atlas-product--words .atlas-product__action{--ma-button-bg:linear-gradient(180deg,color-mix(in srgb,var(--ma-words) 28%,var(--ma-card-2)),color-mix(in srgb,var(--ma-words) 16%,var(--ma-card-3)));--ma-button-bg-hover:linear-gradient(180deg,color-mix(in srgb,var(--ma-words) 36%,var(--ma-card-2)),color-mix(in srgb,var(--ma-words) 22%,var(--ma-card-3)));--ma-button-border:color-mix(in srgb,var(--ma-words) 50%,var(--ma-border));}
.atlas-product__visual{min-width:0;}
.atlas-kana-visual{display:grid;gap:12px;padding:clamp(22px,3vw,34px);border-radius:26px;background:linear-gradient(145deg,color-mix(in srgb,var(--ma-kana) 10%,transparent),transparent 58%),color-mix(in srgb,var(--ma-card-2) 72%,transparent);}
.atlas-mode-card{display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:18px;min-height:78px;padding:13px 18px;border:1px solid var(--ma-border);border-radius:16px;background:color-mix(in srgb,var(--ma-card-2) 92%,transparent);}
.atlas-mode-card>span{display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:var(--ma-surface-inset);color:var(--ma-text-strong);font-family:var(--ma-font-jp);font-size:1.4rem;font-weight:900;}
.atlas-mode-card strong{display:block;color:var(--ma-text-strong);font-size:.93rem;}
.atlas-mode-card small{display:block;margin-top:4px;color:var(--ma-muted);font-size:.75rem;line-height:1.35;}
.atlas-mode-card--reading>span{border:1px solid color-mix(in srgb,var(--ma-reading) 42%,var(--ma-border));}
.atlas-mode-card--writing>span{border:1px solid color-mix(in srgb,var(--ma-writing) 42%,var(--ma-border));}
.atlas-mode-card--results>span{border:1px solid color-mix(in srgb,var(--ma-results) 42%,var(--ma-border));}
.atlas-bank-visual{padding:clamp(18px,3vw,30px);border-radius:26px;background:linear-gradient(145deg,color-mix(in srgb,var(--ma-words) 11%,transparent),transparent 60%),color-mix(in srgb,var(--ma-card-2) 72%,transparent);}
.atlas-bank-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px;padding:18px 8px;border-bottom:1px solid var(--ma-border);}
.atlas-bank-row>div{display:flex;align-items:baseline;gap:14px;min-width:0;}
.atlas-bank-row strong{color:var(--ma-text-strong);font-family:var(--ma-font-jp);font-size:1.25rem;}
.atlas-bank-row span{color:var(--ma-muted);font-size:.78rem;}
.atlas-bank-row>span{color:var(--ma-text-soft);font-size:.84rem;font-weight:750;}
.atlas-bank-note{padding:18px 8px 4px;color:var(--ma-muted);font-size:.75rem;font-weight:800;letter-spacing:.04em;}

/* Benefits stay intentionally border-light. */
.atlas-benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(28px,5vw,64px);padding-block:clamp(58px,8vw,104px);}
.atlas-benefit{min-width:0;}
.atlas-benefit::before{content:"";display:block;width:42px;height:2px;margin-bottom:22px;background:color-mix(in srgb,var(--ma-atlas) 62%,transparent);}
.atlas-benefit strong{display:block;margin-top:10px;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.35rem,2.2vw,1.85rem);letter-spacing:-.035em;line-height:1.08;}
.atlas-benefit p{margin:14px 0 0;color:var(--ma-muted);font-size:.92rem;line-height:1.65;}

.atlas-future{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:clamp(36px,7vw,92px);padding-block:clamp(52px,7vw,88px);border-block:1px solid var(--ma-border);}
.atlas-future h2{max-width:10ch;font-size:clamp(2.1rem,4vw,3.6rem);}
.atlas-future__list{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;max-width:520px;}
.atlas-future__list span{padding:10px 13px;border:1px solid var(--ma-border);border-radius:var(--ma-radius-pill);background:color-mix(in srgb,var(--ma-card-3) 54%,transparent);color:var(--ma-text-soft);font-size:.8rem;font-weight:800;}

.footer{display:flex;justify-content:space-between;gap:var(--ma-space-4);padding:var(--ma-space-6) 0 var(--ma-space-4);color:var(--ma-muted);font-size:.78rem;line-height:1.5;}
.footer strong{color:var(--ma-text-soft);}.footer a{text-decoration:none;}.footer a:hover{text-decoration:underline;}

@media(max-width:980px){
  .atlas-hero__stage{grid-template-columns:1fr;gap:44px;}
  .atlas-hero h1{max-width:11ch;}
  .atlas-showcase{min-height:450px;max-width:690px;width:100%;margin-inline:auto;}
  .atlas-product{grid-template-columns:1fr;gap:38px;min-height:0;}
  .atlas-product--words .atlas-product__copy,.atlas-product--words .atlas-product__visual{order:initial;}
  .atlas-product__visual{max-width:720px;width:100%;}
  .atlas-future{grid-template-columns:1fr;align-items:start;}
  .atlas-future__list{justify-content:flex-start;}
}
@media(max-width:720px){
  body.ma-atlas-page::after{display:none;}
  .atlas-hero{padding-top:38px;}
  .atlas-hero h1{font-size:clamp(3rem,14vw,5rem);}
  .atlas-hero__actions{align-items:stretch;flex-direction:column;}
  .atlas-hero__actions .ma-button{width:100%;}
  .home-continue{align-items:stretch;flex-direction:column;}
  .home-continue__action{width:100%;}
  .atlas-showcase{min-height:390px;}
  .atlas-preview--reading{left:0;top:48px;width:68%;min-height:284px;}
  .atlas-preview__prompt{min-height:126px;font-size:4.8rem;}
  .atlas-preview--words{right:0;width:56%;min-height:214px;}
  .atlas-word-preview{grid-template-columns:1fr;gap:3px;padding:11px 13px;}
  .atlas-preview--writing{right:2%;bottom:2px;width:62%;min-height:178px;}
  .atlas-writing-preview{gap:15px;padding:18px 16px;}.atlas-writing-preview>span{font-size:1.7rem;}.atlas-writing-preview b{min-height:40px;}
  .atlas-product{padding-block:48px;}.atlas-product h3{max-width:14ch;}.atlas-product__action{width:100%;}
  .atlas-benefits{grid-template-columns:1fr;gap:42px;}
  .footer{flex-direction:column;}
}
@media(max-width:480px){
  .atlas-showcase{min-height:350px;}
  .atlas-preview{border-radius:17px;}
  .atlas-preview--reading{width:72%;}.atlas-preview--words{width:58%;}.atlas-preview--writing{width:67%;}
  .atlas-preview__top{min-height:36px;padding-inline:12px;font-size:.65rem;}
  .atlas-preview__prompt{min-height:110px;font-size:4.2rem;}
  .atlas-preview__answer{padding:8px 10px;}
  .atlas-preview__caption{margin-top:12px;font-size:.65rem;}
  .atlas-product__meta{align-items:flex-start;flex-direction:column;gap:8px;}
  .atlas-mode-card{grid-template-columns:50px minmax(0,1fr);padding-inline:13px;}.atlas-mode-card>span{width:44px;height:44px;}
  .atlas-bank-row>div{align-items:flex-start;flex-direction:column;gap:3px;}
}
@media(prefers-reduced-motion:reduce){.atlas-preview{transform:none;}}
'''
write('assets/css/mode-atlas-home-page.css',css)

version=read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.34.2';","var VERSION = '2.35.0';").replace("var CACHE_REVISION = 'assets-2.34.2';","var CACHE_REVISION = 'assets-2.35.0';")
write('assets/app/mode-atlas-version.js',version)
for rel in ('package.json','package-lock.json'):
    data=json.loads(read(rel));data['version']='2.35.0'
    if rel=='package-lock.json':data.setdefault('packages',{}).setdefault('',{})['version']='2.35.0'
    write(rel,json.dumps(data,indent=2)+'\n')
write('README.md',read('README.md').replace('Version: 2.34.2','Version: 2.35.0'))

changelog=read('CHANGELOG.md')
entry="""## 2.35.0 - 2026-08-16
- Refined Atlas into a cleaner product homepage with an open editorial hero, product previews, and less card-heavy section framing.
- Replaced the abstract constellation with representative Reading, Writing, and Word Bank previews that show what the learning tools feel like without adding learner statistics to Atlas.
- Reworked Kana Trainer and Word Bank into alternating product feature sections with clearer learner-focused value, direct actions, and lighter visual hierarchy.
- Kept the returning-user homepage intentionally restrained: only the hero changes to a single Continue studying action while the rest of Atlas remains the same clean product homepage.
- Simplified Atlas-only CSS by removing the retired constellation/branch-card composition instead of layering new overrides on top of it.

"""
if not changelog.startswith('## 2.35.0'):changelog=entry+changelog
write('CHANGELOG.md',changelog)

tests=read('tests/frontend.test.js')
tests=tests.replace("assert.match(home, /Explore Kana Trainer/);","assert.match(home, /Start with Kana Trainer/);")
append=r'''

test('2.35 Atlas homepage stays editorial, product-led, and free of learner stats', () => {
  const home = read('index.html');
  const css = read('assets/css/mode-atlas-home-page.css');
  assert.match(home, /Build Japanese skills that stick\./);
  assert.match(home, /class="atlas-showcase"/);
  assert.match(home, /class="atlas-product atlas-product--kana"/);
  assert.match(home, /class="atlas-product atlas-product--words"/);
  assert.match(home, /id="homeContinueCard"/);
  assert.match(home, /data-ma-home-visitor/);
  assert.match(home, /data-ma-home-user/);
  assert.doesNotMatch(home, /homeVisitStreak|homeReadingDaily|homeWritingDaily|Accuracy|Mastered|Daily Challenge|Study status/);
  assert.doesNotMatch(home, /class="constellation"|class="branch-grid"|class="branch kana"|class="branch words"/);
  assert.match(css, /\.atlas-hero__stage\{/);
  assert.match(css, /\.atlas-preview--reading\{/);
  assert.match(css, /\.atlas-product\{/);
  assert.doesNotMatch(css, /\.constellation\{|\.branch-grid\{|\.branch\.kana/);
});
'''
if '2.35 Atlas homepage stays editorial' not in tests:tests=tests.rstrip()+append
write('tests/frontend.test.js',tests)
