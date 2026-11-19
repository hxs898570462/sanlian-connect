import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './postgres-helper.js';
import {eventPoster,shelfCards,shelfDetail} from '../public/js/reader-design.js';
import {setLanguage} from '../public/js/i18n.js';

test('the reader design uses app static paths and the same editions for cards and details',async t=>{
 const f=await fixture({seed:false});t.after(()=>f.close());
 const home=await fetch(f.base());
 assert.equal(home.status,200);
 assert.match(await home.text(),/href="\/css\/reader-design\.css"/);
 const cards=shelfCards();
 const shelves=new Set([...cards.matchAll(/href="#shelf\/([^"]+)"/g)].map(match=>match[1]));
 assert.equal(shelves.size,6);
 const covers=html=>[...html.matchAll(/src="(\/assets\/reader\/covers\/[^"]+)"/g)].map(match=>match[1]);
 const paths=covers(cards);
 assert.equal(new Set(paths).size,18);
 assert.deepEqual([...shelves].flatMap(id=>covers(shelfDetail(id)).slice(3)),paths);
 const assets=await Promise.all(['/assets/reader/reading-room.jpg',...paths].map(path=>fetch(f.base()+path,{method:'HEAD'})));
 assert.ok(assets.every(response=>response.ok&&response.headers.get('content-type')==='image/jpeg'));
 assert.equal((await fetch(f.base()+'/docs/reader-design-preview/index.html')).status,404);
 const activity={category:'读书会',start_time:'2026-11-19T17:00:00.000Z'};
 assert.match(eventPoster(activity),/<strong>20<\/strong><span>11月<\/span>/);
 setLanguage('en');
 try{
  assert.match(eventPoster(activity),/<strong>20<\/strong><span>Nov<\/span>/);
  assert.match(shelfDetail('everyday'),/On this shelf/);
 }finally{setLanguage('zh-CN');}
});
