const CACHE_NAME='gijang-teacher-helper-v32';
// './permissions-settings.js'는 더 이상 별도 파일로 올리지 않고 index.html 안에 합쳐져 있습니다.
// 여기 목록에 존재하지 않는 파일이 하나라도 있으면 cache.addAll() 전체가 실패해서
// 서비스워커 설치가 계속 실패하고, 그러면 예전 캐시가 계속 쓰이며 새 index.html/dashboard-config.js가
// 반영되지 않는 문제가 생깁니다(로그인 주소를 고쳐도 반영이 안 되는 것처럼 보이는 원인이 됩니다).
const APP_SHELL=['./','./index.html','./dashboard-config.js','./manifest.webmanifest','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const request=event.request;const isPage=request.mode==='navigate'||request.destination==='document';if(isPage){event.respondWith(fetch(new Request(request,{cache:'no-store'})).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));return;}event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response;}).catch(()=>caches.match('./index.html'))));});
