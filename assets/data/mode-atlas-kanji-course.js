/* Authored Mode Atlas foundations. A unit is a learning goal, not a JLPT claim.
   Shape notes are memory aids; dictionary words remain owned by KanjiContent. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModeAtlasKanjiCourse=factory();})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const definitions=[
    ['first-numbers','One, two, three','Read and recognise the first three numbers.','一二三'],
    ['people-size','People and size','Distinguish a person, big and small.','人大 小'.replace(/ /g,'')],
    ['sun-moon','Sun and moon','Connect 日 and 月 with day and moon.','日月'],
    ['landscape','A familiar landscape','Read tree, mountain and river.','木山川'],
    ['elements','Water, fire and earth','Connect three natural things with their shapes.','水火土'],
    ['four-six','Four to six','Read three more numbers without mixing their shapes.','四五六'],
    ['seven-nine','Seven to nine','Read seven, eight and nine in the taught forms.','七八九'],
    ['inside-outside','Inside and outside','Distinguish inside, outside, entering and leaving.','中外入出'],
    ['up-down','Above and below','Read above, below, left and right.','上下左右'],
    ['before-after','Before, after and now','Tell these time and position words apart.','前後今'],
    ['large-numbers','Counting further','Read ten, hundred, thousand and ten thousand.','十百千万'],
    ['directions','Four directions','Connect each direction with its written word.','東西南北'],
    ['family','Family words','Read mother, father and child.','母父子'],
    ['people','People around you','Read woman, man and friend.','女男友'],
    ['days-years','Days and years','Connect year, every day and morning with their words.','年毎午'],
    ['time-space','Time and parts','Read space, time, understand and half.','間時分半'],
    ['description','Describing things','Read long, high and white with their kana endings.','長高白'],
    ['money-country','Money and country','Read country, money and yen.','国金円'],
    ['movement','Go, come and rest','Keep the kana endings when reading these actions.','行来休'],
    ['life-school','Life and learning','Read born, student and school as whole words.','生学校'],
    ['books','Books and reading','Read book, read and write.','本読書'],
    ['communication','Seeing and speaking','Read see, hear and talk.','見聞話'],
    ['names-language','Names and language','Read teacher, name and Japanese.','先名語'],
    ['weather','The weather','Read weather and rain; notice repeated components.','天気雨'],
    ['travel','Vehicles and electricity','Read car and train as distinct words.','車電'],
    ['questions','What and who','Distinguish the two question words.','何誰'],
    ['daily-actions','Useful everyday words','Read eat, lose and stick with their endings.','食無貼'],
    ['all-right','A useful complete word','Read 大丈夫 as one word: all right.','丈']
  ];
  const units=definitions.map(([id,title,goal,chars],index)=>({id,title,goal,chars,index,level:5}));
  // A single teachable sense; broad dictionary senses stay in the library.
  const senses={
    日:'day',一:'one',国:'country',人:'person',年:'year',大:'big',十:'ten',二:'two',本:'book',中:'inside',長:'long',出:'leave',三:'three',時:'time',行:'go',見:'see',月:'moon',分:'understand',後:'after',前:'in front',生:'be born',五:'five',間:'space between',上:'above',東:'east',四:'four',今:'now',金:'money',九:'nine',入:'enter',学:'student',高:'high',円:'yen',子:'child',外:'outside',八:'eight',六:'six',下:'below',来:'come',気:'weather',小:'small',七:'seven',山:'mountain',話:'talk',女:'woman',北:'north',午:'morning',百:'hundred',書:'write',先:'teacher',名:'name',川:'river',千:'thousand',水:'water',半:'half',男:'man',西:'west',電:'train',無:'lose',校:'school',語:'Japanese',土:'soil',木:'tree',聞:'hear',食:'eat',車:'car',何:'what',南:'south',万:'ten thousand',毎:'every day',白:'white',天:'weather',母:'mother',火:'fire',右:'right',読:'read',友:'friend',左:'left',休:'rest',父:'father',雨:'rain',丈:'all right',誰:'who',貼:'stick'
  };
  const alternatives={大:['large'],月:['the moon'],後:['behind'],前:['before','in front of'],間:['between','interval'],上:['up','over'],下:['down','under','below'],高:['tall','expensive'],子:['children'],来:['to come'],川:['stream'],男:['male'],土:['earth','dirt'],聞:['listen'],万:['10000','10,000'],語:['Japanese language'],友:['friends'],休:['take a break','take a day off'],丈:['okay','ok','safe'],貼:['paste','attach'],生:['born']};
  const components={
    本:{parts:['木','一'],note:'Compare 木 and 本. The extra short line near the root distinguishes 本.'},
    休:{parts:['亻','木'],note:'The person-shaped left side and 木 make a useful picture of resting beside a tree.'},
    時:{parts:['日','寺'],note:'Notice 日 on the left. Use it as a reminder that this word is about time.'},
    間:{parts:['門','日'],note:'Look for 日 between the two sides of 門. Remember the space between.'},
    校:{parts:['木','交'],note:'木 is the left component. Learn 校 in 学校; a component alone does not tell you the whole word.'},
    読:{parts:['言','売'],note:'The speech component 言 appears on the left, as it does in 語 and 話.'},
    語:{parts:['言','吾'],note:'Find the speech component 言 on the left. Learn the complete word 日本語.'},
    話:{parts:['言','舌'],note:'Find the speech component 言 on the left. Keep す in 話す.'},
    聞:{parts:['門','耳'],note:'Look for 耳, the ear shape, inside 門. This is a remembering aid for hearing.'},
    電:{parts:['雨'],note:'The rain-shaped top also appears in 雨. Read 電車 as a whole word.'},
    学:{parts:['子'],note:'Look for 子 at the bottom. Connect the whole word 学生 with a student.'},
    男:{parts:['田','力'],note:'Notice the field-shaped top and 力 below. Their shapes help you remember 男.'}
  };
  const contrasts={人:{other:'入',note:'人 spreads from a higher meeting point; 入 has a short stroke meeting the longer stroke. Compare the starting strokes.'},入:{other:'人',note:'Compare the starting strokes of 入 and 人, then connect 入る with entering.'},土:{other:'士',note:'土 has the longer line at the bottom. 士 has the longer line at the top; you are only comparing its shape here.'},右:{other:'左',note:'右 contains 口; 左 contains 工. Look inside the lower part.'},左:{other:'右',note:'左 contains 工; 右 contains 口. Look inside the lower part.'},上:{other:'下',note:'In 上 the short stroke is above the long line; in 下 it is below.'},下:{other:'上',note:'In 下 the short stroke is below the long line; in 上 it is above.'},日:{other:'目',note:'日 has one inner horizontal line; 目 has two. Only 日 is tested in this unit.'}};
  return Object.freeze({units,senses,alternatives,components,contrasts,get:id=>units.find(unit=>unit.id===id),forChar:char=>units.find(unit=>unit.chars.includes(char))});
});
