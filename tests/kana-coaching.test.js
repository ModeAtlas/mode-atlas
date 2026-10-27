const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function content(){
  const root={};root.window=root;
  const context=vm.createContext(root);
  for(const file of ['data/mode-atlas-kana-data','app/mode-atlas-japanese','data/mode-atlas-kana-coaching']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),context);
  }
  return {data:root.ModeAtlasKanaData,coaching:root.ModeAtlasKanaCoaching,japanese:root.ModeAtlasJapanese};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('every canonical Kana unit has specific teaching, including every later row',()=>{
  const {data,coaching}=content();
  const forbidden=/Watch the stroke order\. Trace the shape once|Look at the shape and say the reading once|No teaching note/;
  for(const kana of data.collections.all){
    const lesson=coaching.teach(kana);
    assert.ok(lesson,'Missing teaching: '+kana);
    for(const field of ['sound','shape','stroke']){
      assert.equal(typeof lesson[field],'string',kana+' '+field);
      assert.ok(lesson[field].length>20,kana+' has a non-substantive '+field);
      assert.doesNotMatch(lesson[field],forbidden,kana+' has generic '+field);
    }
    assert.ok(lesson.parts.length>0,kana+' has no structural demonstration');
    assert.ok(Object.isFrozen(lesson));
    assert.ok(Object.isFrozen(lesson.parts));
  }
  const basic=[...data.collections.hiragana,...data.collections.katakana];
  assert.equal(new Set(basic.map(kana=>coaching.teach(kana).shape)).size,basic.length,'Basic forms need individual visual cues');
  assert.equal(coaching.teach('漢'),null);
  assert.equal(coaching.teach(''),null);
});

test('derived forms preserve their specific base, marks, size and pronunciation differences',()=>{
  const {coaching}=content();
  assert.deepEqual(plain(coaching.teach('が').parts),['か','゛']);
  assert.deepEqual(plain(coaching.teach('パ').parts),['ハ','゜']);
  assert.match(coaching.teach('が').shape,/か.*が.*two short/);
  assert.match(coaching.teach('パ').shape,/small circle/);
  assert.deepEqual(plain(coaching.teach('きゃ').parts),['き','ゃ']);
  assert.match(coaching.teach('きゃ').sound,/one beat.*きや.*two beats/);
  assert.match(coaching.teach('ティ').sound,/ti.*チ.*chi/);
  assert.match(coaching.teach('トゥ').sound,/tu.*ツ.*tsu/);
  assert.match(coaching.teach('ぢ').sound,/same as じ/);
  assert.match(coaching.teach('ヅ').sound,/same as ズ/);
  assert.match(coaching.teach('ヴ').sound,/b-like/);
  assert.match(coaching.teach('を').sound,/normally pronounced o/);
  assert.ok(coaching.explain('ソ').chars.includes('ン'));
});

test('sound-pattern exercises use only their explicit prerequisites and introduced pattern signs',()=>{
  const {coaching,data}=content();
  assert.deepEqual(plain(coaching.patterns().map(pattern=>pattern.id)),['longVowels','sokuon','katakanaLength']);
  for(const pattern of coaching.patterns()){
    assert.ok(['hiragana','katakana'].includes(pattern.script));
    const allowed=new Set([...pattern.prerequisites,...pattern.patternCharacters]);
    assert.equal(new Set(pattern.prerequisites).size,pattern.prerequisites.length);
    for(const char of pattern.prerequisites)assert.ok(data.collections.all.includes(char),'Unknown prerequisite: '+char);
    for(const teaching of pattern.teaching){
      for(const value of [teaching.example,teaching.audio,...teaching.comparison]){
        for(const char of value.match(/[ぁ-ヺー]/g)||[])assert.ok(allowed.has(char),pattern.id+' teaches undeclared '+char);
      }
    }
    for(const task of pattern.tasks){
      for(const value of [task.prompt,task.audio||'',task.answer,...task.options,task.correction]){
        for(const char of value.match(/[ぁ-ヺー]/g)||[])assert.ok(allowed.has(char),task.id+' needs undeclared '+char);
      }
    }
    assert.ok(Object.isFrozen(pattern.tasks));
  }
});

test('pattern checks test hearing and spelling with varied targets and no ambiguous options',()=>{
  const {coaching,japanese}=content();
  for(const pattern of coaching.patterns()){
    const ids=new Set(),teachingAudio=new Set(pattern.teaching.map(item=>item.audio));
    const listeners=pattern.tasks.filter(item=>item.kind==='listen');
    assert.ok(listeners.length>=4,pattern.id+' needs varied audio targets');
    assert.ok(pattern.tasks.filter(item=>item.kind==='apply').length>=2,pattern.id+' needs spelling application');
    const positions=new Set();
    for(const task of pattern.tasks){
      assert.equal(ids.has(task.id),false,'Duplicate task id '+task.id);ids.add(task.id);
      assert.ok(task.options.length>=3);
      assert.equal(task.options.filter(option=>option===task.answer).length,1);
      positions.add(task.options.indexOf(task.answer));
      assert.equal(new Set(task.options).size,task.options.length);
      assert.ok(task.correction.length>20);
      if(task.kind==='listen'){
        assert.equal(task.audio,task.answer,'Audio must match the scored option');
        assert.equal(teachingAudio.has(task.audio),false,'Use a transfer target instead of the demonstration target');
        assert.equal(task.prompt.includes(task.answer),false,'The question text reveals its answer');
        assert.equal(task.options.filter(option=>japanese.matchesReading(japanese.romaji(option),task.audio)).length,1,'A listening task has homophone distractors');
      }
    }
    assert.ok(positions.size>=2,'Authored answer positions are predictable');
    const sign=pattern.patternCharacters[0];
    if(sign)assert.ok(listeners.some(item=>!item.answer.includes(sign)),'Learner must also identify an ordinary short sound');
  }
});

test('Kana input checks keep equivalent romaji spellings while rejecting copied kana',()=>{
  const {coaching}=content();
  for(const [kana,answer]of [['を','o'],['ヲ','wo'],['し','si'],['ぢ','ji'],['づ','zu'],['ティ','ti'],['ん','nn']]){
    assert.equal(coaching.matches(kana,answer),true,kana+' rejects '+answer);
  }
  assert.equal(coaching.matches('あ','あ'),false);
  assert.equal(coaching.matches('お','wo'),false);
});
