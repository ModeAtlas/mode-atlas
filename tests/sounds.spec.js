const {test,expect}=require('@playwright/test');
async function prepare(page){
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','sounds');localStorage.setItem('modeAtlasSound','soft');
    window.notes=[];window.contextCount=0;
    window.AudioContext=class{
      constructor(){this.state='running';this.currentTime=0;this.destination={};contextCount++;}
      resume(){this.state='running';return Promise.resolve();}
      createGain(){return {gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
      createOscillator(){const note={};return {type:'sine',frequency:{setValueAtTime(value){note.frequency=value;},exponentialRampToValueAtTime(value){note.to=value;}},connect(){},disconnect(){},start(at){note.start=at;notes.push(note);},stop(at){note.end=at;this.onended?.();}};}
    };
  });
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>{
    const host=document.createElement('section');host.id='soundFixture';host.style='position:fixed;inset:60px 20px auto;z-index:10000;background:black;padding:20px;';
    host.innerHTML='<button>Save</button><button>Cancel</button><button>Delete item</button><button>Pause</button><button>Continue</button><button disabled>Disabled</button><label><input type="checkbox">Toggle</label><select aria-label="Selection"><option>A</option><option>B</option></select><div class="ma-card">Static card</div><button data-ma-click-sound="none">Answer</button>';
    document.body.append(host);notes=[];
  });
}
async function notes(page){await page.waitForTimeout(50);return page.evaluate(()=>window.notes.splice(0));}
test('all ordinary buttons share one cue, with one sound per keyboard or changed-value activation',async({page})=>{
  await prepare(page);let expected;
  for(const label of ['Save','Cancel','Delete item','Pause','Continue']){
    await page.locator('#soundFixture').getByRole('button',{name:label,exact:true}).click();
    const got=await notes(page);expect(got).toHaveLength(1);if(!expected)expected=got;else expect(got).toEqual(expected);
  }
  await page.locator('#soundFixture').getByRole('button',{name:'Save',exact:true}).focus();await page.keyboard.press('Enter');expect(await notes(page)).toEqual(expected);
  await page.getByRole('checkbox',{name:'Toggle'}).check();expect(await notes(page)).toEqual(expected);
  await page.getByRole('combobox',{name:'Selection'}).selectOption('B');expect(await notes(page)).toEqual(expected);
  expect(await page.evaluate(()=>contextCount)).toBe(1);
});
test('cancelled presses, disabled controls, typing and static cards stay silent',async({page})=>{
  await prepare(page);await page.getByText('Static card',{exact:true}).click();expect(await notes(page)).toEqual([]);
  const button=page.locator('#soundFixture').getByRole('button',{name:'Save',exact:true});const box=await button.boundingBox();
  await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();expect(await notes(page)).toEqual([]);await page.mouse.move(5,5);await page.mouse.up();expect(await notes(page)).toEqual([]);
  await page.locator('#soundFixture').getByRole('button',{name:'Disabled'}).dispatchEvent('click');expect(await notes(page)).toEqual([]);
  await page.locator('#soundFixture').getByRole('button',{name:'Answer',exact:true}).click();expect(await notes(page)).toEqual([]);
});
test('outcome cues are explicit and silent mode suppresses every category',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>ModeAtlasSounds.play('correct',{cooldown:0}));const correct=await notes(page);
  await page.evaluate(()=>ModeAtlasSounds.play('wrong',{cooldown:0}));const wrong=await notes(page);expect(wrong).not.toEqual(correct);
  await page.evaluate(()=>ModeAtlasSounds.notify('Achievement unlocked: wording alone','info'));expect(await notes(page)).toEqual([]);
  await page.evaluate(()=>ModeAtlasSounds.notify('A milestone','success','achievement'));expect(await notes(page)).toHaveLength(4);
  await page.evaluate(()=>{ModeAtlasSounds.setMode('off');for(const cue of ['tap','correct','wrong','finish','achievement'])ModeAtlasSounds.play(cue,{cooldown:0});});expect(await notes(page)).toEqual([]);
});
