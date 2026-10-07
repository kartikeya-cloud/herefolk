import assert from 'node:assert/strict';
import {backendConfig} from '../src/backend-config';
const url=backendConfig.url,key=backendConfig.publishableKey;
const results:{check:string;status:string}[]=[];
async function check(name:string,path:string,init:RequestInit,expected:number){const response=await fetch(url+path,{...init,signal:AbortSignal.timeout(20000)});assert.equal(response.status,expected,`${name}: unexpected HTTP ${response.status}`);results.push({check:name,status:'passed'});return response}
await check('Auth service reachable','/auth/v1/health',{headers:{apikey:key}},200);
await check('Anonymous feed access blocked','/rest/v1/posts?select=id',{headers:{apikey:key}},401);
await check('Missing user session blocked','/functions/v1/api/check-in',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'},401);
const cors=await check('Browser CORS preflight','/functions/v1/api/posts',{method:'OPTIONS',headers:{Origin:'https://localloop-kartikeya.kartikeyadbuglabs.chatgpt.site','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,apikey'}},204);
assert.equal(cors.headers.get('access-control-allow-origin'),'*');
console.log(JSON.stringify({project:url,checks:results,limit:'No accounts or data created. Authenticated two-user flows still require normal confirmed accounts.'},null,2));
