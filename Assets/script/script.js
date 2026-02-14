let currentClass = localStorage.getItem('selectedClass') || '1C-D4'; // Default ke 1C atau ambil dari simpanan

function initApp() {

            setupClassSelector();

            setupGlobalFeatures(); // Initialize Global Modal

            // --- NEW: Register Service Worker & Offline Check ---
            registerServiceWorker();
            setupOfflineDetection();

            // 1. Setup Picker & Data Awal
            setupDatePicker();
            
            // 2. Tentukan hari aktif & render (awal load)
            const activeDay = getAutoDetectedDay();
            renderDayNav(activeDay);
            renderSchedule(activeDay);
      
            
            const today = new Date();
            handleDateChange(today);

            // 3. LOGIKA REALTIME CLOCK (BARU)
            // Variabel untuk mengecek pergantian hari
            let lastDayChecked = today.getDate();

            // Update setiap 1 detik
            let tickCount = 0;

            // Update setiap 1 detik
            setInterval(() => {
                const now = new Date();
                
                // 1. Update Jam (Ringan, jalan tiap detik)
                const timeString = now.toLocaleTimeString('id-ID', { 
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
                });
                const clockElement = document.getElementById('realtimeClock');
                if (clockElement) clockElement.textContent = timeString;

                // 2. Update Status Kartu & Island (Cukup tiap 10 detik atau 60 detik)
                // Modulo operator: Hanya jalan jika tickCount habis dibagi 10
                if (tickCount % 10 === 0) { 
                     updateCardStatus();
                     updateDynamicIsland();
                }
                
                // Reset counter biar gak overflow (opsional)
                tickCount++;
                if(tickCount > 60) tickCount = 1;

            }, 1000); // 1000ms = 1 detik
        }

        // Header Date: "Senin, 24 Oktober 2024"
        

        function setupClassSelector() {
    const selector = document.getElementById('classSelector');
    const displaySpan = document.getElementById('classNameDisplay'); // Elemen baru
    
    if(!selector) return;

    // 1. Set nilai awal
    selector.value = currentClass;
    if(displaySpan) displaySpan.textContent = currentClass.replace('-', ' - '); // Format teks biar cantik

    // 2. Event saat ganti kelas
    selector.addEventListener('change', (e) => {
        const val = e.target.value;
        currentClass = val;
        localStorage.setItem('selectedClass', currentClass);
        
        // Update Teks Tampilan secara manual
        if(displaySpan) displaySpan.textContent = val.replace('-', ' - ');

        // Render ulang jadwal
        const activeDay = document.querySelector('.day-pill.active')?.textContent.toLowerCase() || getAutoDetectedDay();
        renderSchedule(activeDay);
        
        // Feedback visual (Animasi kedip)
        const dayTitle = document.getElementById('dayTitle');
        dayTitle.style.opacity = '0.5';
        setTimeout(() => dayTitle.style.opacity = '1', 300);
    });

    // 3. Fitur Double Click Reset (Tetap dipertahankan)
    // Kita pindahkan event ke parent container karena label mungkin sudah tidak ada/berubah
    const pillContainer = document.querySelector('.class-selector-pill');
    if(pillContainer) {
        pillContainer.addEventListener('dblclick', (e) => {
            // Cek jika yang diklik bukan dropdown (misal bagian icon)
            if(e.target !== selector && confirm('Refresh aplikasi (Cache Reset)?')) {
                if('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                        for(let registration of registrations) { registration.unregister(); }
                    });
                }
                window.location.reload(true);
            }
        });
    }

    // 4. Onboarding Hint
    if (!localStorage.getItem('hasSeenClassHint')) {
        const Toast = Swal.mixin({
            toast: true, position: 'top-start', showConfirmButton: false, timer: 4000
        });
        Toast.fire({ icon: 'info', title: 'Ganti Kelas?', text: 'Tap di sini untuk pilih kelas' });
        localStorage.setItem('hasSeenClassHint', 'true');
    }
}
    
    function setupDatePicker() {
    const dateInput = document.getElementById('realDateInput');
    const displayBtn = document.getElementById('datePickerBtn');
    
    // Set value input date ke hari ini (format YYYY-MM-DD)
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];

    // Event Listener: Saat user memilih tanggal baru
    dateInput.addEventListener('change', (e) => {
        const selectedDate = new Date(e.target.value);
        handleDateChange(selectedDate);
    });
}

// --- Fungsi Baru: Handle Perubahan Tanggal ---
function handleDateChange(dateObj) {
    // 1. Update Tampilan Teks di Tombol (Indonesian Format)
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('currentDateDisplay').textContent = dateObj.toLocaleDateString('id-ID', options);

    // 2. Deteksi Hari dari Tanggal tersebut
    const dayIndex = dateObj.getDay(); // 0=Minggu, 1=Senin, dst.
    const dayMap = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const targetDay = dayMap[dayIndex];

    // 3. Pindah Tab & Render Jadwal
    // Cek apakah hari tersebut ada di list tab kita (Senin-Jumat)
    if (days.includes(targetDay)) {
        // Update UI Tab (Aktifkan pill yang sesuai)
        document.querySelectorAll('.day-pill').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase() === targetDay) {
                btn.classList.add('active');
            }
        });
        
        // Render jadwal
        renderSchedule(targetDay);
    } else {
        // Jika Sabtu/Minggu (Weekend)
        document.querySelectorAll('.day-pill').forEach(btn => btn.classList.remove('active'));
        renderWeekendView(targetDay);
    }
}

// --- Fungsi Tambahan: Tampilan Weekend ---
function renderWeekendView(dayName) {
    const container = document.getElementById('scheduleContainer');
    const dayTitle = document.getElementById('dayTitle');
    
    dayTitle.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    document.getElementById('daySubtitle').textContent = "Yeay! Akhir pekan.";

    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="mb-3 p-4 rounded-circle bg-light d-inline-block">
                <i class="fa-solid fa-mug-hot fa-3x text-warning"></i>
            </div>
            <h3 class="fw-bold text-dark">libur cik</h3>
            <p class="text-secondary">Nggak ada matkul. Saatnya rebahan sambil scroll sosmed.</p>
        </div>
    `;
}

        // Auto Detect Day (Sat/Sun defaults to Senin)
        function getAutoDetectedDay() {
            const dayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon, etc.
            if (dayIndex === 0 || dayIndex === 6) return 'senin'; // Weekend -> Monday
            // Map 1..5 to array index 0..4
            return days[dayIndex - 1] || 'senin';
        }

        // Color & Theme Logic
        function getSubjectStyle(subjectName) {
            const lower = subjectName.toLowerCase();
            
            // 1. Check for Break/Empty first
            if (lower.includes('kosong') || lower.includes('istirahat')) {
                return { themeClass: 'is-break', isPractice: false };
            }

            // 2. Check Type (Theory vs Practice)
            const isPractice = lower.includes('pr') || lower.includes('praktik');
            
            // 3. Determine Color Theme
         
            let themeClass = 'theme-slate'; // Default

            if (lower.includes('matematika')) themeClass = 'theme-red';
            else if (lower.includes('proyek')) themeClass = 'theme-green';
            
            // --- BAGIAN YANG DIUBAH ---
            else if (lower.includes('inggris')) themeClass = 'theme-yellow'; // Inggris -> Orange
            else if (lower.includes('indonesia')) themeClass = 'theme-pink'; // Indo -> Pink/Magenta
            // ---------------------------

            else if (lower.includes('struktur data')) themeClass = 'theme-blue';
            else if (lower.includes('pemrograman')) themeClass = 'theme-indigo';
            else if (lower.includes('agama')) themeClass = 'theme-teal';
            
            return { themeClass, isPractice };
        }

        // Render Navigation Pills
        function renderDayNav(activeDay) {
            const navContainer = document.getElementById('dayNav');
            navContainer.innerHTML = '';

            days.forEach(day => {
                const btn = document.createElement('span');
                btn.className = `day-pill ${day === activeDay ? 'active' : ''}`;
                btn.textContent = day.charAt(0).toUpperCase() + day.slice(1);
                
                btn.onclick = () => {
                    // Update Active State
                    document.querySelectorAll('.day-pill').forEach(el => el.classList.remove('active'));
                    btn.classList.add('active');
                    // Render Content
                    renderSchedule(day);
                };
                
                navContainer.appendChild(btn);
            });
        }

        // Render Main Cards
        function renderSchedule(day) {
            const container = document.getElementById('scheduleContainer');
            const dayTitle = document.getElementById('dayTitle');
            const daySubtitle = document.getElementById('daySubtitle');
            
            dayTitle.textContent = day.charAt(0).toUpperCase() + day.slice(1);
            // Ambil data berdasarkan kelas yang dipilih (currentClass)
const classData = scheduleData[currentClass];
const dailyData = classData ? classData[day] : [];

daySubtitle.textContent = `Today's Agenda • ${dailyData?.length || 0} Sessions`;

            container.innerHTML = '';

            if (!dailyData || dailyData.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <i class="fa-regular fa-face-smile fa-3x text-muted mb-3"></i>
                        <h4 class="text-muted fw-bold">Free Day!</h4>
                        <p class="text-secondary">Tidak ada jadwal kuliah hari ini.</p>
                    </div>
                `;
                return;
            }

            dailyData.forEach((item, index) => {
                const { themeClass, isPractice } = getSubjectStyle(item.mata_kuliah);
                const isBreak = themeClass === 'is-break';
                
                // --- LOGIKA PARSING WAKTU (PENTING) ---
                // Format data Anda tidak konsisten (ada titik 08.40, ada titik dua 07:00)
                // Kita normalisasi dulu
                
                // Data sudah bersih (format HH:MM) dari source
                // [UPDATED] Smart Time Parsing (Regex)
                // Menangkap format "07:00 - 09:30", "07.00 – 09.30", dll
                const cleanTime = item.jam.replace(/\./g, ':'); // Ubah titik jadi dua titik (07.00 -> 07:00)
                // Split berdasarkan strip panjang, pendek, atau spasi strip spasi
                const parts = cleanTime.split(/\s*[\–\-\to]\s*/).filter(t => t.length > 0);
                
                const startTimeStr = parts[0];
                const endTimeStr = parts[1] || parts[0];
                const card = document.createElement('div');
                let classes = `zen-card ${themeClass}`;
                if (isPractice) classes += ' is-practice';
                
                card.className = classes;
                card.style.animationDelay = `${index * 0.1}s`;

                // Simpan data waktu di atribut HTML agar bisa dibaca oleh Timer nanti
                card.setAttribute('data-start', startTimeStr);
                card.setAttribute('data-end', endTimeStr);

                const tagHtml = isBreak ? '' : 
                    `<span class="card-tag" style="background: rgba(0,0,0,0.05);">
                        ${isPractice ? 'PRAKTIK' : 'TEORI'}
                    </span>`;
                
                const iconHtml = isBreak ? '<i class="fa-solid fa-mug-hot"></i>' : '<i class="fa-solid fa-book-open"></i>';
                
                const locationHtml = isBreak ? '' : `
                    <div class="d-flex align-items-center gap-2">
                         <i class="fa-solid fa-location-dot"></i> 
                         <span>${item.ruang}</span>
                    </div>
                `;

                // --- HTML CARD DIPERBARUI ---
                card.innerHTML = `
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="card-time">
                                <i class="fa-regular fa-clock me-1"></i> ${item.jam}
                                <span class="live-badge">LIVE</span> </span>
                            ${tagHtml}
                        </div>
                        <h4 class="card-subject">${item.mata_kuliah}</h4>
                        ${!isBreak ? `<div class="text-opacity-75" style="font-size:0.9em">${item.dosen}</div>` : ''}
                        
                        <div class="progress-track">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    
                    <div class="card-details">
                        ${isBreak ? '<span>Jajan dulu ke bi oneng gih.</span>' : locationHtml}
                    </div>
                `;

                if (!isBreak) {
                    card.addEventListener('click', () => showDetails(item, themeClass));
                }

                container.appendChild(card);
            });
            
            // Panggil sekali agar langsung update status saat render selesai
            updateCardStatus(); 
        }

            

        function showDetails(item, colorClass) {
            // Extract colors from computed style or map manually for the modal
            Swal.fire({
                title: item.mata_kuliah,
                html: `
                    <div class="text-start mt-3">
                        <div class="mb-3 p-3 rounded-4 bg-light">
                            <label class="text-muted fw-bold small text-uppercase mb-1">Dosen Pengampu</label>
                            <div class="fw-semibold text-dark fs-5">${item.dosen}</div>
                        </div>
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="p-3 rounded-4 bg-light h-100">
                                    <label class="text-muted fw-bold small text-uppercase mb-1">Waktu</label>
                                    <div class="fw-bold text-dark">${item.jam}</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-3 rounded-4 bg-light h-100">
                                    <label class="text-muted fw-bold small text-uppercase mb-1">Ruang</label>
                                    <div class="fw-bold text-dark">${item.ruang}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                showCloseButton: true,
                showConfirmButton: false,
                backdrop: `rgba(0,0,0,0.2)`
            });
        }

        // --- LOGIKA PWA & OFFLINE ---

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('SW Fail:', err));
    }
}

function setupOfflineDetection() {
    // Cek status awal
    updateOnlineStatus();

    // Event listener saat koneksi putus/nyambung
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const island = document.getElementById('dynamicStatusBar');
    const islandLabel = island.querySelector('.island-label') || island.querySelector('small');
    const islandText = document.getElementById('islandText');
    const islandTime = document.getElementById('islandTime');
    const islandIcon = island.querySelector('.island-icon');

    if (!navigator.onLine) {
        // Mode Offline
        islandLabel.textContent = "KONEKSI TERPUTUS";
        islandText.textContent = "Mode Offline";
        islandTime.textContent = "Data mungkin tidak terbaru";
        islandIcon.innerHTML = '<i class="fa-solid fa-wifi"></i>';
        islandIcon.style.background = '#64748b'; // Abu-abu
        islandIcon.style.animation = 'none';
        
        island.classList.add('visible');
        island.classList.remove('upcoming-mode');
    } else {
        // Jika kembali online, biarkan updateDynamicIsland() yang refresh statusnya nanti
        // atau kita bisa paksa refresh manual:
        const checkNow = document.querySelector('.zen-card.is-active');
        if(!checkNow) {
             // Jika tidak ada kelas aktif, sembunyikan notif offline tadi
             island.classList.remove('visible');
        }
    }
}

        // Start App
        document.addEventListener('DOMContentLoaded', initApp);

        function updateCardStatus() {
    const now = new Date();
    
    // 1. Cek Hari (Logic lama tetap dipakai, hanya dirapikan)
    const daysMap = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const todayName = daysMap[now.getDay()]; 
    const activeTab = document.querySelector('.day-pill.active');
    
    // Validasi dasar
    if (!activeTab) return; 
    const currentViewedDay = activeTab.textContent.toLowerCase().trim();
    if (currentViewedDay !== todayName) {
        document.querySelectorAll('.zen-card').forEach(c => c.classList.remove('is-active', 'is-past', 'is-upcoming'));
        return; 
    }

    // 2. Setup Waktu
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeValue = currentHours * 60 + currentMinutes; 
    const cards = document.querySelectorAll('.zen-card');

    // --- VARIABEL BARU: Flag untuk menandai kita sudah nemu kelas selanjutnya ---
    let upcomingFound = false; 

    cards.forEach(card => {
        const startStr = card.getAttribute('data-start'); 
        const endStr = card.getAttribute('data-end');     
        if (!startStr || !endStr) return;

        const getMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const startMin = getMinutes(startStr);
        const endMin = getMinutes(endStr);

        // Reset class
        card.classList.remove('is-active', 'is-past', 'is-upcoming');

        // --- LOGIKA BARU ---
        if (currentTimeValue >= startMin && currentTimeValue < endMin) {
            // KONDISI 1: SEDANG BERLANGSUNG
            card.classList.add('is-active');
            
            const duration = endMin - startMin;
            const elapsed = currentTimeValue - startMin;
            const percent = (elapsed / duration) * 100;
            const bar = card.querySelector('.progress-fill');
            if(bar) bar.style.width = `${percent}%`;

        } else if (currentTimeValue >= endMin) {
            // KONDISI 2: SUDAH LEWAT
            card.classList.add('is-past');

        } else {
            // KONDISI 3: AKAN MULAI (UPCOMING)
            // Hanya ambil kartu masa depan PERTAMA yang kita temui
            if (currentTimeValue < startMin && !upcomingFound) {
                card.classList.add('is-upcoming');
                
                // Simpan selisih waktu
                const diff = startMin - currentTimeValue;
                card.setAttribute('data-mins-until', diff);
                
                // Kunci flag agar kartu jam-jam berikutnya tidak ikut dianggap 'upcoming'
                upcomingFound = true;
            }
        }
        // [NEW FEATURE] Auto Scroll ke kelas aktif saat pertama kali load
    // Gunakan flag global agar tidak scroll terus menerus setiap detik
    if (!window.hasAutoScrolled && (currentTimeValue > 0)) {
        const activeOrUpcoming = document.querySelector('.zen-card.is-active') || document.querySelector('.zen-card.is-upcoming');
        if (activeOrUpcoming) {
            activeOrUpcoming.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.hasAutoScrolled = true; // Set flag done
        }
    }
    });
}
    


    function updateDynamicIsland() {
            const island = document.getElementById('dynamicStatusBar');
            const islandText = document.getElementById('islandText');
            const islandTime = document.getElementById('islandTime');
            // Pastikan elemen label diambil dengan aman
            let islandLabel = island.querySelector('.island-label');
            if (!islandLabel) {
                 // Fallback jika class belum ada di HTML, ambil elemen small pertama
                 islandLabel = island.querySelector('small');
            }

            const activeCard = document.querySelector('.zen-card.is-active');
            const upcomingCard = document.querySelector('.zen-card.is-upcoming');

            // Reset mode tampilan
            island.classList.remove('upcoming-mode');

            if (activeCard) {
                // --- KONDISI 1: ADA KELAS LIVE (SEDANG BERLANGSUNG) ---
                const subject = activeCard.querySelector('.card-subject').innerText;
                const endTimeStr = activeCard.getAttribute('data-end'); // Contoh: "09:30"
                
                // --- LOGIKA HITUNG SISA WAKTU ---
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                
                // Parsing waktu selesai
                const [endH, endM] = endTimeStr.split(':').map(Number);
                const endTotalMins = endH * 60 + endM;
                
                // Hitung selisih
                const diff = endTotalMins - currentMins;
                
                // Format teks sisa waktu
                let timeLeftText = "";
                if (diff >= 60) {
                    const h = Math.floor(diff / 60);
                    const m = diff % 60;
                    // Jika menitnya 0, cukup tulis jamnya saja agar rapi
                    timeLeftText = m > 0 ? `${h} jam ${m} menit lagi` : `${h} jam lagi`;
                } else if (diff > 0) {
                    timeLeftText = `${diff} menit lagi`;
                } else {
                    timeLeftText = "Segera berakhir";
                }

                // Update Teks di Island
                islandLabel.textContent = "SEDANG BERLANGSUNG";
                islandText.textContent = subject;
                islandTime.textContent = timeLeftText; // Menampilkan hitung mundur
                
                island.classList.add('visible');
                } else if (upcomingCard) {
        // --- KONDISI 2: AKAN MULAI (UPCOMING) ---
        const subject = upcomingCard.querySelector('.card-subject').innerText;
        // Ambil data menit (string) lalu ubah ke number
        const minsLeft = parseInt(upcomingCard.getAttribute('data-mins-until'));
        
        islandLabel.textContent = "SEGERA DIMULAI";
        islandText.textContent = subject;

        // --- LOGIKA FORMAT JAM & MENIT ---
        let timeString = "";
        if (minsLeft >= 60) {
            const h = Math.floor(minsLeft / 60);
            const m = minsLeft % 60;
            // Contoh output: "Dalam 2 jam 30 menit" atau "Dalam 1 jam lagi"
            timeString = m > 0 ? `Dalam ${h} jam ${m} menit` : `Dalam ${h} jam lagi`;
        } else {
            // Jika kurang dari 1 jam
            timeString = `Dalam ${minsLeft} menit lagi`;
        }
        
        islandTime.textContent = timeString;
        
        island.classList.add('visible', 'upcoming-mode');

            } else {
                // --- KONDISI 3: TIDAK ADA KEGIATAN / SELESAI ---
                
                // Cek apakah hari ini sebenarnya ada jadwal tapi sudah lewat semua?
                const cards = document.querySelectorAll('.zen-card');
                const lastCard = cards[cards.length - 1];
                let isFinished = false;

                if (lastCard && lastCard.classList.contains('is-past')) {
                    isFinished = true;
                }

                if (isFinished) {
                    // Tampilkan status "Kuliah Selesai"
                    islandLabel.textContent = "INFO";
                    islandText.textContent = "Kuliah Hari Ini Selesai";
                    islandTime.textContent = "Sampai jumpa besok!";
                    island.classList.add('visible');
                    island.classList.remove('upcoming-mode');
                    // Ubah icon jadi check
                    const icon = island.querySelector('.island-icon');
                    icon.innerHTML = '<i class="fa-solid fa-check"></i>';
                    icon.style.background = '#10b981'; // Hijau sukses
                    icon.style.animation = 'none';
                } else {
                    // Benar-benar kosong (Libur/Minggu) atau belum load
                    island.classList.remove('visible');
                }
            }
        }

        // --- GLOBAL INSIGHT FEATURES (NEW) ---

        // --- GLOBAL INSIGHT FEATURES (FIXED & CONSOLIDATED) ---

function setupGlobalFeatures() {
    // 1. Setup Trigger Button
    const btn = document.getElementById('globalViewBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            const modalEl = document.getElementById('globalModal');
            const modal = new bootstrap.Modal(modalEl);
            
            // Set default inputs to current time
            const now = new Date();
            const daysMap = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
            const curDay = daysMap[now.getDay()];
            
            // Set dropdown day
            const daySelect = document.getElementById('monitorDay');
            if(daySelect && curDay !== 'minggu' && curDay !== 'sabtu') {
                daySelect.value = curDay;
            }
            
            // Set time input
            const timeInput = document.getElementById('monitorTime');
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            timeInput.value = `${h}:${m}`;

            // Auto check on open
            checkGlobalTime();

            modal.show();
        });
    }

    // 2. Setup Monitor Button (Cek Waktu)
    document.getElementById('btnCheckTime')?.addEventListener('click', checkGlobalTime);

    // 3. Setup Search Input
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleGlobalSearch(e.target.value);
        });
    }

    // 4. Generate Data Tags (Dosen & Ruangan)
    generateSearchTags();
}

function checkGlobalTime() {
    const day = document.getElementById('monitorDay').value;
    const timeVal = document.getElementById('monitorTime').value;
    const container = document.getElementById('monitorResults');
    
    if(!timeVal) return;

    // Convert input HH:MM to minutes
    const [h, m] = timeVal.split(':').map(Number);
    const checkMinutes = h * 60 + m;

    container.innerHTML = ''; 

    Object.keys(scheduleData).forEach(className => {
        const classSchedule = scheduleData[className][day];
        let activeItem = null;

        if (classSchedule) {
            activeItem = classSchedule.find(item => {
                const cleanTime = item.jam.replace(/\./g, ':');
                const parts = cleanTime.split(/\s*[\–\-\to]\s*/).filter(t => t.length > 0);
                const [startH, startM] = parts[0].split(':').map(Number);
                const [endH, endM] = (parts[1] || parts[0]).split(':').map(Number);
                const startMin = startH * 60 + startM;
                const endMin = endH * 60 + endM;
                return checkMinutes >= startMin && checkMinutes < endMin;
            });
        }

        const card = document.createElement('div');
        const shortName = className.split('-')[0];
        
        if (activeItem) {
            // Apply Full Color Theme
            const style = getSubjectStyle(activeItem.mata_kuliah);
            let practiceClass = style.isPractice ? 'is-practice' : '';
            
            card.className = `insight-card ${style.themeClass} ${practiceClass}`;
            
            card.innerHTML = `
                <div class="class-badge">
                    <span>${shortName}</span>
                    <small>KELAS</small>
                </div>
                <div class="insight-info w-100">
                    <h6>${activeItem.mata_kuliah}</h6>
                    <div class="insight-meta">
                        <span><i class="fa-regular fa-clock"></i> ${activeItem.jam}</span>
                        <span><i class="fa-solid fa-location-dot"></i> ${activeItem.ruang}</span>
                    </div>
                    <span class="insight-dosen"><i class="fa-solid fa-chalkboard-user me-1"></i> ${activeItem.dosen}</span>
                </div>
            `;
        } else {
            // State Kosong (Tetap Putih/Abu)
            card.className = 'insight-card insight-empty';
            card.innerHTML = `
                <div class="class-badge">
                    <span>${shortName}</span>
                </div>
                <div class="insight-info">
                    <h6>Tidak ada jadwal</h6>
                    <div class="insight-meta">Kelas kosong pada jam ini.</div>
                </div>
            `;
        }
        container.appendChild(card);
    });
}

function handleGlobalSearch(query) {
    const container = document.getElementById('searchResults');
    const suggestionArea = document.getElementById('suggestionArea');
    
    container.innerHTML = '';
    
    // Logic: Toggle Suggestion Area
    if (!query || query.length < 2) {
        if(suggestionArea) suggestionArea.style.display = 'block';
        return;
    }

    if(suggestionArea) suggestionArea.style.display = 'none';

    const lowerQ = query.toLowerCase();
    let found = false;

    Object.keys(scheduleData).forEach(className => {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        days.forEach(day => {
            const items = scheduleData[className][day];
            if(!items) return;

            items.forEach(item => {
                const matchText = `${item.mata_kuliah} ${item.dosen} ${item.ruang}`.toLowerCase();
                
                if (matchText.includes(lowerQ)) {
                    found = true;
                    
                    const card = document.createElement('div');
                    // Apply Full Color Theme
                    const style = getSubjectStyle(item.mata_kuliah);
                    let practiceClass = style.isPractice ? 'is-practice' : '';
                    
                    card.className = `insight-card ${style.themeClass} ${practiceClass} mb-2`;
                    
                    const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                    
                    card.innerHTML = `
                        <div class="class-badge">
                            <span>${className.split('-')[0]}</span>
                        </div>
                        <div class="insight-info w-100">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6>${item.mata_kuliah}</h6>
                                <span class="badge bg-white text-dark shadow-sm" style="opacity:0.9">${dayName}</span>
                            </div>
                            <div class="insight-meta mt-2">
                                <span><i class="fa-regular fa-clock"></i> ${item.jam}</span>
                                <span><i class="fa-solid fa-location-dot"></i> ${item.ruang}</span>
                            </div>
                            <span class="insight-dosen"><i class="fa-solid fa-chalkboard-user me-1"></i> ${item.dosen}</span>
                        </div>
                    `;
                    container.appendChild(card);
                }
            });
        });
    });

    if (!found) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fa-solid fa-magnifying-glass fa-2x text-muted mb-3"></i>
                <p class="text-muted fw-bold">Tidak ditemukan.</p>
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-4" onclick="clearSearch()">Reset Pencarian</button>
            </div>`;
    }
}

function generateSearchTags() {
    const dosenSet = new Set();
    const ruangSet = new Set();

    // 1. Collect Data Unik
    Object.keys(scheduleData).forEach(cls => {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        days.forEach(day => {
            const items = scheduleData[cls][day];
            if(items) {
                items.forEach(item => {
                    // Split nama dosen
                    const dosens = item.dosen.split(',').map(d => d.trim());
                    dosens.forEach(d => {
                        if(d !== '-' && d.length > 3) dosenSet.add(d);
                    });

                    // Ruangan (ambil kode depan saja)
                    const r = item.ruang.split('-')[0].trim();
                    if(r !== '-' && r.length > 2) ruangSet.add(r);
                });
            }
        });
    });

    // 2. Render Tags Dosen
    const dosenContainer = document.getElementById('dosenTags');
    if(dosenContainer) {
        dosenContainer.innerHTML = '';
        Array.from(dosenSet).sort().forEach(dosen => {
            const tag = document.createElement('span');
            tag.className = 'search-tag';
            tag.textContent = dosen;
            tag.onclick = () => {
                const input = document.getElementById('globalSearchInput');
                if(input) {
                    input.value = dosen;
                    handleGlobalSearch(dosen); // Panggil fungsi search yang benar
                }
            };
            dosenContainer.appendChild(tag);
        });
    }

    // 3. Render Tags Ruangan
    const ruangContainer = document.getElementById('ruangTags');
    if(ruangContainer) {
        ruangContainer.innerHTML = '';
        Array.from(ruangSet).sort().forEach(ruang => {
            const tag = document.createElement('span');
            tag.className = 'search-tag';
            tag.textContent = ruang;
            tag.onclick = () => {
                const input = document.getElementById('globalSearchInput');
                if(input) {
                    input.value = ruang;
                    handleGlobalSearch(ruang); // Panggil fungsi search yang benar
                }
            };
            ruangContainer.appendChild(tag);
        });
    }
}

function clearSearch() {
    const input = document.getElementById('globalSearchInput');
    if(input) {
        input.value = '';
        handleGlobalSearch('');
    }
}
