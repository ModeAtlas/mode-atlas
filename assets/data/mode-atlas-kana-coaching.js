/* Original Kana teaching content. Shape notes describe the modern forms, not
   historical origins. Sound rules were checked against the Japan Foundation's
   Irodori Starter and TUFS pronunciation modules; see sources below.
   Every canonical unit has specific content. Unknown units return null. */
(function ModeAtlasKanaCoaching(root){
  'use strict';
  const freeze=value=>{
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
    return value;
  };
  const sources=freeze([
    'https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L01.pdf',
    'https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L02.pdf',
    'https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/02-02-01.php',
    'https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/02-01-01.php',
    'https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/01-11-01.php',
    'https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/03-06-01.php'
  ]);
  const contrasts=freeze([
    {chars:['シ','ツ'],note:'シ has two short marks down the left; ツ has two across the top. Their long strokes travel in different directions.'},
    {chars:['ソ','ン'],note:'ソ starts its long stroke high on the right and sweeps down-left. ン sweeps up from the lower left.'},
    {chars:['ぬ','め'],note:'ぬ finishes with a small loop at the lower right. め leaves that end open.'},
    {chars:['ね','れ','わ'],note:'ね ends in a small loop; れ ends in an outward sweep; わ has a broad rounded right side.'},
    {chars:['メ','ヌ'],note:'メ is two crossing slants. ヌ also has a horizontal top and a turn.'},
    {chars:['ク','タ'],note:'タ adds a short stroke inside the shape. ク leaves that space open.'},
    {chars:['さ','き'],note:'Count the crossbars: さ has one, while き has two. Both can have a separate lower curve in handwriting.'},
    {chars:['は','ほ'],note:'The right side of は has one crossbar; ほ has two. Both finish in a small loop.'},
    {chars:['る','ろ'],note:'る finishes with a small loop at the bottom. ろ has the same upper turn but no finishing loop.'},
    {chars:['チ','テ'],note:'チ has a sloping first stroke. テ has a short horizontal first stroke above its longer bar.'},
    {chars:['コ','ユ'],note:'コ is open on the left. ユ has a bottom stroke that reaches farther left than its top stroke.'},
    {chars:['リ','ル','レ'],note:'リ has two separate downward strokes. ル turns its right stroke up-right. レ makes that turn in one stroke.'}
  ]);
  // [recognition cue, a concrete point to notice in the stroke demonstration]
  const shapes=freeze({
    'あ':['A short top bar crosses an upright above a broad loop. Notice the crossing inside that loop.','Draw the top bar first; keep the large final loop open around the crossing.'],
    'い':['Two separate curves stand beside each other; the left one is longer.','Lift between the two strokes. The right curve starts a little lower.'],
    'う':['A short mark floats above one broad curve.','Keep the top mark separate from the lower curve.'],
    'え':['A short mark sits over an angular turn and a sweeping foot.','Lift after the top mark; let the last stroke sweep out to the right.'],
    'お':['A loop sits below a crossbar, with a separate small mark at the upper right.','Keep that upper-right mark separate from the main loop.'],
    'か':['The main hooked shape is crossed by a falling stroke; a short mark sits apart on the right.','Watch where the long falling stroke crosses the first stroke. Add the separate mark last.'],
    'き':['Two crossbars cut across a slanting stem, above a rounded lower part.','Watch the pen lift before the lower curve in the handwritten form.'],
    'く':['One bent stroke makes an angle that opens to the right.','Start at the upper right, turn at the left corner, then move down-right.'],
    'け':['A separate upright stands left of a crossbar and a longer downward curve.','Keep the left stroke separate; let the rightmost stroke continue below the bar.'],
    'こ':['Two short curves sit one above the other, with open space between them.','Lift between the upper and lower curves.'],
    'さ':['One crossbar cuts a slanting stem above a lower curve.','The handwritten lower curve can be separate; do not add the second crossbar of き.'],
    'し':['A single stroke drops down and curls gently up to the right.','Keep the bottom rounded rather than making a sharp corner.'],
    'す':['A long crossbar meets a downward stroke that forms a small loop.','Watch the small loop before the stroke continues downward.'],
    'せ':['A crossbar runs through two uprights; the left one bends into a long lower sweep.','The right upright stops sooner than the left sweeping stroke.'],
    'そ':['A small zigzag leads into a wide curve underneath.','Follow the turn into the lower curve without adding a separate loop.'],
    'た':['A cross on the left sits beside two short curves on the right.','Make the left pair first, then the two separate right-hand strokes.'],
    'ち':['A top crossbar meets a sloping stroke that opens into a rounded lower curve.','Follow the long second stroke from its upper crossing into the lower curve.'],
    'つ':['One broad curve opens on the left.','Start on the left, round the right side, then finish toward the lower left.'],
    'て':['A top bar bends into a curved stroke beneath it.','Watch the sharp turn below the bar before the rounded lower sweep.'],
    'と':['A short slant sits above a wide, rounded lower stroke.','Lift after the short upper stroke before making the lower curve.'],
    'な':['A cross occupies the left; a small mark and a lower loop sit on the right.','Keep the upper-right mark separate from the lower loop.'],
    'に':['One upright on the left sits beside two short curves on the right.','Keep all three strokes separate; the right side resembles こ.'],
    'ぬ':['Two strokes cross inside a broad oval, ending in a small lower-right loop.','Follow the final small loop; it distinguishes ぬ from め.'],
    'ね':['An upright is crossed by a broad right-hand curve with a small finishing loop.','Watch the final curl on the lower right.'],
    'の':['One continuous stroke curves around an open centre.','Follow the stroke around once; do not add an extra small loop.'],
    'は':['A separate upright stands beside a crossbar and a small lower loop.','Keep the left stroke apart from the loop on the right.'],
    'ひ':['One long scooping stroke makes a bowl with outward-turning ends.','Follow the entire bowl as one stroke.'],
    'ふ':['A short top mark sits above the centre, with a separate stroke on either side.','Watch each pen lift; the two side strokes stay separate from the centre.'],
    'へ':['One stroke rises to a peak, then slopes farther down on the right.','Keep one clear peak and a longer right-hand slope.'],
    'ほ':['A separate left upright sits beside two crossbars and a lower loop.','Count both right-hand crossbars before drawing the loop.'],
    'ま':['Two crossbars cross a stem that curls into a loop at the bottom.','Watch the stem pass through both bars before making the loop.'],
    'み':['A small loop on the left flows into a sweep crossed by a separate right-hand stroke.','Trace the left loop first; keep the final crossing stroke separate.'],
    'む':['A cross leads into a small loop and a lower sweep, with a separate mark on the right.','Finish the lower sweep before adding the short right-hand mark.'],
    'め':['Two strokes cross inside a broad oval with no small finishing loop.','Leave the lower-right end open, unlike ぬ.'],
    'も':['A long stem bends right at the bottom and is crossed by two short bars.','Make the long hooked stroke before the two crossbars.'],
    'や':['A broad hooked stroke crosses a long slant, with a short mark above.','Watch the three separate strokes and the long final slant.'],
    'ゆ':['A broad rounded shape is crossed by a long central stroke.','Watch the central stroke run through the rounded right-hand shape.'],
    'よ':['A short upper bar meets a long upright ending in a lower loop.','Keep the upper bar short; form the loop at the bottom of the second stroke.'],
    'ら':['A short top mark sits apart from the large lower curve.','Lift after the top mark before starting the lower stroke.'],
    'り':['Two strokes stand side by side; the right one is longer and curves left at the bottom.','Keep the two strokes separate in handwriting.'],
    'る':['An angular upper turn leads into a rounded bottom with a small loop.','Keep the finishing loop; without it the shape resembles ろ.'],
    'れ':['An upright is crossed by a stroke that sweeps out on the lower right.','Finish with the outward sweep, without the loop of ね.'],
    'ろ':['An angular upper turn leads into a broad lower curve without a small loop.','Leave the bottom open; do not add the finishing loop of る.'],
    'わ':['An upright is crossed by a broad rounded shape on the right.','Keep the right side rounded, without the small curl of ね.'],
    'を':['An upper cross leads into a narrow middle and a broad rounded lower stroke.','Watch the final curved stroke cross through the narrow middle.'],
    'ん':['A long slant bends into a small rise, then sweeps out to the right.','Follow the change of direction as one flowing stroke.'],
    'ア':['An angular top stroke sits above a long sweeping stroke.','Lift after the top angle before drawing the long second stroke.'],
    'イ':['A sloping stroke crosses the top of a longer, nearly vertical stroke.','Start with the slant; begin the second stroke at the crossing.'],
    'ウ':['A short top mark sits above a roof with two downward sides.','Keep the short top mark separate from the roof below.'],
    'エ':['Two horizontal bars are joined by a central upright.','Draw the top, then the upright, then the longer bottom bar.'],
    'オ':['A crossbar and upright are joined by a long slant toward the lower left.','The final slant starts near the crossing and falls left.'],
    'カ':['A hooked top stroke is crossed by a long falling slant.','Keep the hook at the lower end of the first stroke.'],
    'キ':['Two bars cross a long slanting stem.','Draw both crossbars before the long stem.'],
    'ク':['A short upper-left slant meets a longer hooked sweep.','Leave the inside empty; タ has an extra short stroke there.'],
    'ケ':['A short left slant meets a bar with a longer falling stroke below.','Watch the final stroke descend from the bar.'],
    'コ':['Three sides make a squared shape open on the left.','The top turns down the right; finish with a separate bottom bar.'],
    'サ':['A horizontal bar crosses two uprights; the right one continues lower.','Make the bar first, then the two separate downward strokes.'],
    'シ':['Two short marks sit down the left side beside a long rising sweep.','The final sweep travels from the lower left toward the upper right.'],
    'ス':['A top bar turns into a falling slant, crossed by a short lower-right stroke.','Add the lower-right stroke after the long turning stroke.'],
    'セ':['A hooked crossbar meets an upright that bends right along the bottom.','Watch the top hook and the long lower turn as separate strokes.'],
    'ソ':['One short mark sits on the left; a long stroke falls from the upper right.','The long stroke starts high and sweeps down-left, unlike ン.'],
    'タ':['A hooked outline contains one short inner slant.','Keep the short stroke inside; it distinguishes タ from ク.'],
    'チ':['A short sloping stroke sits above a bar and a long downward curve.','The first stroke slopes; it is not the level top bar of テ.'],
    'ツ':['Two short marks sit across the top above a long falling sweep.','The final stroke starts high on the right and sweeps down-left.'],
    'テ':['A short top bar sits above a longer bar with a downward curve.','Keep the two bars level, then add the descending stroke.'],
    'ト':['A long upright stands beside a short stroke angled down-right.','Keep the right-hand stroke separate from the upright.'],
    'ナ':['One horizontal bar crosses a long stroke falling left.','Make the crossbar before the long falling stroke.'],
    'ニ':['Two horizontal bars sit apart; the bottom one is longer.','Lift between the bars and leave a clear gap.'],
    'ヌ':['An angled top stroke is crossed by a second slant toward the lower right.','Notice the horizontal top before the crossing slants.'],
    'ネ':['A short top mark sits above a sloping cross, central stem and right-hand flick.','Keep the top mark and lower-right flick separate.'],
    'ノ':['One long slant curves from upper right to lower left.','Follow the single smooth downward sweep.'],
    'ハ':['Two separate strokes spread out toward the lower left and lower right.','Leave open space between the two slants.'],
    'ヒ':['A short upper stroke crosses a longer stroke that bends along the bottom.','Watch the long lower turn to the right.'],
    'フ':['A top bar turns into a long stroke sweeping toward the lower left.','Follow the corner at the upper right as part of the same stroke.'],
    'ヘ':['A single angular stroke rises to a peak, then slopes down-right.','Make one peak; keep the right slope longer.'],
    'ホ':['An upright crosses a horizontal bar, with a short slant on each lower side.','Add the two separate side strokes after the central cross.'],
    'マ':['An angular top sweep sits above a separate short slant pointing down-right.','Keep the lower slant separate from the top stroke.'],
    'ミ':['Three short sloping bars sit one above another.','Lift after each bar; the middle bar is shorter.'],
    'ム':['A long turning stroke makes the left and bottom of an open triangle; a short slant closes its right side.','Watch the turn at the lower left before adding the separate right stroke.'],
    'メ':['Two long slants cross near the middle.','There is no horizontal top bar, unlike ヌ.'],
    'モ':['Two horizontal bars cross a stem that turns right at the bottom.','Draw both bars before the long hooked stem.'],
    'ヤ':['A hooked crossbar is crossed by a long slanting stem.','Let the final stem extend well below the crossbar.'],
    'ユ':['A short top and right side sit on a longer bottom bar that reaches left.','The bottom stroke extends farther left than the top.'],
    'ヨ':['Three horizontal bars meet a spine on the right.','Keep the left side open and the bars clearly separated.'],
    'ラ':['A short top bar sits above a longer turning stroke.','Lift after the top bar; the lower stroke turns down-left.'],
    'リ':['Two separate downward strokes stand side by side; the right is longer.','The longer right stroke curves inward at the bottom.'],
    'ル':['Two downward strokes stand side by side; the right one turns sharply up-right.','Keep the upward finish on the right stroke.'],
    'レ':['One long downward stroke turns toward the upper right.','Make the turn in one stroke, without the extra left stroke of ル.'],
    'ロ':['A squared outline encloses an empty centre.','Keep the four sides joined; this shape is closed, unlike コ.'],
    'ワ':['A roof joins a short left side to a longer curved right side.','The long right side sweeps down-left; keep the left side short.'],
    'ヲ':['Two horizontal bars meet a long outer sweep toward the lower left.','Notice the extra middle bar that フ does not have.'],
    'ン':['One short upper-left mark sits above a long rising sweep.','Start the final sweep low on the left and move up-right, unlike ソ.']
  });
  const vowels=freeze({
    a:'Open your mouth for a steady a, like a short “ah”.',
    i:'Keep i steady, like a short “ee”, without an extra glide.',
    u:'Make a short u with relaxed lips, less rounded than English “oo”.',
    e:'Keep e steady, close to “eh”; do not slide into “ay”.',
    o:'Keep o steady; avoid adding a “w” sound at the end.'
  });
  const consonants=freeze({
    k:'Release k at the back of your mouth',
    s:'Let the air hiss through s',
    t:'Release t from the front of your tongue',
    n:'Let n sound through your nose',
    h:'Breathe out gently for h',
    m:'Start with closed lips for m',
    y:'Glide smoothly through y',
    r:'Tap your tongue briefly for Japanese r',
    w:'Glide from w into the vowel without adding a separate u',
    g:'Use your voice for g at the back of your mouth',
    z:'Use your voice with the buzzing z sound',
    d:'Use your voice as you release d',
    b:'Release your lips with voice for b',
    p:'Release your lips without voice for p'
  });
  function reading(kana){
    for(const map of Object.values(root.ModeAtlasKanaData?.maps||{}))if(map[kana])return map[kana];
    return '';
  }
  function soundFor(kana,roman){
    if(kana==='を'||kana==='ヲ')return kana+' is normally pronounced o. Charts use wo to keep it distinct from '+(kana==='を'?'お':'オ')+'.';
    if(roman==='n')return kana+' takes a beat of its own. Do not add a vowel after n; its sound adapts to the next consonant.';
    if(vowels[roman])return vowels[roman];
    if(roman==='shi')return 'Bring your tongue near the roof of your mouth for shi. Keep the i short; compare the sound with hi.';
    if(roman==='chi')return 'Start chi with a soft “ch”, then a short i. Keep it one beat.';
    if(roman==='tsu')return 'Join ts, as at the end of “cats”, straight to a short Japanese u: tsu.';
    if(roman==='fu')return 'For fu, let air pass between both lips. Keep your upper teeth away from your lower lip.';
    if(roman==='hi')return 'For hi, bring the middle of your tongue near the roof of your mouth and let your breath through.';
    if(roman==='ji')return kana+' is pronounced ji. '+(['ぢ','ヂ'].includes(kana)?'Its sound is normally the same as '+(kana==='ぢ'?'じ':'ジ')+'; the word decides the spelling.':'Start with a voiced j sound, followed by a short i.');
    if(roman==='zu')return kana+' is pronounced zu. '+(['づ','ヅ'].includes(kana)?'Its sound is normally the same as '+(kana==='づ'?'ず':'ズ')+'; the word decides the spelling.':'Keep the u short after the voiced z sound.');
    const vowel=roman.at(-1),start=consonants[roman[0]];
    return start&&vowels[vowel]?start+', then move directly into '+vowel+'. Say '+roman+' in one beat.':null;
  }
  const extended=freeze({
    'イェ':['イ','ェ','Blend y into e: ye. This is one beat, unlike イエ, i-e.'],
    'ウィ':['ウ','ィ','Glide w directly into i: wi. Do not give ウ a separate beat.'],
    'ウェ':['ウ','ェ','Glide w directly into e: we. Do not say u-e as two beats.'],
    'ウォ':['ウ','ォ','Glide w directly into o: wo. Unlike ヲ, this spelling explicitly shows the w glide.'],
    'シェ':['シ','ェ','Move from the sh sound directly into e: she. Do not insert i between them.'],
    'ジェ':['ジ','ェ','Move from the j sound directly into e: je. Do not say ji-e as two beats.'],
    'チェ':['チ','ェ','Move from ch directly into e: che. Do not say chi-e as two beats.'],
    'ティ':['テ','ィ','Release t into i: ti. Compare チ, chi, which begins with ch.'],
    'ディ':['デ','ィ','Release a voiced d into i: di. Compare ジ, ji, which begins with j.'],
    'トゥ':['ト','ゥ','Release t directly into u: tu. Compare ツ, tsu, which includes an s sound.'],
    'ドゥ':['ド','ゥ','Release a voiced d directly into u: du. Compare ヅ, normally pronounced zu.'],
    'ツァ':['ツ','ァ','Keep the ts beginning and change the vowel to a: tsa. The pair takes one beat.'],
    'ツィ':['ツ','ィ','Keep the ts beginning and change the vowel to i: tsi. The pair takes one beat.'],
    'ツェ':['ツ','ェ','Keep the ts beginning and change the vowel to e: tse. The pair takes one beat.'],
    'ツォ':['ツ','ォ','Keep the ts beginning and change the vowel to o: tso. The pair takes one beat.'],
    'ファ':['フ','ァ','Keep the soft f beginning and move straight to a: fa. Do not say fu-a as two beats.'],
    'フィ':['フ','ィ','Keep the soft f beginning and move straight to i: fi. Do not say fu-i as two beats.'],
    'フェ':['フ','ェ','Keep the soft f beginning and move straight to e: fe. Do not say fu-e as two beats.'],
    'フォ':['フ','ォ','Keep the soft f beginning and move straight to o: fo. Do not say fu-o as two beats.'],
    'フュ':['フ','ュ','Blend f with yu: fyu. Do not give fu and yu separate beats.'],
    'ヴ':['ウ',null,'ヴ marks a v sound in loanword spelling. It is often pronounced with a b-like sound in Japanese; follow the whole word.'],
    'ヴァ':['ヴ','ァ','ヴァ spells va in loanwords. Keep it one beat; Japanese speakers may use a b-like beginning.'],
    'ヴィ':['ヴ','ィ','ヴィ spells vi in loanwords. Keep it one beat; Japanese speakers may use a b-like beginning.'],
    'ヴェ':['ヴ','ェ','ヴェ spells ve in loanwords. Keep it one beat; Japanese speakers may use a b-like beginning.'],
    'ヴォ':['ヴ','ォ','ヴォ spells vo in loanwords. Keep it one beat; Japanese speakers may use a b-like beginning.'],
    'ヴュ':['ヴ','ュ','ヴュ spells vyu in loanwords. Blend the beginning with yu in one beat; the beginning may sound like b.']
  });
  const fullSize=freeze({'ゃ':'や','ゅ':'ゆ','ょ':'よ','ャ':'ヤ','ュ':'ユ','ョ':'ヨ','ァ':'ア','ィ':'イ','ゥ':'ウ','ェ':'エ','ォ':'オ'});
  function contrastFor(kana){return contrasts.find(item=>item.chars.includes(kana))||null;}
  function teach(kana){
    const roman=reading(kana);if(!roman)return null;
    const base=shapes[kana];
    if(base)return freeze({kind:'basic',sound:soundFor(kana,roman),shape:base[0],stroke:base[1],parts:[kana],contrast:contrastFor(kana)});
    const loan=extended[kana];
    if(loan){
      const [first,small,sound]=loan,firstShape=first==='ヴ'?'ウ with two voicing marks at its upper right.':teach(first).shape;
      return freeze({kind:'extended',sound,shape:small?first+' plus a small '+small+'. '+firstShape:'Start with ウ and add two short voicing marks at the upper right.',stroke:small?'Finish '+first+' first, then write '+small+' smaller beside it.':'Finish ウ before adding its two separate voicing marks.',parts:small?[first,small]:['ウ','゛'],contrast:small?{chars:[kana,first+fullSize[small]],note:kana+' takes one beat; '+first+fullSize[small]+' keeps two full-size kana.'}:null});
    }
    const units=Array.from(kana);
    if(units.length===2&&fullSize[units[1]]){
      const [first,small]=units,full=fullSize[small],firstTeaching=teach(first);
      if(!firstTeaching)return null;
      return freeze({kind:'joined',sound:'Blend '+first+' with small '+small+' into '+roman+': one beat. '+first+full+' uses a full-size '+full+' and takes two beats.',shape:first+' keeps its usual shape; the '+small+' beside it must be small. '+firstTeaching.shape,stroke:'Finish '+first+' first. Add a small '+small+' beside it, rather than a full-size '+full+'.',parts:[first,small],contrast:{chars:[kana,first+full],note:kana+' is one beat; '+first+full+' is two. Kana size changes the reading.'}});
    }
    const decomposed=Array.from(kana.normalize('NFD'));
    if(decomposed.length===2&&['\u3099','\u309a'].includes(decomposed[1])&&shapes[decomposed[0]]){
      const original=decomposed[0],circle=decomposed[1]==='\u309a',mark=circle?'a small circle':'two short voicing marks',sound=soundFor(kana,roman);
      return freeze({kind:'voiced',sound,shape:original+' becomes '+kana+' with '+mark+' at the upper right. '+shapes[original][0],stroke:'Write '+original+' first, then add '+mark+' without changing the main shape.',parts:[original,circle?'゜':'゛'],contrast:{chars:[original,kana],note:original+' is '+reading(original)+'; '+kana+' is '+roman+'. Keep the added mark visible.'}});
    }
    return null;
  }
  function explain(kana){
    const contrast=contrastFor(kana)||teach(kana)?.contrast;
    return contrast||{chars:[kana],note:teach(kana)?.shape||'No teaching note is available for this character.'};
  }
  function matches(kana,answer){
    const input=String(answer||'').trim();
    return /^[a-z']+$/i.test(input)&&(input.toLowerCase()===reading(kana)||root.ModeAtlasJapanese.matchesReading(input,kana)||['を','ヲ'].includes(kana)&&input.toLowerCase()==='o');
  }
  // Exercises use sound sequences, not a vocabulary-meaning test. Listen tasks
  // include short and long targets; each options list has one audible match.
  // The session owner shuffles tasks/options and keeps answer-revealing feedback
  // separate from first-attempt evidence. An audio skip cannot pass a listen task.
  const soundPatterns=freeze([
    {id:'longVowels',title:'Long vowels',script:'hiragana',patternCharacters:[],
      prerequisites:['あ','い','う','え','お','か','き','く','け','こ'],
      teaching:[
        {id:'steady-vowel',text:'A long vowel lasts two beats with no break in the sound. Compare the short and long sound; count one, then two.',example:'あ · ああ',audio:'ああ',comparison:['あ','ああ']},
        {id:'vowel-spelling',text:'Hiragana adds a vowel kana. Long e is often written えい, and long o often おう; some words use ええ or おお. Learn each word’s spelling.',example:'えい · おう',audio:'おう',comparison:['えい','おう']}
      ],
      tasks:[
        {id:'hear-ii',kind:'listen',prompt:'Choose the sound sequence you hear.',audio:'いい',answer:'いい',options:['い','いい','いえ'],correction:'いい holds i for two beats. い has one beat.'},
        {id:'write-aa',kind:'apply',prompt:'Keep the a in か sounding for two beats. Choose the spelling.',answer:'かあ',options:['か','かあ','かい'],correction:'Add あ after か to hold its a: かあ.'},
        {id:'hear-ku',kind:'listen',prompt:'Choose the sound sequence you hear.',audio:'く',answer:'く',options:['くう','く','こう'],correction:'く has one short u beat. くう holds u for two.'},
        {id:'write-uu',kind:'apply',prompt:'Keep the u in く sounding for two beats. Choose the spelling.',answer:'くう',options:['くう','く','くお'],correction:'Add う after く to keep the same u sound: くう.'},
        {id:'hear-kou',kind:'listen',prompt:'Choose the sound sequence you hear.',audio:'こう',answer:'こう',options:['こ','かう','こう'],correction:'こう has a long o sound here. こ has a short o.'},
        {id:'hear-kei',kind:'listen',prompt:'Choose the sound sequence you hear.',audio:'けい',answer:'けい',options:['け','けい','かい'],correction:'けい is pronounced with a long e here. け has a short e.'}
      ]},
    {id:'sokuon',title:'Small っ',script:'hiragana',patternCharacters:['っ'],
      prerequisites:['あ','い','か','き','こ','さ','し','た','つ','て'],
      teaching:[
        {id:'hold-consonant',text:'Small っ gives the following consonant an extra beat. Before k or t, hold the mouth position briefly before releasing it; do not say tsu.',example:'かこ · かっこ',audio:'かっこ',comparison:['かこ','かっこ']},
        {id:'size-and-hiss',text:'Full-size つ says tsu. Small っ holds the next consonant: with s, hold the hiss rather than adding a vowel.',example:'さし · さっし',audio:'さっし',comparison:['さし','さっし']}
      ],
      tasks:[
        {id:'hear-kitte',kind:'listen',prompt:'Choose the sequence you hear.',audio:'きって',answer:'きって',options:['きて','きつて','きって'],correction:'きって holds t for an extra beat. きつて would say tsu in the middle.'},
        {id:'write-itta',kind:'apply',prompt:'Write itta with a held t, using small っ.',answer:'いった',options:['いた','いった','いつた'],correction:'Put small っ before た: いった. Full-size つ would add tsu.'},
        {id:'hear-kata',kind:'listen',prompt:'Choose the sequence you hear.',audio:'かた',answer:'かた',options:['かった','かつた','かた'],correction:'かた moves directly from ka to ta, without the held t of かった.'},
        {id:'write-sakka',kind:'apply',prompt:'Write sakka with a held k, using small っ.',answer:'さっか',options:['さっか','さか','さつか'],correction:'Place small っ before か: さっか. It holds the k.'},
        {id:'hear-atta',kind:'listen',prompt:'Choose the sequence you hear.',audio:'あった',answer:'あった',options:['あた','あった','あつた'],correction:'あった gives the held t its own beat: a, hold, ta.'},
        {id:'hear-kite',kind:'listen',prompt:'Choose the sequence you hear.',audio:'きて',answer:'きて',options:['きつて','きって','きて'],correction:'きて has two beats, ki-te. There is no held t.'}
      ]},
    {id:'katakanaLength',title:'Katakana long vowels',script:'katakana',patternCharacters:['ー'],
      prerequisites:['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ'],
      teaching:[
        {id:'length-mark',text:'Katakana uses ー to hold the preceding vowel for another beat. The mark has no fixed vowel sound of its own.',example:'ア · アー',audio:'アー',comparison:['ア','アー']},
        {id:'follow-vowel',text:'The vowel before ー decides the sound: イー holds i, while オー holds o. Keep one steady vowel across both beats.',example:'イー · オー',audio:'オー',comparison:['イー','オー']}
      ],
      tasks:[
        {id:'hear-key',kind:'listen',prompt:'Choose the sequence you hear.',audio:'キー',answer:'キー',options:['キ','ケー','キー'],correction:'キー holds the i in キ. ケー would hold e.'},
        {id:'write-koo',kind:'apply',prompt:'Hold the o in コ for another beat. Choose the spelling.',answer:'コー',options:['コ','コー','クー'],correction:'Add ー after コ: コー. The mark extends its o.'},
        {id:'hear-ka',kind:'listen',prompt:'Choose the sequence you hear.',audio:'カ',answer:'カ',options:['カー','カ','ケー'],correction:'カ has one short a beat. カー would hold a for two.'},
        {id:'write-kuu',kind:'apply',prompt:'Hold the u in ク for another beat. Choose the spelling.',answer:'クー',options:['ケー','ク','クー'],correction:'Add ー after ク: クー. The mark extends its u.'},
        {id:'hear-ee',kind:'listen',prompt:'Choose the sequence you hear.',audio:'エー',answer:'エー',options:['エー','エ','イー'],correction:'エー holds e for two beats. エ has one.'},
        {id:'hear-koo',kind:'listen',prompt:'Choose the sequence you hear.',audio:'コー',answer:'コー',options:['コ','コー','カー'],correction:'コー holds the o in コ, not the a in カ.'}
      ]}
  ]);
  function patterns(){return soundPatterns;}
  root.ModeAtlasKanaCoaching=Object.freeze({reading,explain,contrasts,teach,matches,patterns,sources});
})(window);
