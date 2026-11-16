// Optional UI QA: npm install --no-save playwright (or set PLAYWRIGHT_MODULE).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.CLUB_URL||'http://127.0.0.1:4174');await page.locator('.gaming-stage').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.screenshot({path:path.join(out,'07-home-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Включить светлую тему'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.reload();await page.locator('.gaming-stage').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.screenshot({path:path.join(out,'08-home-light.png'),fullPage:true});
  const other=await context.newPage();await other.goto(page.url());await other.locator('.gaming-stage').waitFor();
  await page.getByRole('button',{name:'Включить тёмную тему'}).click();
  await other.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await other.close();
  await page.getByRole('link',{name:'Вход для сотрудников'}).click();await page.locator('#login-form').waitFor();
  await page.locator('[name=login]').fill('manager');await page.locator('[name=password]').fill('Club_Demo_2026!');await page.getByRole('button',{name:'Войти в кабинет'}).click();await page.getByRole('heading',{name:'Обзор клуба'}).waitFor();
  await page.screenshot({path:path.join(out,'09-cabinet-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Включить светлую тему'}).click();
  await page.screenshot({path:path.join(out,'10-cabinet-light.png'),fullPage:true});
  await page.getByRole('button',{name:'Включить тёмную тему'}).click();await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'11-mobile-dark.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Выйти'}).click();await page.locator('#login-form').waitFor();
  await page.getByRole('link',{name:'На главную'}).click();await page.locator('.gaming-stage').waitFor();
  await page.screenshot({path:path.join(out,'12-home-mobile-dark.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('THEME_BROWSER_OK: dark/light, persisted choice, cross-tab sync, cabinet, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
