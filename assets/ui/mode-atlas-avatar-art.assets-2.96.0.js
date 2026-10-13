/* Original layered vector character. Every interpolated value comes from the
   bounded character catalogue; profile names and arbitrary markup never enter. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../app/mode-atlas-avatar-rules.js'));
  else root.ModeAtlasAvatarArt=factory(root.ModeAtlasAvatarRules);
})(typeof window!=='undefined'?window:globalThis,function(rules){
  'use strict';
  const palettes={grove:['#4f8067','#b7c6a3','#eee2c9'],bridge:['#b38359','#77573f','#e6c899'],summit:['#7194ad','#3b576e','#edf1ea'],sakura:['#e6adc1','#a96180','#fff1eb'],midnight:['#444763','#272e47','#b4bee5'],skyline:['#354f60','#233644','#e7bf7b']};
  function svg(value,{portrait=false}={}){
    const v=rules.normalize(value),skin=rules.colour('skin',v.skin),hair=rules.colour('hairColor',v.hairColor),eye=rules.colour('eyes',v.eyes);
    const [cloth,edge,accent]=palettes[v.outfit]||[rules.colour('outfitColor',v.outfitColor),'#344454','#f2e9d9'];
    const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
    const stroke=(d,c='#283441',w=2.4)=>path(d,'none',`stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`);
    const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
    const petal=(x,y)=>`<g transform="translate(${x} ${y})">${[0,72,144,216,288].map(a=>`<ellipse cy="-5" rx="3.6" ry="6" fill="#ffeef1" transform="rotate(${a})"/>`).join('')}${circle(0,0,2.2,'#d2a352')}</g>`;
    let back='';
    if(['long','waves','bob'].includes(v.hair))back=path('M73 80Q64 26 121 25Q175 27 168 89L179 157Q148 166 144 147H93Q83 166 63 151Z',hair);
    if(v.hair==='bun')back=circle(120,28,23,hair)+path('M76 69Q72 23 120 28Q169 27 165 74Z',hair);
    if(v.hair==='coils')back=[[-32,0],[-16,-16],[5,-18],[28,-10],[42,10],[-42,16]].map(([x,y])=>circle(120+x,58+y,21,hair)).join('');
    let front='';
    if(v.hair==='crop')front=path('M76 75 76 52Q82 25 122 29Q159 28 168 57L164 77 155 57 140 60 126 53 111 61 94 56 83 78Z',hair);
    if(v.hair==='sweep')front=path('M75 82Q65 38 109 28Q154 20 168 54L164 81 154 64Q147 68 140 57Q120 73 87 67L82 88Z',hair)+stroke('M93 52Q118 51 135 40','#ffffff',1.2);
    if(v.hair==='bob')front=path('M73 94Q62 34 117 27Q174 26 169 94L157 97 155 57Q126 70 97 60L86 98Z',hair);
    if(v.hair==='long')front=path('M72 108Q62 40 111 28Q150 16 168 55L174 142 157 130 155 58Q141 62 124 48Q112 63 88 68L84 136 69 146Z',hair);
    if(v.hair==='waves')front=path('M72 108Q58 80 72 62Q64 42 89 31Q106 17 127 28Q151 23 164 41Q182 62 166 83L162 114 151 94 158 64Q139 70 127 48Q118 70 88 66L84 91 90 113 77 132Z',hair);
    if(v.hair==='bun')front=path('M75 89Q67 36 114 32Q168 27 166 80L156 88 153 56Q122 72 87 62L84 91Z',hair);
    if(v.hair==='coils')front=[[-34,2],[-20,-12],[-2,-16],[17,-12],[34,0]].map(([x,y])=>circle(120+x,61+y,15,hair)).join('');
    if(v.hair==='shaved')front=path('M78 71Q79 35 120 34Q160 34 163 70L155 58Q120 32 84 65Z',hair,'opacity=".55"');
    let garment=path('M99 144 79 150Q64 154 56 183L48 226Q57 234 70 232L79 200 76 244Q120 255 165 244L161 200 171 232Q184 233 191 226L181 181Q175 157 157 151L141 144Z',cloth)
      +path('M102 140H138L141 151Q120 167 98 151Z',skin)+stroke('M78 193 73 226M161 193 168 226',edge,1.7)
      +stroke('M85 240Q121 248 157 240',edge,1.5);
    if(v.outfit==='everyday')garment+=stroke('M96 150Q120 174 144 150',accent,4)+path('M142 181h13v13h-13Z',accent,'opacity=".65"');
    if(v.outfit==='sport')garment+=path('m81 154-9 49 12 2 15-54m62 3 8 49-12 2-15-54',accent)+stroke('M120 159V243',edge,3)+circle(120,174,2,accent);
    if(v.outfit==='linen')garment+=path('m101 143 19 16-13 12-14-19m46-9-19 16 13 12 14-19',accent)+stroke('M120 159V245',edge,1.5)+[179,196,213,230].map(y=>circle(124,y,1.7,edge)).join('');
    if(v.outfit==='grove')garment+=path('m99 144 21 49 22-49-14 12h-15Z',accent)+stroke('M99 148 116 193V246M141 149 124 192V246',edge,3)+[204,220,236].map(y=>circle(120,y,2,accent)).join('');
    if(v.outfit==='bridge')garment+=path('m100 144 20 14-10 14-15-20m44-8-19 14 10 14 15-20',accent)+stroke('M120 160V246',edge,3)+path('M84 184h23v20H84Zm49 0h23v20h-23Z',edge)+stroke('M86 188h19m30 0h19',accent,1.5);
    if(v.outfit==='summit')garment+=path('M94 143q26 20 52 0l-3 16q-23 18-46 0Z',accent)+stroke('M120 165V247',edge,3)+stroke('M83 181H157M81 207H161',accent,2)+path('m137 174 6-9 6 9Z',accent);
    if(v.outfit==='sakura')garment+=path('m97 145 23 32 24-32-9 39 8 62h-24l-8-63-23-30Z',accent)+stroke('M92 153 120 181 134 245',edge,2.5)+petal(148,184)+petal(150,205);
    if(v.outfit==='midnight')garment+=path('M89 151q-1-25 30-27 32 1 32 29l-14 13-18-11-17 10Z',edge)+stroke('m107 164-2 30m26-30 3 30',accent,2)+path('M98 211q22-10 43 0l3 21H95Z',edge)+path('M149 181a9 9 0 1 1-9-12 9 9 0 0 0 9 12Z',accent);
    if(v.outfit==='skyline')garment+=path('m97 144 22 13 23-13 3 13-26 15-25-15Z',edge)+stroke('M119 170V245',accent,2.5)+stroke('M80 238H161',accent,4)+path('M87 178h17v18H87Z',edge)+stroke('M91 182v10m7-10v10',accent,2)+stroke('m137 215 16-10',accent,2);
    let hat='';
    if(['trail-cap','skyline'].includes(v.headwear)){
      const colour=v.headwear==='skyline'?'#243c4d':'#6c826c',trim=v.headwear==='skyline'?'#e7bf7b':'#dfd0ae';
      hat=path('M74 67Q72 27 117 24Q158 23 168 62L165 70Q126 63 74 67Z',colour)+path('M99 62Q138 48 178 68Q187 78 171 78L119 72Z',colour)+stroke('M100 64Q139 54 176 70',trim,2)+path('m100 43 7-8 7 8-7 5Z',trim);
    }
    if(v.headwear==='summit-beanie')hat=path('M72 69Q74 24 118 22Q159 20 168 65Z','#bd8974')+path('M73 56Q120 42 168 55V77Q118 66 73 78Z','#d9ab95')+stroke('M87 57v16m12-20v18m13-20v18m13-20v18m13-18v18m13-16v17','#aa7866',1.8)+circle(120,22,10,'#d9ab95');
    if(v.headwear==='sakura')hat=petal(154,61)+petal(165,74)+stroke('m149 70 7 8','#c59950',2);
    if(v.headwear==='midnight')hat=path('M158 51a11 11 0 1 1-9-17 11 11 0 0 0 9 17Z','#e8dcad')+circle(168,56,2,'#e8dcad');
    if(v.headwear==='studio-headphones')hat=stroke('M69 93V67Q70 18 121 17Q172 18 172 69V94','#293744',9)+stroke('M69 68Q72 21 120 21Q168 21 172 69','#92b9bf',3)+`<rect x="63" y="79" width="16" height="37" rx="8" fill="#80a4ad"/><rect x="162" y="79" width="16" height="37" rx="8" fill="#80a4ad"/>`+stroke('M70 87v22m99-22v22','#d4e5e2',2);
    let accessory='';
    if(v.accessory==='round-glasses')accessory=circle(102,90,15,'none','stroke="#39424f" stroke-width="3"')+circle(138,90,15,'none','stroke="#39424f" stroke-width="3"')+stroke('M117 88q3-3 6 0M86 87l-10-4m78 4 10-4','#39424f',3);
    if(v.accessory==='trail-scarf')accessory=path('M96 132Q120 146 145 132L143 151Q119 164 96 149Z','#cfaa6d')+path('m126 150 12 2 7 40-17 4Z','#bd8f53')+stroke('m130 185 12-3m-12 10 13-3','#ead4ad',2);
    if(v.accessory==='atlas-pin')accessory=path('m148 179 8 5v10l-8 5-8-5v-10Z','#e6bf67')+stroke('m144 191 4-7 4 7m-7-2h6','#65512c',1.5);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'34 8 172 178':'0 0 240 340'}" fill="none" aria-hidden="true">`
      +(!portrait?`<ellipse cx="120" cy="324" rx="49" ry="7" fill="#14212b" opacity=".12"/>`:'')+back
      +path('M86 232h69l-4 74h-26l-5-50-6 50H88Z','#364553')+stroke('M121 255V237','#202c3a',2)
      +path('M87 299h28v21H77q-2-10 10-12Zm38 0h27l9 12q4 9-4 9h-32Z','#eee9dd')+stroke('M79 318h34m14 0h31','#9eaaa8',2)
      +path('M104 120h33l3 31q-21 14-39 0Z',skin)
      +path('M52 223 48 240q0 13 10 13 9-1 11-12l2-12m99-6 1 17q2 12 11 12 9-2 8-13l-2-15',skin)+garment
      +`<ellipse cx="76" cy="92" rx="8" ry="12" fill="${skin}"/><ellipse cx="164" cy="92" rx="8" ry="12" fill="${skin}"/><path d="M77 73Q77 33 120 33Q164 33 164 74V95Q161 132 121 142Q80 135 77 99Z" fill="${skin}"/>`
      +`<ellipse cx="92" cy="106" rx="9" ry="5" fill="#db857b" opacity=".28"/><ellipse cx="148" cy="106" rx="9" ry="5" fill="#db857b" opacity=".28"/>`
      +stroke('M94 77q8-5 16-1m20 0q8-4 16 1',hair,2.7)
      +`<ellipse cx="103" cy="91" rx="5.6" ry="6.5" fill="#faf5ee"/><ellipse cx="137" cy="91" rx="5.6" ry="6.5" fill="#faf5ee"/>`
      +circle(104,91,4,eye)+circle(136,91,4,eye)+circle(105,89,1.4,'#fff')+circle(137,89,1.4,'#fff')
      +stroke('m120 94-3 10 5 1','#6d493e',1.3)+stroke('M109 115q11 8 22-1','#623f36',2)+front+hat+accessory+'</svg>';
  }
  function render(node,value,options){
    const picture=new DOMParser().parseFromString(svg(value,options),'image/svg+xml').documentElement;
    node.replaceChildren(document.importNode(picture,true));
  }
  return Object.freeze({svg,render});
});
