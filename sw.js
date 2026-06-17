// v8 — fix: index.html sebelumnya "cache-first" jadi update baru tidak pernah
// kelihatan dan hard-refresh (Ctrl+Shift+R) seolah tidak ada efek karena SW
// tetap melayani versi lama dari Cache Storage. Sekarang app-shell pakai
// "network-first" (selalu coba ambil versi terbaru dulu, fallback ke cache
// kalau offline), sementara aset statis (icon/font) tetap cache-first karena
// memang tidak pernah berubah.
const CACHE='pencatat-cetak-v8';
const ASSETS=['/','/index.html','/manifest.json','/icon-192.png','/icon-512.png','https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'];

// File yang HARUS selalu dicoba dari network dulu (app shell — sering berubah)
const NETWORK_FIRST=['/','/index.html','/sw.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

// Tunggu perintah dari halaman (klik tombol "Update") sebelum SW baru aktif,
// supaya user tidak ke-refresh tiba-tiba di tengah mereka mengisi form.
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  const isAppShell=NETWORK_FIRST.includes(url.pathname);

  if(isAppShell){
    // NETWORK-FIRST: coba ambil versi terbaru dari server.
    // Kalau berhasil → pakai itu dan simpan ke cache untuk fallback offline.
    // Kalau gagal (offline) → baru pakai yang tersimpan di cache.
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(r=>{
        if(r&&r.ok&&e.request.method==='GET'){
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
        }
        return r;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }

  // CACHE-FIRST untuk aset statis (icon, font, dll) — aman karena tidak pernah berubah
  e.respondWith(
    caches.match(e.request).then(c=>{
      if(c)return c;
      return fetch(e.request).then(r=>{
        if(r.ok&&e.request.method==='GET')caches.open(CACHE).then(ca=>ca.put(e.request,r.clone()));
        return r;
      }).catch(()=>c);
    })
  );
});
