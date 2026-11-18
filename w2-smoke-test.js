const { chromium } = require('playwright');
const B='http://localhost:8787';
const results=[]; const ok=(n,c,x='')=>{results.push([c?'PASS':'FAIL',n,x]);};
const PAGES=['home','tasks','calls','money','rehab','record','log'];
(async()=>{
 const br=await chromium.launch();
 async function login(ctx){const p=await ctx.newPage();const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(B+'/');
  if(await p.locator('input[type=password]').count()){await p.fill('input[type=password]','Dunnage');await Promise.all([p.waitForNavigation(),p.keyboard.press('Enter')]);}
  await p.waitForSelector('#home-tiles .tile');p.errs=errs;return p;}
 // 1 render
 for(const scheme of ['light','dark'])for(const w of [400,1280]){
  const ctx=await br.newContext({viewport:{width:w,height:900},colorScheme:scheme});const p=await login(ctx);
  for(const v of PAGES){await p.goto(B+'/#'+v);await p.waitForTimeout(300);
   const sw=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   ok(`render ${v} ${scheme} ${w}`,!sw&&p.errs.length===0,(sw?'sideways ':'')+p.errs.join('|'));}
  await ctx.close();}
 // 2,3,4
 const c1=await br.newContext({viewport:{width:400,height:900}});const p=await login(c1);
 await p.goto(B+'/#money');
 await p.fill('#m-party','TestParty');await p.fill('#m-amt','12.50');await p.click('#m-add');
 await p.waitForSelector('#name-modal:not([hidden])');ok('name asked',true);
 await p.fill('#name-input','Tester');await p.press('#name-input','Enter');
 await p.waitForSelector('#toast:not([hidden])');
 ok('toast undo+x',await p.isVisible('#toast-undo')&&await p.isVisible('#toast-x'));
 ok('money saved',(await p.textContent('#v-money')).includes('TestParty'));
 await p.click('#toast-undo');await p.waitForTimeout(600);
 ok('toast undo reverts',!(await p.textContent('#v-money')).includes('TestParty'));
 await p.fill('#m-party','Keep1');await p.fill('#m-amt','5');await p.click('#m-add');await p.waitForTimeout(500);
 await p.goto(B+'/#rehab');const before=await p.textContent('#pt-used');
 const D='2028-0'+(1+Math.floor(Math.random()*8))+'-'+(10+Math.floor(Math.random()*18));await p.fill('#a-date',D);await p.selectOption('#a-type','PT session');await p.fill('#a-where','Clinic');await p.click('#a-add');await p.waitForTimeout(600);
 ok('appt saved',(await p.textContent('#appts')).includes('Clinic'));
 await p.locator('tr.appt',{hasText:D}).locator('select').selectOption('done');await p.waitForTimeout(600);
 const after=await p.textContent('#pt-used');ok('PT counter moves',after!==before,before+'->'+after);
 await p.goto(B+'/#calls');await p.fill('#c-rep','Sam');await p.fill('#c-notes','called test');await p.click('#c-add');await p.waitForTimeout(600);
 ok('call saved',(await p.textContent('#calls')).includes('called test'));
 await p.goto(B+'/#log');await p.waitForTimeout(500);
 const log=await p.textContent('#log');ok('log has entries',/Keep1|Clinic|call/i.test(log));
 await p.click('[data-undoask]');ok('confirm shown',await p.isVisible('[data-undoyes]')&&await p.isVisible('[data-undono]'));
 await p.click('[data-undono]');ok('cancel hides',!(await p.isVisible('[data-undoyes]')));
 ok('no errs',p.errs.length===0,p.errs.join('|'));
 // 5 sync
 const c2=await br.newContext({viewport:{width:1280,height:900}});const q=await login(c2);
 await q.goto(B+'/#calls');await p.goto(B+'/#calls');await p.waitForTimeout(400);
 await q.evaluate(()=>{sessionStorage.setItem('sb.name','Other')});
 const fld=await p.locator('input[data-field]:visible').first();const key=await fld.getAttribute('data-field');
 await p.locator(`input[data-field]:visible`).nth(1).focus();
 await p.keyboard.type('typing-in-progress');
 const k2=await q.evaluate(()=>0);
 await q.goto(B+'/#calls');await q.waitForTimeout(400);
 await q.locator('input[data-field]:visible').first().fill('FromQ');await q.locator('input[data-field]:visible').first().blur();
 await p.waitForTimeout(19000);
 const v1=await p.locator('input[data-field]:visible').first().inputValue();
 const v2=await p.locator('input[data-field]:visible').nth(1).inputValue();
 ok('sync received within 20s',v1==='FromQ',v1);
 ok('typed field not wiped',v2.includes('typing-in-progress'),v2);
 await br.close();
 for(const r of results)console.log(r.join(' | '));
})().catch(e=>{console.error(e);process.exit(1)});
