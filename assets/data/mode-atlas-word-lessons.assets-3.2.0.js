/* Original beginner teaching sequences. Dictionary forms, ordinary expressions
   and original examples; these are learning aids, not a proficiency syllabus. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModeAtlasWordLessonsData=factory();})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const word=(written,reading,english,example,exampleTranslation)=>({written,reading,english,example,exampleTranslation});
  const production={
    polite:{prompt:'A shop assistant hands you your purchase. Thank them politely.',pattern:'ありがとうございます。',hint:'Use the polite expression you learned.',answers:['ありがとうございます']},
    drinks:{prompt:'You ordered tea earlier. Now ask for water politely.',pattern:'飲み物 + をください。',hint:'Name the drink, then add をください (o kudasai).',answers:['水をください','みずをください']},
    places:{prompt:'You need to leave. Ask where the exit is.',pattern:'場所 + はどこですか。',hint:'Name the place, then add はどこですか (wa doko desu ka).',answers:['出口はどこですか','でぐちはどこですか']},
    food:{prompt:'Ask for fish politely, using the request pattern.',pattern:'食べ物 + をください。',hint:'Name the food, then add をください (o kudasai).',answers:['魚をください','さかなをください']},
    time:{prompt:'A friend asks when you will go. Say “I will go tomorrow.”',pattern:'明日、行きます。',hint:'Tomorrow is あした; “will go” here is いきます.',answers:['明日行きます','あしたいきます']},
    shopping:{prompt:'You point to an item beside you. Ask how much it costs.',pattern:'これはいくらですか。',hint:'これ means this (near you); いくらですか asks the price.',answers:['これはいくらですか']}
  };
  // New contexts use the same taught words and patterns. These are original
  // editorial tasks; dictionary checks do not constitute educator approval.
  const reviewTasks={
    polite:[
      {prompt:'You are at a café and need the server’s attention. What do you say?',answers:['すみません'],hint:'Use the expression for getting someone’s attention.'},
      {prompt:'A stranger returns your dropped ticket. Thank them politely.',answers:['ありがとうございます'],hint:'Use the polite thank-you expression.'}
    ],
    drinks:[
      {prompt:'You are at a café. Ask for coffee politely.',answers:['コーヒーをください','こーひーをください'],hint:'Use the drink + をください. を is pronounced “o”.'},
      {prompt:'At breakfast, ask for milk politely.',answers:['牛乳をください','ぎゅうにゅうをください'],hint:'Use the drink + をください.'}
    ],
    places:[
      {prompt:'You are outside a museum. Ask where the entrance is.',answers:['入口はどこですか','いりぐちはどこですか'],hint:'Use the place + はどこですか. は is pronounced “wa”.'},
      {prompt:'You want to catch a train. Ask where the station is.',answers:['駅はどこですか','えきはどこですか'],hint:'Use the place + はどこですか.'}
    ],
    food:[
      {prompt:'At a food stall, ask for vegetables politely.',answers:['野菜をください','やさいをください'],hint:'Use the food + をください.'},
      {prompt:'At a bakery, ask for bread politely.',answers:['パンをください','ぱんをください'],hint:'Use the food + をください.'}
    ],
    time:[
      {prompt:'A friend asks when you will go to the shop. Say “I will go today.”',answers:['今日行きます','きょういきます'],hint:'Use the time word + 行きます (いきます).'},
      {prompt:'A friend asks when you will go to the station. Say “I will go tomorrow.”',answers:['明日行きます','あしたいきます','あすいきます'],hint:'Use the time word + 行きます (いきます).'}
    ],
    shopping:[
      {prompt:'An item is beside the shop assistant, away from you. Ask how much that costs.',answers:['それはいくらですか'],hint:'それ refers to something near the listener.'},
      {prompt:'You have bought groceries and need a bag. Ask for one politely.',answers:['袋をください','ふくろをください'],hint:'Use the item + をください.'}
    ]
  };
  return [
    {id:'polite',title:'Make a polite connection',outcome:'Get someone’s attention, respond and say thank you.',note:'すみません can get someone’s attention or express an apology. お願いします is a polite request for help or a service; it does not replace every English “please”.',words:[
      word('すみません','すみません','excuse me; I am sorry','すみません。駅はどこですか。','Excuse me. Where is the station?'),
      word('ありがとうございます','ありがとうございます','thank you (polite)','ありがとうございます。','Thank you.'),
      word('お願いします','おねがいします','please (a polite request)','よろしくお願いします。','I look forward to working with you. (A conventional greeting when beginning a relationship.)'),
      word('はい','はい','yes; an acknowledgement','はい、わかりました。','Yes, I understand.'),
      word('いいえ','いいえ','no','いいえ、ちがいます。','No, that is not right.')],
      transfer:{prompt:'You need to get a station attendant’s attention. Which expression fits?',choices:['すみません。','ありがとうございます。','いいえ。'],answer:0,explanation:'すみません politely gets someone’s attention. Thank them afterwards with ありがとうございます。'}},
    {id:'drinks',title:'Ask for a drink',outcome:'Recognise five drinks and ask for one politely.',note:'Use the drink + をください to ask for it. The particle を is pronounced “o”. Read the whole phrase, not just the individual characters.',words:[
      word('水','みず','water','水をください。','Water, please.'),word('お茶','おちゃ','tea','お茶を飲みます。','I drink tea.'),word('コーヒー','こーひー','coffee','コーヒーをください。','Coffee, please.'),word('牛乳','ぎゅうにゅう','milk','牛乳を飲みます。','I drink milk.'),word('ジュース','じゅーす','juice','ジュースをください。','Juice, please.')],
      transfer:{prompt:'Ask for tea politely.',choices:['牛乳をください。','お茶をください。','水をください。'],answer:1,explanation:'お茶 means tea. Adding をください makes the request: お茶をください。'}},
    {id:'places',title:'Find your way',outcome:'Recognise a station, entrances, exits and two directions.',note:'Place + はどこですか asks where that place is. The particle は is pronounced “wa”. Signs often use kanji without a full sentence.',words:[
      word('駅','えき','station','駅はどこですか。','Where is the station?'),word('入口','いりぐち','entrance','入口はここです。','The entrance is here.'),word('出口','でぐち','exit','出口はあそこです。','The exit is over there.'),word('右','みぎ','right','右に曲がります。','Turn right.'),word('左','ひだり','left','左に曲がります。','Turn left.')],
      transfer:{prompt:'You want to leave a building. Which sign should you look for?',choices:['入口','駅','出口'],answer:2,explanation:'出口 means exit. 入口 is the entrance, and 駅 is a station.'}},
    {id:'food',title:'Recognise food on a menu',outcome:'Identify rice, bread, fish, meat and vegetables.',note:'ご飯 can mean cooked rice or a meal, depending on context. メニュー is “menu”. A word’s meaning depends on how it is used.',words:[
      word('ご飯','ごはん','cooked rice; a meal','ご飯を食べます。','I eat rice / have a meal.'),word('パン','ぱん','bread','パンを買います。','I buy bread.'),word('魚','さかな','fish','魚を食べます。','I eat fish.'),word('肉','にく','meat','肉を買います。','I buy meat.'),word('野菜','やさい','vegetables','野菜を食べます。','I eat vegetables.')],
      transfer:{prompt:'Which word on a shopping list means vegetables?',choices:['野菜','魚','パン'],answer:0,explanation:'野菜 means vegetables. 魚 is fish and パン is bread.'}},
    {id:'time',title:'Talk about when',outcome:'Distinguish today, tomorrow and three parts of the day.',note:'今日 and 明日 are read as whole words. You cannot reliably build きょう or あした by giving each character its usual isolated reading.',words:[
      word('今日','きょう','today','今日は休みです。','Today is a day off.'),word('明日','あした','tomorrow','明日、行きます。','I will go tomorrow.'),word('朝','あさ','morning','朝、ご飯を食べます。','I eat a meal in the morning.'),word('昼','ひる','daytime; noon','昼に会いましょう。','Let’s meet at noon.'),word('夜','よる','night; evening','夜、本を読みます。','I read a book at night.')],
      transfer:{prompt:'A friend writes 明日、会いましょう。 When do they want to meet?',choices:['Today','Tomorrow','At night'],answer:1,explanation:'明日 means tomorrow. 会いましょう means “let’s meet”.'}},
    {id:'shopping',title:'Make a small purchase',outcome:'Point to an item, ask its price and recognise a bag.',note:'これ refers to something near you; それ refers to something near the person you are speaking to. いくらですか asks how much something costs.',words:[
      word('これ','これ','this (near the speaker)','これをください。','This one, please.'),word('それ','それ','that (near the listener)','それは何ですか。','What is that?'),word('いくら','いくら','how much (price)','これはいくらですか。','How much is this?'),word('円','えん','yen','百円です。','It is one hundred yen.'),word('袋','ふくろ','bag','袋をください。','A bag, please.')],
      transfer:{prompt:'Ask the price of something beside you.',choices:['袋をください。','それは何ですか。','これはいくらですか。'],answer:2,explanation:'これはいくらですか asks “How much is this?” The other choices ask for a bag or ask what something is.'}}
  ].map(unit=>Object.freeze({...unit,production:Object.freeze(production[unit.id]),reviewTasks:Object.freeze(reviewTasks[unit.id].map(Object.freeze)),words:Object.freeze(unit.words.map(Object.freeze))}));
});
