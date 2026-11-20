import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import handler from '../api/podcast-store.js';

const js = await readFile(new URL('../public/podcast/open.mjs',import.meta.url),'utf8');
const key = 'python.basics.v1';
async function landing(search, store, ua='iPhone') {
  const nodes = new Map(), redirects = [];
  const state = {navigator:{userAgent:ua}, location:{search,replace:url=>redirects.push(url)},
    URLSearchParams, document:{addEventListener(){},getElementById(id) {
      if(!nodes.has(id))nodes.set(id,{hidden:true,addEventListener(){}});
      return nodes.get(id);
    }}, fetch:async(path) => {
      assert.equal(path,'/api/podcast-store');
      return {ok:true,json:async()=>({url:store})};
    }};
  await vm.runInNewContext('(async () => {' + js + '})()',state);
  return {nodes,redirects};
}
test('Beta öffnet die richtige Folge, Release leitet iPhone zum Store',async()=>{
  const link='?folge='+key;
  const beta=await landing(link,null);
  assert.equal(beta.nodes.get('open').href,'mylenova://podcast'+link);
  assert.deepEqual(beta.redirects,[]);
  const store='https://apps.apple.com/de/app/id123456';
  assert.deepEqual((await landing(link,store)).redirects,[store]);
  assert.deepEqual((await landing(link,store,'desktop')).redirects,[]);
  assert.equal((await landing('?folge=invalid',store)).nodes.has('open'),false);
});
test('Store-Ziel kommt vom veröffentlichten Bundle',async(t)=>{
  let rows=[];
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({results:rows})}));
  const response={setHeader(){},status(code){assert.equal(code,200);return this;},json(body){this.body=body;}};
  for (const [results,url] of [
    [[],null],[[{bundleId:'other',trackId:42}],null],
    [[{bundleId:'com.armindaniel.premiumapp',trackId:123456}],'https://apps.apple.com/de/app/id123456'],
  ]) { rows=results;await handler({method:'GET'},response);assert.deepEqual(response.body,{url}); }
});
