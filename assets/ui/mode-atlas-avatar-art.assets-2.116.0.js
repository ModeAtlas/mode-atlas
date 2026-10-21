/* Original layered vector character. Every interpolated value comes from the
   bounded character catalogue; profile names and arbitrary markup never enter. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../app/mode-atlas-avatar-rules.js'));
  else root.ModeAtlasAvatarArt=factory(root.ModeAtlasAvatarRules);
})(typeof window!=='undefined'?window:globalThis,function(rules){
  'use strict';
  let serial=0;
  function petArt(pet){
    const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
    const line=(d,c='#36434e',w=2)=>path(d,'none',`stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`);
    const dot=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
    const oval=(x,y,rx,ry,c)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}"/>`;
    let art=oval(60,111,45,6,'#243a4322');
    if(pet==='none')return '';
    if(pet==='koi')return art+path('M15 48Q60 36 106 48L98 90Q92 112 60 114 28 112 22 90Z','#a9d5db','opacity=".7"')+oval(60,49,45,14,'#c9edf0')+oval(60,52,37,9,'#81bdc9')+path('M74 64Q47 51 32 75Q45 102 73 83L91 93 85 77 94 62Z','#e2ad49')+path('M45 64Q51 72 47 86L37 82 32 75Z','#fff0ce')+path('m62 66 8-10 4 15m-13 17 9 9 3-14','#d08138')+dot(38,74,2.4,'#354c56')+line('M52 72q7-4 12 1m-12 7q7-4 12 0','#fff0ce',1.5)+path('M67 35q-7-21 5-25 12 7 2 25 16-16 24-5-7 12-24 11Z','#5a947c')+oval(78,43,21,5,'#75ad8a')+dot(26,42,3,'#f6fbfb')+dot(100,57,2,'#f6fbfb');
    if(pet==='crane')return '<g stroke="#bdc7c4" stroke-width=".7" stroke-linejoin="round">'+art+line('m49 83-8 25m23-23 7 23m-30 0-11 4m11-4 7 4m23-4 10 4m-10-4-5 4','#4d5762',3)+oval(58,70,27,20,'#f4f3e8')+path('M42 58Q55 67 68 69L96 85Q66 89 48 76Z','#303b49')+path('M67 66Q89 49 78 31L75 19 85 17Q105 48 79 72Z','#f4f3e8')+path('M81 22Q94 42 81 55L76 51Q85 35 76 25Z','#303b49')+oval(79,18,11,10,'#f4f3e8')+path('m87 18 26 5-27 1Z','#c3a065')+oval(77,10,7,3,'#b84440')+dot(82,17,2,'#273842')+'</g>';
    const spitz=pet==='japanese-spitz',fox=pet==='moon-fox',tanuki=pet==='tanuki',cat=pet==='calico',rabbit=pet==='rabbit';
    const coat=spitz?'#faf9f3':fox?'#e8e9ee':tanuki?'#8a7766':cat?'#efe8db':rabbit?'#e2d5c6':'#cf975b';
    const light=spitz?'#e0e5e6':fox?'#a5b0c8':tanuki?'#cfbf9f':cat?'#bd845b':rabbit?'#bda48f':'#f1d8af';
    if(fox)art+=path('M77 87Q127 74 112 35Q101 21 89 25Q111 56 71 66Z',light)+path('M112 35Q101 21 89 25L101 45Z','#faf5dd');
    else if(cat)art+=line('M82 91Q115 83 104 54',light,11);
    else if(tanuki)art+=path('M79 80Q105 62 110 81Q114 100 83 100Z','#5f5248')+line('M95 77q7 9 1 18','#99816a',7);
    else if(!rabbit)art+=path('M84 86Q122 90 109 58Q98 42 89 56Q83 66 96 70L99 60Q111 77 88 73Z',coat,`stroke="${light}" stroke-width="2"`);
    art+=oval(61,81,30,28,coat)+oval(59,89,19,20,spitz?'#fffdf8':tanuki?'#e2d3b7':'#f5ebd8');
    if(rabbit)art+=oval(89,87,12,12,'#f7eee2')+oval(40,18,10,30,coat)+oval(73,17,10,30,coat)+oval(40,17,4,21,'#c9a7a0')+oval(73,16,4,21,'#c9a7a0');
    else if(tanuki)art+=dot(35,33,13,coat)+dot(79,33,13,coat)+dot(35,33,7,'#534b44')+dot(79,33,7,'#534b44');
    else art+=path('M29 49 26 9Q41 13 48 31L69 31Q78 15 91 10L86 51Z',coat)+path('m31 18 3 24 10-10m30 1 12-15-4 25Z',spitz?'#d6beb6':fox?'#6f7f9c':'#a76d58');
    art+=oval(57,51,32,28,coat);
    if(spitz)art+=path('M28 43 20 53 28 57 21 65 33 68 30 77 44 75 49 84 58 77 69 83 74 74 88 74 83 65 96 60 87 53 93 45 83 43 80 65Q57 83 34 63Z','#faf9f3')+line('m32 69 9-1m33 0 8-5','#d6ddde',1.3);
    if(cat)art+=path('M27 36Q37 20 53 25L48 51 30 55Z','#bd845b')+path('M67 25Q87 29 89 46L73 47Z','#44434a')+path('M76 68Q96 72 89 92L76 88Z','#bd845b');
    if(tanuki)art+=oval(41,51,16,10,'#463e38')+oval(72,51,16,10,'#463e38');
    art+=oval(57,65,19,13,spitz?'#fffdf9':'#f5ebd8')+dot(43,49,3.2,'#2f3941')+dot(72,49,3.2,'#2f3941')+dot(44,48,1,'#fff')+dot(73,48,1,'#fff')+path('M52 60Q57 57 62 60L57 65Z','#354049')+line('m57 65v4m0-1q-5 5-9 0m9 0q5 5 9 0','#46515a',1.5);
    if(spitz)art+=path('M53 72q4 3 8 0v5q-4 6-8 0Z','#c88c88');
    if(fox)art+=path('M76 34a8 8 0 1 1-7-11 8 8 0 0 0 7 11Z','#d5c389')+line('M38 78q22 15 42-2','#8d9eb7',3)+dot(59,87,4,'#d5c389');
    art+=oval(42,106,14,7,fox?'#7687a5':coat)+oval(77,106,14,7,fox?'#7687a5':coat)+line('m38 105v4m6-4v4m28-4v4m6-4v4',light,1.3);
    return art;
  }
  const palettes={evergreen:['#416c4e','#244534','#c5ce94'],grove:['#4f8067','#b7c6a3','#eee2c9'],bridge:['#b38359','#77573f','#e6c899'],summit:['#7194ad','#3b576e','#edf1ea'],sakura:['#e6adc1','#a96180','#fff1eb'],midnight:['#444763','#272e47','#b4bee5'],skyline:['#354f60','#233644','#e7bf7b'],hunny:['#c8493d','#993b33','#edbf62'],varsity:['#426654','#284b3a','#f0e3cb'],'cable-knit':['#d4bea0','#a68b69','#f1e5cf']};
  function svg(value,{portrait=false,petOnly=false}={}){
    const v=rules.normalize(value),skin=rules.colour('skin',v.skin),dye=rules.choices.hairColor.find(item=>item.id===v.hairColor),eye=rules.colour('eyes',v.eyes),id=++serial;
    const hair=dye.tones?`url(#ma-avatar-dye-${id})`:dye.value;
    const longHair=['long','waves','bob','coils','ponytail','braids','ribbon-waves','flow'].includes(v.hair);
    const definitions=(dye.tones?`<linearGradient id="ma-avatar-dye-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="${longHair?155:86}">${dye.tones.map((colour,i)=>`<stop offset="${i*50}%" stop-color="${colour}"/>`).join('')}</linearGradient>`:'')+(v.pants==='aurora'?`<linearGradient id="ma-avatar-pants-${id}" gradientUnits="userSpaceOnUse" x1="84" y1="244" x2="154" y2="307"><stop stop-color="#6abeb4"/><stop offset=".5" stop-color="#a89fdd"/><stop offset="1" stop-color="#d6b8c9"/></linearGradient>`:'');
    const [cloth,edge,accent]=palettes[v.outfit]||[rules.colour('outfitColor',v.outfitColor),'#344454','#f2e9d9'];
    const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
    const stroke=(d,c='#283441',w=2.4)=>path(d,'none',`stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`);
    const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
    const petal=(x,y)=>`<g transform="translate(${x} ${y})">${[0,72,144,216,288].map(a=>`<ellipse cy="-5" rx="3.6" ry="6" fill="#ffeef1" transform="rotate(${a})"/>`).join('')}${circle(0,0,2.2,'#d2a352')}</g>`;
    let back='';
    if(['long','waves','bob'].includes(v.hair))back=path('M73 80Q64 26 121 25Q175 27 168 89L179 157Q148 166 144 147H93Q83 166 63 151Z',hair);
    if(v.hair==='bun')back=circle(120,28,23,hair)+path('M76 69Q72 23 120 28Q169 27 165 74Z',hair);
    if(v.hair==='coils')back=[[-32,0],[-16,-16],[5,-18],[28,-10],[42,10],[-42,16]].map(([x,y])=>circle(120+x,58+y,21,hair)).join('');
    if(v.hair==='ponytail')back=path('M145 42Q180 18 183 67L180 133Q185 155 166 166L157 153Q171 130 162 96L149 65Z',hair);
    if(v.hair==='braids')back=path('M73 76Q65 27 119 27Q173 27 168 78L159 125H81Z',hair)+[0,1,2,3].map(i=>`<ellipse cx="${79-i*2}" cy="${118+i*15}" rx="12" ry="13" fill="${hair}"/><ellipse cx="${161+i*2}" cy="${118+i*15}" rx="12" ry="13" fill="${hair}"/>`).join('')+stroke('M65 172h16m78 0h16','#b2787d',5);
    if(v.hair==='ribbon-waves')back=path('M71 74Q64 23 120 25Q176 23 169 76Q186 90 175 110Q192 127 177 145Q184 166 158 178L148 160 91 160Q76 179 60 161Q49 149 65 130Q48 107 65 95Z',hair)+stroke('M67 123q-9 15 8 26m98-38q-11 14 1 29','#ffffff',1);
    if(v.hair==='flow')back=path('M75 65Q65 24 120 27Q174 23 166 71L177 136 160 132 150 145H91L81 132 65 139Z',hair);
    let front='';
    if(v.hair==='crop')front=path('M76 75 76 52Q82 25 122 29Q159 28 168 57L164 77 155 57 140 60 126 53 111 61 94 56 83 78Z',hair);
    if(v.hair==='sweep')front=path('M75 82Q65 38 109 28Q154 20 168 54L164 81 154 64Q147 68 140 57Q120 73 87 67L82 88Z',hair)+stroke('M93 52Q118 51 135 40','#ffffff',1.2);
    if(v.hair==='bob')front=path('M73 94Q62 34 117 27Q174 26 169 94L157 97 155 57Q126 70 97 60L86 98Z',hair);
    if(v.hair==='long')front=path('M72 108Q62 40 111 28Q150 16 168 55L174 142 157 130 155 58Q141 62 124 48Q112 63 88 68L84 136 69 146Z',hair);
    if(v.hair==='waves')front=path('M72 108Q58 80 72 62Q64 42 89 31Q106 17 127 28Q151 23 164 41Q182 62 166 83L162 114 151 94 158 64Q139 70 127 48Q118 70 88 66L84 91 90 113 77 132Z',hair);
    if(v.hair==='bun')front=path('M75 89Q67 36 114 32Q168 27 166 80L156 88 153 56Q122 72 87 62L84 91Z',hair);
    if(v.hair==='coils')front=[[-34,2],[-20,-12],[-2,-16],[17,-12],[34,0]].map(([x,y])=>circle(120+x,61+y,15,hair)).join('');
    if(v.hair==='shaved')front=path('M78 71Q79 35 120 34Q160 34 163 70L155 58Q120 32 84 65Z',hair,'opacity=".55"');
    if(v.hair==='curtains')front=path('M73 97Q59 31 117 27Q173 23 168 97L155 102 155 65Q130 66 120 45Q111 68 86 72L84 101Z',hair)+stroke('M118 38Q101 46 82 66m43-29q22 8 33 26','#ffffff',1);
    if(v.hair==='quiff')front=path('M76 84Q63 52 84 36Q97 31 105 17Q114 33 131 19Q144 28 147 37Q174 38 165 83L156 74 154 53Q118 70 88 57L84 89Z',hair)+stroke('M88 47Q109 48 133 34','#ffffff',1.2);
    if(v.hair==='short-curls')front=path('M75 90V57Q78 30 120 30Q164 31 166 63L165 90 156 78 155 61H86L84 87Z',hair)+[[-31,3],[-19,-9],[-3,-13],[14,-9],[30,3]].map(([x,y])=>circle(120+x,54+y,13,hair)).join('');
    if(v.hair==='ponytail')front=path('M73 87Q64 31 115 28Q169 25 167 85L156 80 154 57Q124 70 90 61L83 93Z',hair)+stroke('M89 50Q117 50 146 38','#ffffff',1);
    if(v.hair==='braids')front=path('M74 88Q68 30 118 29Q170 28 166 86L155 85 153 54Q135 63 120 42Q107 63 87 64L84 91Z',hair)+stroke('M120 33v9','#ffffff',1.1);
    if(v.hair==='pixie')front=path('M75 91 70 66Q72 32 111 27Q153 20 169 53L164 86 156 68 152 54 131 73 135 55 112 72 110 54 91 76 85 67 82 95Z',hair);
    if(v.hair==='textured-fade')front=path('M77 90V55Q82 27 122 27Q160 28 164 60V89L155 73V55H86V77Z',hair,'opacity=".55"')+[[-30,1],[-22,-10],[-6,-15],[10,-16],[26,-9],[32,5],[12,6],[-9,3]].map(([x,y])=>circle(120+x,50+y,12,hair)).join('')+stroke('M81 68v7m78-9v7',hair,2);
    if(v.hair==='ribbon-waves')front=path('M71 99Q62 38 111 28Q155 20 168 53L169 96 157 84 154 55Q132 69 117 46Q111 68 86 68L83 96 88 120 76 133Q66 113 71 99Z',hair)+path('M157 53q-18-25-23-12-3 13 21 18-13 20 1 23 13-1 6-23 24-2 17-15-7-9-22 9Z','#d194a7')+circle(158,58,4,'#f4cbd5');
    if(v.hair==='side-part')front=path('M75 88 74 60Q76 26 119 28Q158 26 166 59L164 89 155 78 153 55Q143 51 139 41Q121 62 86 63L84 87Z',hair)+stroke('M139 39q-13 7-18 16',skin,1.4)+stroke('M87 48q23 3 38-7','#fff',.9);
    if(v.hair==='french-crop')front=path('M77 87V55Q77 32 120 32Q162 32 163 55V87L155 78V62H85V78Z',hair,'opacity=".65"')+path('M77 59Q73 31 120 31Q166 32 164 60L153 65 141 61 127 66 113 62 98 67 87 62Z',hair)+stroke('m89 42 4 10m12-14 3 13m12-14v14m13-12-2 12m14-9-3 9','#fff',.8);
    if(v.hair==='messy-fringe')front=path('M75 90 70 58 79 51 74 39 90 39 96 26 108 32 122 20 127 31 145 26 146 39 163 39 164 53 172 59 165 90 155 78 155 62 141 82 145 59 126 78 125 57 107 82 108 61 91 72 85 68 83 91Z',hair)+stroke('m94 45 16-6m17 4 14-6','#fff',1);
    if(v.hair==='slick-back')front=path('M76 89Q65 44 91 31Q118 18 146 31Q174 43 165 89L155 81 151 59Q120 48 87 61L85 85Z',hair)+['M85 53Q86 32 107 31','M96 52Q101 30 120 28','M111 51Q121 31 132 32','M127 51Q139 35 144 40'].map(d=>stroke(d,'#fff',1)).join('');
    if(v.hair==='flow')front=path('M74 105Q60 76 74 49Q86 24 118 28Q151 22 168 55Q179 79 164 108L154 98 160 79 152 54Q144 64 130 66L136 50Q123 70 87 70L81 95 90 119 76 128Z',hair)+stroke('M90 51Q112 54 128 38M156 55q14 19 4 34','#fff',1);
    if(v.hair==='sculpted-pompadour')front=path('M76 88V52Q77 21 116 27Q131 12 151 22Q180 37 165 66L164 88 156 79 151 59Q119 70 86 59L84 88Z',hair)+path('M84 57Q114 65 153 51L155 64Q120 77 84 66Z','#000','opacity=".18"')+['M83 45Q87 30 115 34Q141 17 155 30','M88 49Q109 51 141 32','M97 55Q130 53 154 38'].map(d=>stroke(d,'#fff',1.1)).join('')+stroke('M80 71v9m80-10v10',hair,3);
    if(v.hair==='braided-undercut'){
      front=path('M77 86V59Q77 33 120 31Q163 31 163 60V87L155 80 152 62H87L85 83Z',hair,'opacity=".48"')+path('M86 56Q91 24 120 25Q151 26 155 55Q120 67 86 56Z',hair);
      for(let row=0;row<3;row++)for(let i=0;i<5;i++){const x=92+i*11,y=40+row*8-Math.sin(i/4*Math.PI)*9;front+=path(`m${x} ${y}q6-5 11 1l-6 5Z`,hair)+stroke(`m${x+1} ${y} 5 4 5-3`,'#fff',.8);}
      front+=circle(158,56,10,hair)+stroke('m159 49-4 14','#c5b384',3)+stroke('M80 70h3m74 0h4',hair,2);
    }
    let garment=path('M99 144 79 150Q64 154 56 183L48 226Q57 234 70 232L79 200 76 244Q120 255 165 244L161 200 171 232Q184 233 191 226L181 181Q175 157 157 151L141 144Z',cloth)
      +path('M102 140H138L141 151Q120 167 98 151Z',skin)+stroke('M78 193 73 226M161 193 168 226',edge,1.7)
      +stroke('M85 240Q121 248 157 240',edge,1.5);
    if(v.outfit==='everyday')garment+=stroke('M96 150Q120 174 144 150',accent,4)+path('M142 181h13v13h-13Z',accent,'opacity=".65"');
    if(v.outfit==='sport')garment+=path('m81 154-9 49 12 2 15-54m62 3 8 49-12 2-15-54',accent)+stroke('M120 159V243',edge,3)+circle(120,174,2,accent);
    if(v.outfit==='linen')garment+=path('m101 143 19 16-13 12-14-19m46-9-19 16 13 12 14-19',accent)+stroke('M120 159V245',edge,1.5)+[179,196,213,230].map(y=>circle(124,y,1.7,edge)).join('');
    if(['crewneck','cable-knit','hunny'].includes(v.outfit))garment+=stroke('M98 151Q120 171 143 151',edge,6)+stroke('M78 240Q120 249 163 240',edge,7)+stroke('m51 224 18 6m104 0 16-6',edge,7);
    if(v.outfit==='crewneck')garment+=stroke('m104 165 16 10 15-10',accent,1.5);
    if(v.outfit==='striped')garment+=stroke('M98 151Q120 169 142 151',accent,4)+[180,198,216,234].map(y=>stroke(`M81 ${y}H160`,accent,6)).join('');
    if(v.outfit==='varsity')garment+=path('M79 151Q66 155 56 183L48 226 69 232 83 190 89 157Zm80 0q16 6 22 30l10 45-20 6-14-42-8-33Z',accent)+stroke('M96 146Q120 169 144 146',edge,7)+stroke('M120 161V245',accent,3)+[179,198,217,236].map(y=>circle(126,y,2,accent)).join('')+path('m93 177 8 18H85Zm0 6-3 7h6Z',accent)+stroke('M78 238H162',accent,3);
    if(v.outfit==='cable-knit')garment+=[91,120,149].map(x=>stroke(`M${x} 172q-9 8 0 16t0 16 0 16 0 16m0-64q9 8 0 16t0 16 0 16 0 16`,edge,1.6)).join('')+stroke('M106 175v60m28-60v60',accent,2);
    if(v.outfit==='hunny')garment+=circle(120,197,20,accent)+circle(105,181,8,accent)+circle(135,181,8,accent)+circle(114,195,2,edge)+circle(126,195,2,edge)+`<ellipse cx="120" cy="203" rx="7" ry="5" fill="#f7da91"/>`+path('m117 201 3 4 3-4Z',edge)+stroke('M115 213q5 3 10 0',edge,1.3);
    if(v.outfit==='grove')garment+=path('m99 144 21 49 22-49-14 12h-15Z',accent)+stroke('M99 148 116 193V246M141 149 124 192V246',edge,3)+[204,220,236].map(y=>circle(120,y,2,accent)).join('');
    if(v.outfit==='bridge')garment+=path('m100 144 20 14-10 14-15-20m44-8-19 14 10 14 15-20',accent)+stroke('M120 160V246',edge,3)+path('M84 184h23v20H84Zm49 0h23v20h-23Z',edge)+stroke('M86 188h19m30 0h19',accent,1.5);
    if(v.outfit==='summit')garment+=path('M94 143q26 20 52 0l-3 16q-23 18-46 0Z',accent)+stroke('M120 165V247',edge,3)+stroke('M83 181H157M81 207H161',accent,2)+path('m137 174 6-9 6 9Z',accent);
    if(v.outfit==='sakura')garment+=path('m97 145 23 32 24-32-9 39 8 62h-24l-8-63-23-30Z',accent)+stroke('M92 153 120 181 134 245',edge,2.5)+petal(148,184)+petal(150,205);
    if(v.outfit==='midnight')garment+=path('M89 151q-1-25 30-27 32 1 32 29l-14 13-18-11-17 10Z',edge)+stroke('m107 164-2 30m26-30 3 30',accent,2)+path('M98 211q22-10 43 0l3 21H95Z',edge)+path('M149 181a9 9 0 1 1-9-12 9 9 0 0 0 9 12Z',accent);
    if(v.outfit==='skyline')garment+=path('m97 144 22 13 23-13 3 13-26 15-25-15Z',edge)+stroke('M119 170V245',accent,2.5)+stroke('M80 238H161',accent,4)+path('M87 178h17v18H87Z',edge)+stroke('M91 182v10m7-10v10',accent,2)+stroke('m137 215 16-10',accent,2);
    if(v.outfit==='evergreen')garment+=path('m99 143 21 15 21-15 4 13-25 17-25-17Z',edge)+stroke('M120 173V246',accent,2)+path('M83 181h25v22H83Zm50 0h25v22h-25Z',edge)+stroke('M86 186h19m31 0h19',accent,1.5)+stroke('m96 209-6 17m54-17 6 17',edge,3)+path('M144 168q-10-12-8-18 10 1 10 10 8-10 14-6-2 10-16 14Z',accent)+stroke('M146 162v10',edge,1.2);
    let hat='';
    if(['trail-cap','skyline'].includes(v.headwear)){
      const colour=v.headwear==='skyline'?'#243c4d':'#6c826c',trim=v.headwear==='skyline'?'#e7bf7b':'#dfd0ae';
      hat=path('M74 67Q72 27 117 24Q158 23 168 62L165 70Q126 63 74 67Z',colour)+path('M99 62Q138 48 178 68Q187 78 171 78L119 72Z',colour)+stroke('M100 64Q139 54 176 70',trim,2)+path('m100 43 7-8 7 8-7 5Z',trim);
    }
    if(v.headwear==='summit-beanie')hat=path('M72 69Q74 24 118 22Q159 20 168 65Z','#bd8974')+path('M73 56Q120 42 168 55V77Q118 66 73 78Z','#d9ab95')+stroke('M87 57v16m12-20v18m13-20v18m13-20v18m13-18v18m13-16v17','#aa7866',1.8)+circle(120,22,10,'#d9ab95');
    if(v.headwear==='sakura')hat=petal(154,61)+petal(165,74)+stroke('m149 70 7 8','#c59950',2);
    if(v.headwear==='midnight')hat=path('M158 51a11 11 0 1 1-9-17 11 11 0 0 0 9 17Z','#e8dcad')+circle(168,56,2,'#e8dcad');
    if(v.headwear==='hunny')hat=stroke('M77 66Q79 32 119 32Q157 32 163 66','#b78432',7)+circle(83,39,17,'#e4b44e')+circle(157,39,17,'#e4b44e')+circle(83,39,10,'#f5d991')+circle(157,39,10,'#f5d991');
    if(v.headwear==='studio-headphones')hat=stroke('M69 93V67Q70 18 121 17Q172 18 172 69V94','#293744',9)+stroke('M69 68Q72 21 120 21Q168 21 172 69','#92b9bf',3)+`<rect x="63" y="79" width="16" height="37" rx="8" fill="#80a4ad"/><rect x="162" y="79" width="16" height="37" rx="8" fill="#80a4ad"/>`+stroke('M70 87v22m99-22v22','#d4e5e2',2);
    if(v.headwear==='evergreen')hat=stroke('M78 66Q118 34 163 65','#b9bb74',2)+[0,1,2,3,4,5,6].map(i=>{const x=81+i*13,y=59-Math.sin(i/6*Math.PI)*12;return path(`M${x} ${y}q-11-3-9-14 12 2 12 12Z`,i%2?'#c4ce91':'#83a572')+path(`M${x+3} ${y+2}q6-9 13-4-3 9-13 4Z`,'#70936b');}).join('');
    let accessory='';
    if(v.accessory==='round-glasses')accessory=circle(102,90,15,'none','stroke="#39424f" stroke-width="3"')+circle(138,90,15,'none','stroke="#39424f" stroke-width="3"')+stroke('M117 88q3-3 6 0M86 87l-10-4m78 4 10-4','#39424f',3);
    if(v.accessory==='trail-scarf')accessory=path('M96 132Q120 146 145 132L143 151Q119 164 96 149Z','#cfaa6d')+path('m126 150 12 2 7 40-17 4Z','#bd8f53')+stroke('m130 185 12-3m-12 10 13-3','#ead4ad',2);
    if(v.accessory==='atlas-pin')accessory=path('m148 179 8 5v10l-8 5-8-5v-10Z','#e6bf67')+stroke('m144 191 4-7 4 7m-7-2h6','#65512c',1.5);
    if(v.accessory==='hunny')accessory=stroke('M99 147Q106 158 120 162Q135 158 142 147','#edcd76',2)+path('M115 162h10l1 7q0 5-6 5t-6-5Z','#c19149')+path('M114 163h12v3q-3-2-5 1t-4-1-3 0Z','#f6d073')+stroke('M115 161h10','#f6d073',2)+circle(120,169,1.6,'#ffe5a3');
    const trouserPalette={classic:['#364553','#202c3a','#84949e'],denim:['#53738d','#334f67','#a7b6bc'],chinos:['#c3a47c','#8b7358','#e0cbae'],joggers:['#626773','#424957','#b1b4bc'],trail:['#697a59','#43573f','#a3b48b'],cargo:['#93815f','#615940','#c3b18a'],alpine:['#3e5d70','#243e51','#95bac2'],pinstripe:['#343649','#222535','#a6adbd'],aurora:['#33354d','#23263b','#a89fdd'],sakura:['#b67d97','#85566f','#edbcd0'],midnight:['#3c3c59','#26283e','#b4b9dd'],skyline:['#354957','#22333f','#bda577'],evergreen:['#3f5b43','#263f30','#a5b683']};
    const [original,seam,trim]=trouserPalette[v.pants]||['#627286','#354553','#c8c8d5'],fabric=v.pantsColor==='original'?original:rules.colour('pantsColor',v.pantsColor);
    let trousers=path('M86 232h69l-4 74h-26l-5-50-6 50H88Z',fabric)+stroke('M121 255V237',seam,2);
    if(['denim','chinos','skyline','pinstripe'].includes(v.pants))trousers+=stroke('M90 243q3 16 16 16m43-16q-3 16-13 16',seam,1.4)+stroke('m94 264-1 36m51-36 1 36',trim,1.1);
    if(v.pants==='denim')trousers+=stroke('M89 299h25m13 0h24',trim,5)+stroke('M92 301h19m20 0h17',seam,1.2);
    if(['joggers','aurora','midnight'].includes(v.pants))trousers+=stroke('M88 300h25m14 0h24',seam,7)+stroke('m114 245-3 18m15-18 3 18',trim,1.5);
    if(['trail','cargo','evergreen'].includes(v.pants))trousers+=path('M88 263h21v19H89Zm43 0h21l-1 19h-20Z',seam)+stroke('M89 267h18m26 0h17',trim,1.5)+circle(98,270,1.4,trim)+circle(141,270,1.4,trim);
    if(v.pants==='alpine')trousers+=path('m90 268 21 2-1 17-21-2Zm40 2 21-2 1 17-21 2Z',seam)+stroke('m90 292 20 2m20 0 21-2',trim,2.6);
    if(v.pants==='pinstripe')trousers+=[96,103,109,132,139,146].map(x=>stroke(`M${x} 253v46`,trim,.8)).join('')+stroke('M92 302h19m19 0h19',seam,3);
    if(v.pants==='aurora')trousers+=path('m87 245 8 1-1 51-6-1Zm58 1 8-1-2 51-6 1Z',`url(#ma-avatar-pants-${id})`)+stroke('M90 302h22m17 0h19','#b7e1db',1.6);
    if(v.pants==='sakura')trousers+=stroke('m95 249-3 51m12-51-1 51m33-51 1 51m9-51 1 51',trim,1.5);
    if(v.pants==='midnight')trousers+=path('M146 268a5 5 0 1 1-4-7 5 5 0 0 0 4 7Z',trim);
    if(['a-line','pleated-skirt','starfall-skirt'].includes(v.pants)){
      trousers=path('M93 260h20l-2 47H94Zm35 0h20l-1 47h-17Z',skin)+path('M85 231h73l17 55q-53 16-108 0Z',fabric)+stroke('M85 239h73',seam,3);
      if(v.pants!=='a-line')trousers+=stroke('m91 247-9 36m21-36-4 40m21-40v42m17-42 5 40m7-40 10 36',trim,1.6);
      if(v.pants==='starfall-skirt')trousers+=path('M71 276q10 14 20 2 10 14 20 3 10 13 20 0 10 12 20-3 10 12 20-2l4 10q-53 16-108 0Z',seam)+[87,108,131,155].map((x,i)=>path(`m${x} ${257+i%2*8} 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z`,'#f1d99a')).join('');
    }
    if(['day-dress','pinafore','meadow-dress','seigaiha-kimono'].includes(v.outfit)){
      trousers=path('M93 268h20l-2 39H94Zm35 0h20l-1 39h-17Z',skin);
      garment=path('M99 144 79 150Q64 154 56 183L48 226Q57 234 70 232L81 196 87 217 63 286Q119 303 178 286L152 217 160 196 171 232Q184 233 191 226L181 181Q175 157 157 151L141 144Z',cloth)+path('M102 140H138L141 151Q120 167 98 151Z',skin)+stroke('M97 151Q120 174 144 151',accent,4)+stroke('M85 217Q121 224 155 217',edge,3)+stroke('m90 233-13 49m27-45-5 49m40-49 7 49m5-53 13 49',accent,1.3);
      if(v.outfit==='pinafore')garment+=path('M80 151 98 145 98 178H142V146L159 153 155 218H86Z',edge)+path('M103 183h34v25h-34Z',cloth)+circle(92,171,3,accent)+circle(148,171,3,accent);
      if(v.outfit==='meadow-dress')garment+=path('m118 219-18-10q-11 9 1 16l17-2 4 18 7-4-6-15 20 3q9-10-3-16l-19 11Z',accent)+[80,100,142,162].map((x,i)=>stroke(`M${x} 278q-9-13 0-25m0 14-6-6m6 0 5-5`,'#e8dfbb',1.5)+circle(x-1,251+i%2*5,2,'#f9eee0')).join('')+stroke('M69 286Q120 301 173 286',accent,3);
      if(v.outfit==='seigaiha-kimono'){
        garment=path('M100 143 71 154 42 188 46 239 75 246 88 198 84 293Q120 303 160 293L151 198 166 246 195 239 198 188 169 154 140 143Z',cloth)+path('M103 140h34l2 13-18 20-21-21Z',skin)+path('m100 144 40 50-12 14-37-57m49-7-38 50 12 10 35-52Z','#e5dac2')+stroke('M99 151 137 196m3-45-32 46',edge,3)+path('M86 199h69v24H86Z','#b8a168')+stroke('M87 205h67m-66 12h67','#ead8a5',2)+path('M135 201h15v20h-15Z',edge)+stroke('m142 205v12','#ead8a5',2)+stroke('M121 224 115 295',edge,2)+stroke('m48 234 25 6m95 0 24-6',accent,3);
        for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=92+col*22,y=237+row*15;garment+=stroke(`M${x-8} ${y}a8 8 0 0 1 16 0m-13 0a5 5 0 0 1 10 0m-7 0a2 2 0 0 1 4 0`,'#ded5b9',1);}
      }
    }
    const companion=!portrait&&v.pet!=='none';
    if(petOnly)return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 120 140" aria-hidden="true">${petArt(v.pet)}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'34 8 172 178':companion?'0 0 320 340':'0 0 240 340'}" fill="none" aria-hidden="true">`+(definitions?`<defs>${definitions}</defs>`:'')
      +(!portrait?`<ellipse cx="120" cy="324" rx="49" ry="7" fill="#14212b" opacity=".12"/>`:'')+back
      +trousers
      +path('M87 299h28v21H77q-2-10 10-12Zm38 0h27l9 12q4 9-4 9h-32Z','#eee9dd')+stroke('M79 318h34m14 0h31','#9eaaa8',2)
      +path('M104 120h33l3 31q-21 14-39 0Z',skin)
      +path('M52 223 48 240q0 13 10 13 9-1 11-12l2-12m99-6 1 17q2 12 11 12 9-2 8-13l-2-15',skin)+garment
      +`<ellipse cx="76" cy="92" rx="8" ry="12" fill="${skin}"/><ellipse cx="164" cy="92" rx="8" ry="12" fill="${skin}"/><path d="M77 73Q77 33 120 33Q164 33 164 74V95Q161 132 121 142Q80 135 77 99Z" fill="${skin}"/>`
      +`<ellipse cx="92" cy="106" rx="9" ry="5" fill="#db857b" opacity=".28"/><ellipse cx="148" cy="106" rx="9" ry="5" fill="#db857b" opacity=".28"/>`
      +stroke('M94 77q8-5 16-1m20 0q8-4 16 1',dye.value,2.7)
      +`<ellipse cx="103" cy="91" rx="5.6" ry="6.5" fill="#faf5ee"/><ellipse cx="137" cy="91" rx="5.6" ry="6.5" fill="#faf5ee"/>`
      +circle(104,91,4,eye)+circle(136,91,4,eye)+circle(105,89,1.4,'#fff')+circle(137,89,1.4,'#fff')
      +stroke('m120 94-3 10 5 1','#6d493e',1.3)+stroke('M109 115q11 8 22-1','#623f36',2)+front+hat+accessory+(companion?`<g transform="translate(197 210)">${petArt(v.pet)}</g>`:'')+'</svg>';
  }
  function render(node,value,options){
    const picture=new DOMParser().parseFromString(svg(value,options),'image/svg+xml').documentElement;
    node.replaceChildren(document.importNode(picture,true));
  }
  return Object.freeze({svg,render});
});
