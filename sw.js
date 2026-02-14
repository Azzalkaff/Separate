const CACHE_NAME = 'jadwal-app-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './Assets/css/style.css',
    './Assets/script/data.js',
    './Assets/script/script.js',
    './manifest.json'
];

// Install Event: Cache file statis lokal
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event: Bersihkan cache lama jika versi naik
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Fetch Event: Strategi "Stale-While-Revalidate"
// (Pakai yang di cache dulu biar cepat, sambil update di background)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Hanya cache jika request sukses dan valid (termasuk CDN bootstrap/font)
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Jika offline total dan tidak ada di cache
                // Bisa return halaman offline khusus jika mau
            });

            // Kembalikan cache jika ada, jika tidak tunggu network
            return cachedResponse || fetchPromise;
        })
    );
});