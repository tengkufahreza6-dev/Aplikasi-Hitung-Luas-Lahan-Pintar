// ============================================================
// KALKULATOR LUAS LAHAN PINTAR - VERSI 3.0
// Dengan peningkatan presisi, visualisasi, dan pengalaman pengguna
// ============================================================

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let currentPoints = [];
let canvas, ctx;
let zoomLevel = 1;
let panOffset = { x: 0, y: 0 };
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let history = [];
let currentHistoryIndex = -1;

// UTILITY: Debounce Function
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// ============================================================
// STATE UNTUK ROLLDOWN
// ============================================================
// State untuk UI panels
let panelStates = {
    integral: false,
    metode: false,
    perhitungan: false
};

// Fungsi untuk toggle panel dengan konsisten
function togglePanel(panelName) {
    if (!panelStates.hasOwnProperty(panelName)) return;
    
    panelStates[panelName] = !panelStates[panelName];
    
    // Update UI sesuai state
    const content = document.getElementById(`${panelName}Content`);
    const icon = document.getElementById(`${panelName}Icon`);
    
    if (content && icon) {
        if (panelStates[panelName]) {
            content.classList.add('show');
            icon.textContent = '▼';
        } else {
            content.classList.remove('show');
            icon.textContent = '▶';
        }
    }
}

// ============================================================
// FUNGSI FORMAT ANGKA (titik jadi koma)
// ============================================================
function formatAngka(angka, desimal = 3) {
    let str = angka.toFixed(desimal);
    return str.replace('.', ',');
}

// ============================================================
// FUNGSI: Toast Notification
// ============================================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// FUNGSI CANVAS & ZOOM
// ============================================================
function zoom(factor) {
    zoomLevel *= factor;
    zoomLevel = Math.min(Math.max(zoomLevel, 0.1), 10);
    
    if (currentPoints.length > 0) {
        const hasil = hitungSemuaLuas(currentPoints);
        drawLahan(currentPoints, hasil);
    } else {
        drawEmptyCanvas();
    }
    
    showToast(`Zoom: ${(zoomLevel * 100).toFixed(0)}%`, 'info');
}

function resetView() {
    zoomLevel = 1;
    panOffset = { x: 0, y: 0 };
    
    if (currentPoints.length > 0) {
        const hasil = hitungSemuaLuas(currentPoints);
        drawLahan(currentPoints, hasil);
    } else {
        drawEmptyCanvas();
    }
    
    showToast('View direset', 'info');
}

function startDrag(e) {
    isDragging = true;
    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;
    canvas.style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    
    panOffset.x += dx;
    panOffset.y += dy;
    
    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;
    
    if (currentPoints.length > 0) {
        const hasil = hitungSemuaLuas(currentPoints);
        drawLahan(currentPoints, hasil);
    }
}

function endDrag() {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

// ============================================================
// FUNGSI INPUT TITIK
// ============================================================
function generateInputFields() {
    const jumlah = parseInt(document.getElementById('jumlahTitik').value) || 5;
    const container = document.getElementById('titikInputContainer');
    
    let html = '';
    for (let i = 0; i < jumlah; i++) {
        html += `
            <div class="titik-row" id="titikRow${i}">
                <span>P${i+1}</span>
                <input type="number" id="x${i}" placeholder="X" step="0.1" value="0">
                <input type="number" id="y${i}" placeholder="Y" step="0.1" value="0">
                <button class="remove-btn" onclick="hapusTitik(${i})">×</button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function hapusTitik(index) {
    const row = document.getElementById(`titikRow${index}`);
    if (row) row.remove();
    
    const rows = document.querySelectorAll('.titik-row');
    rows.forEach((row, i) => {
        row.querySelector('span').textContent = `P${i+1}`;
        row.id = `titikRow${i}`;
        row.querySelector('.remove-btn').setAttribute('onclick', `hapusTitik(${i})`);
    });
    
    document.getElementById('jumlahTitik').value = rows.length;
    showToast(`Titik P${index+1} dihapus`, 'info');
}

function readPointsFromInput() {
    const rows = document.querySelectorAll('.titik-row');
    const points = [];
    
    rows.forEach((row, i) => {
        const xInput = document.getElementById(`x${i}`);
        const yInput = document.getElementById(`y${i}`);
        
        if (xInput && yInput) {
            const x = parseFloat(xInput.value) || 0;
            const y = parseFloat(yInput.value) || 0;
            points.push({ x, y });
        }
    });
    
    return points;
}

function setPointsToInput(points) {
    document.getElementById('jumlahTitik').value = points.length;
    generateInputFields();
    
    points.forEach((point, i) => {
        const xInput = document.getElementById(`x${i}`);
        const yInput = document.getElementById(`y${i}`);
        if (xInput && yInput) {
            xInput.value = point.x.toFixed(1);
            yInput.value = point.y.toFixed(1);
        }
    });
}

function validasiTitik(points) {
    if (points.length < 3) {
        showToast('Minimal 3 titik!', 'error');
        return false;
    }
    
    // Cek titik duplikat dengan toleransi
    const EPS = 1e-6;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dx = Math.abs(points[i].x - points[j].x);
            const dy = Math.abs(points[i].y - points[j].y);
            if (dx < EPS && dy < EPS) {
                showToast(`Titik P${i+1} dan P${j+1} terlalu berdekatan!`, 'warning');
                return false;
            }
        }
    }
    
    // Cek apakah poligon memiliki luas (tidak semua titik segaris)
    let luas = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        luas += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    
    if (Math.abs(luas) < 1e-6) {
        showToast('Titik-titik membentuk garis lurus! Luas = 0', 'warning');
        return false;
    }
    
    return true;
}

// ============================================================
// FUNGSI PERHITUNGAN INTEGRAL
// ============================================================
function hitungLuasPoligon(points) {
    if (points.length < 3) return 0;
    
    let luas = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        luas += points[i].x * points[j].y;
        luas -= points[j].x * points[i].y;
    }
    
    return Math.abs(luas) / 2;
}
function hitungPerimeter(points) {
    if (points.length < 3) return 0;
    let perimeter = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        perimeter += Math.sqrt(dx*dx + dy*dy);
    }
    return perimeter;
}
// Fungsi ini melakukan interpolasi LINEAR (bukan spline)
// Untuk menambah titik di antara titik-titik yang ada
function interpolasiLinear(points, faktor = 3) {
    if (points.length < 3 || faktor <= 1) return points;
    
    const hasil = [];
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        
        hasil.push(p1);
        
        for (let j = 1; j < faktor; j++) {
            const t = j / faktor;
            const x = p1.x + t * (p2.x - p1.x);
            const y = p1.y + t * (p2.y - p1.y);
            hasil.push({ x, y });
        }
    }
    
    return hasil;
}

// Untuk kompatibilitas dengan kode lama, tetap sediakan fungsi dengan nama lama
function interpolasiSpline(points, faktor = 3) {
    console.warn('interpolasiSpline sebenarnya adalah interpolasi linear');
    return interpolasiLinear(points, faktor);
}

function cariPerpotongan(points, x) {
     // Bulatkan x untuk menghindari floating point error
    x = Math.round(x * 1e10) / 1e10;
    const intersections = [];
    const n = points.length;
    const EPS = 1e-10; // Toleransi untuk floating point
    
    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        
        // Skip jika segmen vertikal (akan ditangani dengan toleransi)
        if (Math.abs(p1.x - p2.x) < EPS) {
            // Untuk segmen vertikal, cek apakah x berada tepat di x segmen
            if (Math.abs(p1.x - x) < EPS) {
                intersections.push(p1.y);
                intersections.push(p2.y);
            }
            continue;
        }
        
        // Cek apakah x berada di antara x1 dan x2 (inklusif dengan toleransi)
        const minX = Math.min(p1.x, p2.x) - EPS;
        const maxX = Math.max(p1.x, p2.x) + EPS;
        
        if (x >= minX && x <= maxX) {
            // Hitung parameter t (0..1)
            const t = (x - p1.x) / (p2.x - p1.x);
            
            // Hanya ambil jika t dalam rentang [0,1] dengan toleransi
            if (t >= -EPS && t <= 1 + EPS) {
                const y = p1.y + t * (p2.y - p1.y);
                intersections.push(y);
            }
        }
    }
    
    // Urutkan dan hilangkan duplikat dengan toleransi
    intersections.sort((a, b) => a - b);
    
    const unique = [];
    for (let i = 0; i < intersections.length; i++) {
        if (i === 0 || Math.abs(intersections[i] - intersections[i-1]) > EPS) {
            unique.push(intersections[i]);
        }
    }
    
    return unique;
}

function hitungLuasRiemann(points, partisi = 200) {
    if (points.length < 3) return 0;
    
    // Ambil pilihan jenis Riemann dari DOM
    const riemannTypeSelect = document.getElementById('fiturRiemannType');
    const riemannType = riemannTypeSelect ? riemannTypeSelect.value : 'kiri';
    
    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const dx = (xMax - xMin) / partisi;
    
    let luas = 0;
    
    for (let i = 0; i < partisi; i++) {
        let x;
        
        // Tentukan titik x berdasarkan jenis Riemann
        switch(riemannType) {
            case 'kanan':
                // Riemann Kanan: ambil titik ujung kanan interval
                x = xMin + (i + 1) * dx;
                break;
            case 'tengah':
                // Riemann Tengah: ambil titik tengah interval
                x = xMin + (i + 0.5) * dx;
                break;
            default:
                // Riemann Kiri: ambil titik ujung kiri interval
                x = xMin + i * dx;
                break;
        }
        
        const perpotongan = cariPerpotongan(points, x);
        perpotongan.sort((a, b) => a - b);
        
        for (let j = 0; j < perpotongan.length - 1; j += 2) {
            const tinggi = Math.abs(perpotongan[j + 1] - perpotongan[j]);
            luas += tinggi * dx;
        }
    }
    
    return Math.abs(luas);
}

// ============================================================
// FUNGSI TRAPEZOIDA ADAPTIVE
// ============================================================

// Helper: Mendapatkan tinggi total pada titik x
function getTinggiPadaX(points, x) {
    const perpotongan = cariPerpotongan(points, x);
    perpotongan.sort((a, b) => a - b);
    
    let totalTinggi = 0;
    for (let j = 0; j < perpotongan.length - 1; j += 2) {
        totalTinggi += Math.abs(perpotongan[j + 1] - perpotongan[j]);
    }
    return totalTinggi;
}

// Trapezoida Adaptive (rekursif)
function hitungLuasTrapezoidaAdaptive(points, a, b, toleransi, kedalaman = 0, maxKedalaman = 15) {
    // Fungsi untuk mendapatkan tinggi di titik x
    const f = (x) => getTinggiPadaX(points, x);
    
    // Hitung luas dengan 1 trapesium
    const fA = f(a);
    const fB = f(b);
    const luas1 = (fA + fB) / 2 * (b - a);
    
    // Hitung titik tengah
    const c = (a + b) / 2;
    const fC = f(c);
    
    // Hitung luas dengan 2 trapesium
    const luas2Kiri = (fA + fC) / 2 * (c - a);
    const luas2Kanan = (fC + fB) / 2 * (b - c);
    const luas2 = luas2Kiri + luas2Kanan;
    
    // Estimasi error (selisih antara aproksimasi halus dan kasar)
    const error = Math.abs(luas2 - luas1);
    
    // Jika error cukup kecil atau sudah mencapai kedalaman maksimal, return luas2
    if (error < toleransi || kedalaman >= maxKedalaman) {
        return luas2;
    }
    
    // Rekursif: bagi jadi 2 bagian dengan toleransi setengah
    const toleransiBaru = toleransi / 2;
    const kiri = hitungLuasTrapezoidaAdaptive(points, a, c, toleransiBaru, kedalaman + 1, maxKedalaman);
    const kanan = hitungLuasTrapezoidaAdaptive(points, c, b, toleransiBaru, kedalaman + 1, maxKedalaman);
    
    return kiri + kanan;
}

// Fungsi utama Trapezoida (dengan pilihan adaptive atau uniform)
function hitungLuasTrapezoida(points, partisi = 200) {
    if (points.length < 3) return 0;
    
    // Ambil pilihan adaptive dari DOM
    const adaptiveSelect = document.getElementById('fiturAdaptiveTrap');
    const isAdaptive = adaptiveSelect ? adaptiveSelect.value === 'true' : false;
    
    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    
    // Jika non-adaptive (Uniform), gunakan metode lama
    if (!isAdaptive) {
        const dx = (xMax - xMin) / partisi;
        let luas = 0;
        
        for (let i = 0; i < partisi; i++) {
            const xKiri = xMin + i * dx;
            const xKanan = xKiri + dx;
            
            const tinggiKiri = getTinggiPadaX(points, xKiri);
            const tinggiKanan = getTinggiPadaX(points, xKanan);
            
            luas += (tinggiKiri + tinggiKanan) / 2 * dx;
        }
        
        return Math.abs(luas);
    }
    
    // Jika adaptive, gunakan metode adaptive
    // Toleransi: semakin besar partisi, semakin kecil toleransi (lebih akurat)
    // Partisi 200 → toleransi 0.005, partisi 1000 → toleransi 0.001
    const toleransi = Math.max(0.0001, 1 / partisi);
    
    // Hitung luas dengan metode adaptive
    let luas = hitungLuasTrapezoidaAdaptive(points, xMin, xMax, toleransi);
    
    return Math.abs(luas);
}


// Fungsi utama Simpson dengan pilihan metode
function hitungLuasSimpson(points, partisi) {
    if (points.length < 3) return 0;
    
    const simpsonTypeSelect = document.getElementById('fiturSimpsonType');
    const simpsonType = simpsonTypeSelect ? simpsonTypeSelect.value : '13';
    
    switch(simpsonType) {
        case '38':
            return hitungLuasSimpson38(points, partisi);
        case 'auto':
            // Auto pilih metode terbaik berdasarkan partisi
            if (partisi % 3 === 0) {
                return hitungLuasSimpson38(points, partisi);
            } else if (partisi % 2 === 0) {
                return hitungLuasSimpson13(points, partisi);
            } else {
                // Jika partisi ganjil, gunakan Simpson 1/3 dengan n+1 (genap)
                return hitungLuasSimpson13(points, partisi + 1);
            }
        default:
            return hitungLuasSimpson13(points, partisi);
    }
}
    
    // Simpson 1/3
function hitungLuasSimpson13(points, partisi) {
    if (points.length < 3) return 0;
    
    // Simpson 1/3 membutuhkan n genap
    let n = partisi;
    if (n % 2 !== 0) n++;
    
    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const h = (xMax - xMin) / n;
    
    const tinggi = [];
    for (let i = 0; i <= n; i++) {
        const x = xMin + i * h;
        // Gunakan getTinggiPadaX yang sudah terbukti akurat
        const totalTinggi = getTinggiPadaX(points, x);
        tinggi.push(totalTinggi);
    }
    
    let luas = tinggi[0] + tinggi[n];
    for (let i = 1; i < n; i += 2) {
        luas += 4 * tinggi[i];
    }
    for (let i = 2; i < n; i += 2) {
        luas += 2 * tinggi[i];
    }
    
    return Math.abs(luas * h / 3);
}

// Simpson 3/8
function hitungLuasSimpson38(points, partisi) {
    if (points.length < 3) return 0;
    
    // Simpson 3/8 membutuhkan n kelipatan 3
    let n = partisi;
    while (n % 3 !== 0) n++;
    
    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const h = (xMax - xMin) / n;
    
    const tinggi = [];
    for (let i = 0; i <= n; i++) {
        const x = xMin + i * h;
        const totalTinggi = getTinggiPadaX(points, x);
        tinggi.push(totalTinggi);
    }
    
    let luas = tinggi[0] + tinggi[n];
    for (let i = 1; i < n; i++) {
        if (i % 3 === 0) {
            luas += 2 * tinggi[i];
        } else {
            luas += 3 * tinggi[i];
        }
    }
    
    return Math.abs(luas * 3 * h / 8);
}

function hitungError(nilai, referensi) {
    // Jika referensi 0 (luas poligon = 0)
    if (Math.abs(referensi) < 1e-10) {
        // Jika nilai juga 0, error 0%
        if (Math.abs(nilai) < 1e-10) return 0;
        // Jika referensi 0 tapi nilai > 0, error 100%
        return 100;
    }
    
    // Hitung error relatif
    const error = Math.abs((nilai - referensi) / referensi * 100);
    
    // Batasi error maksimal 100% untuk tampilan yang lebih baik
    return Math.min(error, 100);
}

function hitungSemuaLuas(points) {
    const partisi = parseInt(document.getElementById('fiturPartisi')?.value) || 200;
    const faktorInterpolasi = parseInt(document.getElementById('fiturInterpolasi')?.value) || 1;
    const riemannTypeSelect = document.getElementById('fiturRiemannType');
    const riemannType = riemannTypeSelect ? riemannTypeSelect.value : 'kiri';
    const simpsonTypeSelect = document.getElementById('fiturSimpsonType');
    const simpsonType = simpsonTypeSelect ? simpsonTypeSelect.value : '13';
    const adaptiveSelect = document.getElementById('fiturAdaptiveTrap');
    const isAdaptive = adaptiveSelect ? adaptiveSelect.value === 'true' : false;
    
    let pointsProcess = points;
    
    if (faktorInterpolasi > 1) {
        pointsProcess = interpolasiSpline(points, faktorInterpolasi);
    }
    
    const luasPoligon = hitungLuasPoligon(pointsProcess);
    const luasRiemann = hitungLuasRiemann(pointsProcess, partisi);
    const luasTrapezoida = hitungLuasTrapezoida(pointsProcess, partisi);  // sudah support adaptive
    const luasSimpson = hitungLuasSimpson(pointsProcess, partisi);
    const perimeter = hitungPerimeter(pointsProcess);
    return {
        poligon: luasPoligon,
        riemann: luasRiemann,
        trapezoida: luasTrapezoida,
        simpson: luasSimpson,
        errorRiemann: hitungError(luasRiemann, luasPoligon),
        errorTrapezoida: hitungError(luasTrapezoida, luasPoligon),
        errorSimpson: hitungError(luasSimpson, luasPoligon),
        partisi: partisi,
        interpolasi: faktorInterpolasi,
        riemannType: riemannType,
        simpsonType: simpsonType,
        adaptiveTrap: isAdaptive,
        perimeter: perimeter  // ← TAMBAHKAN INI
    };
}

// ============================================================
// FUNGSI GAMBAR CANVAS
// ============================================================
function drawEmptyCanvas() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.fillText('⏳ Masukkan titik dan tekan HITUNG LUAS', canvas.width/2 - 180, canvas.height/2);
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('X (meter)', canvas.width - 70, canvas.height - 20);
    ctx.fillText('Y (meter)', 15, 40);
}

function drawLahan(points, hasil) {
    if (!ctx || points.length === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    
    let xMin = Math.min(...xValues, 0);
    let xMax = Math.max(...xValues, 0);
    let yMin = Math.min(...yValues, 0);
    let yMax = Math.max(...yValues, 0);

    const margin = 0.15;
    const rangeX = xMax - xMin || 1;
    const rangeY = yMax - yMin || 1;
    
    xMin -= rangeX * margin;
    xMax += rangeX * margin;
    yMin -= rangeY * margin;
    yMax += rangeY * margin;

    const padding = {
        left: 70,
        right: 70,
        top: 50,
        bottom: 120
    };

    const scaleX = (canvas.width - padding.left - padding.right) / (xMax - xMin);
    const scaleY = (canvas.height - padding.top - padding.bottom) / (yMax - yMin);
    const scale = Math.min(scaleX, scaleY);

    function toX(coord) {
        return padding.left + (coord - xMin) * scale + panOffset.x * zoomLevel;
    }

    function toY(coord) {
        return canvas.height - padding.bottom - (coord - yMin) * scale + panOffset.y * zoomLevel;
    }

    // Grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666';

    for (let x = Math.ceil(xMin); x <= xMax; x += 1) {
        const canvasX = toX(x);
        if (canvasX < padding.left || canvasX > canvas.width - padding.right) continue;
        
        ctx.beginPath();
        ctx.moveTo(canvasX, 0);
        ctx.lineTo(canvasX, canvas.height - padding.bottom);
        ctx.stroke();
        ctx.fillText(x, canvasX - 5, canvas.height - padding.bottom + 20);
    }

    for (let y = Math.ceil(yMin); y <= yMax; y += 1) {
        const canvasY = toY(y);
        if (canvasY < padding.top || canvasY > canvas.height - padding.bottom) continue;
        
        ctx.beginPath();
        ctx.moveTo(padding.left, canvasY);
        ctx.lineTo(canvas.width - padding.right, canvasY);
        ctx.stroke();
        ctx.fillText(y, padding.left - 25, canvasY + 3);
    }

    // Sumbu
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#333';
    
    const yZero = toY(0);
    ctx.beginPath();
    ctx.moveTo(padding.left, yZero);
    ctx.lineTo(canvas.width - padding.right, yZero);
    ctx.stroke();

    const xZero = toX(0);
    ctx.beginPath();
    ctx.moveTo(xZero, padding.top);
    ctx.lineTo(xZero, canvas.height - padding.bottom);
    ctx.stroke();

    // Poligon
    ctx.beginPath();
    ctx.moveTo(toX(points[0].x), toY(points[0].y));
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(toX(points[i].x), toY(points[i].y));
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Titik
    points.forEach((point, i) => {
        const cx = toX(point.x);
        const cy = toY(point.y);
        
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#c62828';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(`P${i+1}`, cx + 8, cy - 8);
    });

    // Label sumbu
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('X (meter)', canvas.width - 80, canvas.height - padding.bottom + 40);
    
    ctx.save();
    ctx.translate(30, canvas.height/2 - 30);
    ctx.rotate(-Math.PI/2);
    ctx.fillText('Y (meter)', 0, 0);
    ctx.restore();

    // Info
    const infoY = canvas.height - 85;
    const presisi = parseInt(document.getElementById('fiturPresisi')?.value) || 3;
    
    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Luas: ${formatAngka(hasil.poligon, presisi)} m²`, 20, infoY);
    
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.fillText(`Titik: ${points.length}`, 20, infoY + 20);
    
    ctx.fillStyle = '#0288d1';
    ctx.fillText(`Partisi: ${hasil.partisi || 200}`, 200, infoY);
    
    ctx.fillStyle = '#666';
    ctx.fillText(`Zoom: ${(zoomLevel * 100).toFixed(0)}%`, 200, infoY + 20);
    
    if (hasil && hasil.errorRiemann !== undefined) {
        const errors = [
            { name: 'Riemann', error: hasil.errorRiemann },
            { name: 'Trapezoida', error: hasil.errorTrapezoida },
            { name: 'Simpson', error: hasil.errorSimpson }
        ];
        const terbaik = errors.reduce((min, curr) => curr.error < min.error ? curr : min);
        
        ctx.fillStyle = '#7b1fa2';
        ctx.fillText(`Terbaik: ${terbaik.name}`, 380, infoY);
        ctx.fillStyle = '#666';
        ctx.fillText(`error ${terbaik.error.toFixed(presisi)}%`, 380, infoY + 20);
    }

    // Legenda
    const legendY = canvas.height - 30;
    const methods = [
        { name: 'Poligon', color: '#2e7d32', value: formatAngka(hasil.poligon, presisi) },
        { name: 'Riemann', color: '#0288d1', value: formatAngka(hasil.riemann, presisi) },
        { name: 'Trapezoida', color: '#ff6f00', value: formatAngka(hasil.trapezoida, presisi) },
        { name: 'Simpson', color: '#7b1fa2', value: formatAngka(hasil.simpson, presisi) }
    ];

    ctx.font = '11px Arial';
    let xPos = 20;
    
    methods.forEach((m, i) => {
        ctx.beginPath();
        ctx.arc(xPos + 5, legendY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = m.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.fillText(`${m.name}: ${m.value} m²`, xPos + 15, legendY + 4);
        
        xPos += 150;
        if (i === 1) xPos = 20 + 300;
    });

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, canvas.height - 100);
    ctx.lineTo(canvas.width - 10, canvas.height - 100);
    ctx.stroke();
}

// ============================================================
// FUNGSI TAMPILKAN PERHITUNGAN
// ============================================================
function tampilkanPerhitungan(points, hasil, xMin, xMax, presisi = 3) {
    const container = document.getElementById('perhitunganContainer');
    if (!container) return;
    
    let html = '<div class="perhitungan-tab">';
    html += '<div class="perhitungan-header" id="perhitunganHeader">';
    html += '<span>🔍 DETAIL PERHITUNGAN</span>';
    html += '<span class="roll-icon" id="perhitunganIcon">▼</span>';
    html += '</div>';
    html += '<div class="perhitungan-body" id="perhitunganBody">';
        // Informasi interpolasi jika aktif
    if (hasil.interpolasi && hasil.interpolasi > 1) {
        html += `<div style="background: #fff3e0; padding: 8px 12px; margin-bottom: 15px; border-radius: 6px; border-left: 4px solid #ff6f00;">
                    <strong>⚠️ Interpolasi aktif (${hasil.interpolasi}×)</strong> — titik batas lahan telah dihaluskan dengan menambah titik di antaranya.
                 </div>`;
    }

    // Poligon
    html += '<div class="perhitungan-step">';
    html += '<h4>📐 Metode Poligon (Shoelace)</h4>';
    html += `<p>Partisi: ${hasil.partisi} interval</p>`;
    html += '<p>Rumus: Luas = ½|Σ(xᵢyᵢ₊₁ - xᵢ₊₁yᵢ)|</p>';
    html += '<div class="formula">';
    let total = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        total += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    html += `Σ = ${total}<br>`;
    html += `Luas = ½ × |${total}| = ${formatAngka(Math.abs(total)/2, presisi)} m²`;
    html += '</div>';
    html += '</div>';
    
    // Riemann
const riemannTypeText = {
    'kiri': 'Kiri (f(xᵢ) · Δx)',
    'kanan': 'Kanan (f(xᵢ₊₁) · Δx)',
    'tengah': 'Tengah (f(xᵢ + Δx/2) · Δx)'
}[hasil.riemannType] || 'Kiri (f(xᵢ) · Δx)';

html += '<div class="perhitungan-step">';
html += '<h4>🧱 Metode Riemann</h4>';
html += `<p><strong>Jenis:</strong> Riemann ${riemannTypeText}</p>`;
html += `<p>Partisi: ${hasil.partisi} interval</p>`;
html += `<p>Δx = (${xMax.toFixed(2)} - ${xMin.toFixed(2)}) / ${hasil.partisi} = ${((xMax-xMin)/hasil.partisi).toFixed(4)} meter</p>`;
html += `<p>Luas ≈ ${formatAngka(hasil.riemann, presisi)} m²</p>`;
html += `<p class="hasil">Error: ${hasil.errorRiemann.toFixed(presisi)}%</p>`;
html += '</div>';
    
    // Trapezoida
const trapezoidaText = hasil.adaptiveTrap ? 
    'Adaptive (partisi lebih rapat di area melengkung)' : 
    'Uniform (partisi sama rata)';
const hTrap = (xMax - xMin) / hasil.partisi;

html += '<div class="perhitungan-step">';
html += '<h4>📊 Metode Trapezoida</h4>';
html += `<p><strong>Jenis:</strong> ${trapezoidaText}</p>`;
html += `<p>Partisi: ${hasil.partisi} interval</p>`;
html += `<p>Rumus: Luas ≈ Δx · (½f₀ + f₁ + f₂ + ... + fₙ₋₁ + ½fₙ)</p>`;
html += `<p>Δx = (${xMax.toFixed(2)} - ${xMin.toFixed(2)}) / ${hasil.partisi} = ${hTrap.toFixed(4)} meter</p>`;
html += `<p>Luas ≈ ${formatAngka(hasil.trapezoida, presisi)} m²</p>`;
html += `<p class="hasil">Error: ${hasil.errorTrapezoida.toFixed(presisi)}%</p>`;
html += '</div>';
    
    // Simpson
const simpsonTypeText = {
    '13': 'Simpson 1/3 (Parabola)',
    '38': 'Simpson 3/8 (Kubik)',
    'auto': 'Simpson Auto (Gabungan)'
}[hasil.simpsonType] || 'Simpson 1/3';

let simpsonRumus = '';
if (hasil.simpsonType === '13') {
    simpsonRumus = 'Luas ≈ (h/3) · (y₀ + 4y₁ + 2y₂ + 4y₃ + ... + yₙ)';
} else if (hasil.simpsonType === '38') {
    simpsonRumus = 'Luas ≈ (3h/8) · (y₀ + 3y₁ + 3y₂ + 2y₃ + ... + yₙ)';
} else {
    simpsonRumus = 'Gabungan Simpson 1/3 dan 3/8 (auto)';
}
const hSimpson = (xMax - xMin) / hasil.partisi;

html += '<div class="perhitungan-step">';
html += '<h4>📈 Metode Simpson</h4>';
html += `<p><strong>Jenis:</strong> ${simpsonTypeText}</p>`;
html += `<p>Partisi: ${hasil.partisi} interval</p>`;
html += `<p>Rumus: ${simpsonRumus}</p>`;
html += `<p>h = (${xMax.toFixed(2)} - ${xMin.toFixed(2)}) / ${hasil.partisi} = ${hSimpson.toFixed(4)} meter</p>`;
html += `<p>Luas ≈ ${formatAngka(hasil.simpson, presisi)} m²</p>`;
html += `<p class="hasil">Error: ${hasil.errorSimpson.toFixed(presisi)}%</p>`;
html += '</div>';
    
    html += '</div></div>';
    
    container.innerHTML = html;
    
    const header = document.getElementById('perhitunganHeader');
    const body = document.getElementById('perhitunganBody');
    const icon = document.getElementById('perhitunganIcon');
    
    if (header) {
        header.addEventListener('click', function() {
            if (body.style.display === 'none') {
                body.style.display = 'block';
                icon.textContent = '▼';
            } else {
                body.style.display = 'none';
                icon.textContent = '▶';
            }
        });
    }
}

// ============================================================
// FUNGSI UTAMA HITUNG LUAS
// ============================================================
function hitungLuas() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    setTimeout(() => {
        let points = readPointsFromInput();
        
        if (!validasiTitik(points)) {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }
        
        saveToHistory(points);
        currentPoints = points;
        
        const hasil = hitungSemuaLuas(points);
        const presisi = parseInt(document.getElementById('fiturPresisi')?.value) || 3;
        const xValues = points.map(p => p.x);
        const xMin = Math.min(...xValues, 0);
        const xMax = Math.max(...xValues, 0);
        
        const luasPoligonElem = document.getElementById('luasPoligon');
        const luasRiemannElem = document.getElementById('luasRiemann');
        const luasTrapezoidaElem = document.getElementById('luasTrapezoida');
        const luasSimpsonElem = document.getElementById('luasSimpson');
        const errorRiemannElem = document.getElementById('errorRiemann');
        const errorTrapezoidaElem = document.getElementById('errorTrapezoida');
        const errorSimpsonElem = document.getElementById('errorSimpson');
        const kesimpulanTextElem = document.getElementById('kesimpulanText');
        const kesimpulanDetailElem = document.getElementById('kesimpulanDetail');
        const infoInterpolasiElem = document.getElementById('infoInterpolasi');
        
        if (luasPoligonElem) luasPoligonElem.textContent = formatAngka(hasil.poligon, presisi);
if (luasRiemannElem) luasRiemannElem.textContent = formatAngka(hasil.riemann, presisi);
if (luasTrapezoidaElem) luasTrapezoidaElem.textContent = formatAngka(hasil.trapezoida, presisi);
if (luasSimpsonElem) luasSimpsonElem.textContent = formatAngka(hasil.simpson, presisi);
        
        if (errorRiemannElem) errorRiemannElem.textContent = hasil.errorRiemann.toFixed(presisi) + '%';
        if (errorTrapezoidaElem) errorTrapezoidaElem.textContent = hasil.errorTrapezoida.toFixed(presisi) + '%';
        if (errorSimpsonElem) errorSimpsonElem.textContent = hasil.errorSimpson.toFixed(presisi) + '%';
        
        const errors = [
            { metode: 'Riemann', error: hasil.errorRiemann },
            { metode: 'Trapezoida', error: hasil.errorTrapezoida },
            { metode: 'Simpson', error: hasil.errorSimpson }
        ];
        const terbaik = errors.reduce((min, curr) => curr.error < min.error ? curr : min);
        
        if (kesimpulanTextElem) {
            kesimpulanTextElem.innerHTML = `✅ Luas lahan referensi: <strong>${formatAngka(hasil.poligon, presisi)} m²</strong>`;
        }
        
        if (kesimpulanDetailElem) {
            kesimpulanDetailElem.innerHTML = `
                Metode terbaik: <strong>${terbaik.metode}</strong> dengan error ${terbaik.error.toFixed(presisi)}%<br>
                <small style="color:#666;">Partisi: ${hasil.partisi} | Interpolasi: ${hasil.interpolasi}×</small>
            `;
        }
        
        if (infoInterpolasiElem) {
    const riemannTypeMap = {
        'kiri': 'Kiri',
        'kanan': 'Kanan',
        'tengah': 'Tengah'
    };
    const riemannTypeText = riemannTypeMap[hasil.riemannType] || 'Kiri';
    
    const simpsonTypeMap = {
        '13': '1/3',
        '38': '3/8',
        'auto': 'Auto'
    };
    const simpsonTypeText = simpsonTypeMap[hasil.simpsonType] || '1/3';
    
    const trapezoidaText = hasil.adaptiveTrap ? 'Adaptive' : 'Uniform';
    
    infoInterpolasiElem.innerHTML = `
        <strong>💡 STATUS:</strong> Partisi ${hasil.partisi} | 
        Interpolasi ${hasil.interpolasi}× | 
        Presisi ${presisi} desimal |
        Riemann ${riemannTypeText} |
        Trapezoida ${trapezoidaText} |
        Simpson ${simpsonTypeText}
    `;
}
// ============================================================
// FITUR KELILING MANUAL (override hasil hitung)
// ============================================================
const kelilingManualInput = document.getElementById('kelilingManual');
const kelilingValueSpan = document.getElementById('kelilingValue');
const hargaPagarInput = document.getElementById('hargaPagar');
const totalBiayaSpan = document.getElementById('totalBiaya');

// Fungsi untuk memperbarui tampilan keliling dan biaya
function updateManualKeliling() {
    if (!kelilingValueSpan || !totalBiayaSpan) return;
    
    let kelilingTerpakai = hasil.perimeter; // default dari hitungan
    let isManual = false;
    
    // Jika input manual diisi dan valid
    if (kelilingManualInput) {
        let manualVal = parseFloat(kelilingManualInput.value);
        if (!isNaN(manualVal) && manualVal > 0) {
            kelilingTerpakai = manualVal;
            isManual = true;
        }
    }
    
    // Tampilkan keliling dengan label manual jika perlu
    if (isManual) {
        kelilingValueSpan.innerHTML = `${formatAngka(kelilingTerpakai, presisi)} m <span style="font-size: 11px; color: #ff9800;">(manual)</span>`;
    } else {
        kelilingValueSpan.innerHTML = `${formatAngka(kelilingTerpakai, presisi)} m`;
    }
    
    // Hitung total biaya
    let harga = 0;
    if (hargaPagarInput) harga = parseFloat(hargaPagarInput.value) || 0;
    let total = harga * kelilingTerpakai;
    totalBiayaSpan.textContent = 'Rp ' + formatAngka(total, 0).replace(',', '.');
}

// Pasang event listener untuk input manual dan harga
if (kelilingManualInput) {
    kelilingManualInput.removeEventListener('input', updateManualKeliling);
    kelilingManualInput.addEventListener('input', updateManualKeliling);
}
if (hargaPagarInput) {
    hargaPagarInput.removeEventListener('input', updateManualKeliling);
    hargaPagarInput.addEventListener('input', updateManualKeliling);
}

// Jalankan sekali untuk inisialisasi (biaya awal)
updateManualKeliling();
        
// ============================================================
// FITUR ESTIMASI BIBIT (dengan manual override luas)
// ============================================================
const jarakTanamInput = document.getElementById('jarakTanam');
const luasManualBibitInput = document.getElementById('luasManualBibit');
const jumlahBibitSpan = document.getElementById('jumlahBibit');

function updateEstimasiBibit() {
    if (!jumlahBibitSpan) return;
    
    // Tentukan luas yang dipakai: manual jika diisi, else dari hasil poligon
    let luasTerpakai = hasil.poligon;
    let isManualLuas = false;
    if (luasManualBibitInput) {
        let manualVal = parseFloat(luasManualBibitInput.value);
        if (!isNaN(manualVal) && manualVal > 0) {
            luasTerpakai = manualVal;
            isManualLuas = true;
        }
    }
    
    // Jarak tanam
    let jarak = parseFloat(jarakTanamInput?.value);
    if (isNaN(jarak) || jarak <= 0) jarak = 1;
    const luasPerTanaman = jarak * jarak;
    let jumlah = Math.floor(luasTerpakai / luasPerTanaman);
    
    // Tampilkan dengan indikator manual jika perlu
    if (isManualLuas) {
        jumlahBibitSpan.innerHTML = `${jumlah.toLocaleString('id-ID')} pohon <span style="font-size: 11px; color: #ff9800;">(luas manual)</span>`;
    } else {
        jumlahBibitSpan.innerHTML = `${jumlah.toLocaleString('id-ID')} pohon`;
    }
    if (luasTerpakai === 0) jumlahBibitSpan.innerHTML = '- pohon';
}

// Pasang event listener
if (jarakTanamInput) {
    jarakTanamInput.removeEventListener('input', updateEstimasiBibit);
    jarakTanamInput.addEventListener('input', updateEstimasiBibit);
}
if (luasManualBibitInput) {
    luasManualBibitInput.removeEventListener('input', updateEstimasiBibit);
    luasManualBibitInput.addEventListener('input', updateEstimasiBibit);
}
// Panggil sekali untuk inisialisasi
updateEstimasiBibit();

        drawLahan(points, hasil);
        tampilkanPerhitungan(points, hasil, xMin, xMax, presisi);
        // Tampilkan keliling
const kelilingElem = document.getElementById('kelilingValue');
if (kelilingElem) {
    kelilingElem.textContent = formatAngka(hasil.perimeter, presisi) + ' m';
}
        // Auto update konversi satuan dengan luas poligon (meter persegi)
        const konversiInput = document.getElementById('konversiInput');
        if (konversiInput) {
            konversiInput.value = hasil.poligon.toFixed(presisi);
            updateKonversi();  // memicu perhitungan ulang konversi
        }
// Fungsi untuk update biaya berdasarkan harga pagar
const hargaInput = document.getElementById('hargaPagar');
const totalBiayaElem = document.getElementById('totalBiaya');

function updateBiaya() {
    if (!hargaInput || !totalBiayaElem) return;
    const harga = parseFloat(hargaInput.value) || 0;
    const keliling = hasil.perimeter || 0;
    const total = harga * keliling;
    totalBiayaElem.textContent = 'Rp ' + formatAngka(total, 0).replace(',', '.');
}

if (hargaInput && totalBiayaElem) {
    // Hapus event listener lama jika ada, lalu pasang yang baru
    hargaInput.removeEventListener('input', updateBiaya);
    hargaInput.addEventListener('input', updateBiaya);
    updateBiaya(); // hitung langsung
}
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        showToast('✅ Perhitungan selesai!', 'success');
    }, 100);
}

// ============================================================
// FUNGSI LAINNYA
// ============================================================
function saveToHistory(points) {
    history.push({
        points: JSON.parse(JSON.stringify(points)),
        timestamp: new Date().toISOString()
    });
    currentHistoryIndex = history.length - 1;
    
    if (history.length > 10) {
        history.shift();
        currentHistoryIndex--;
    }
}

function resetAll(){
    // Reset peta juga
    if (typeof resetMapPoints !== 'undefined') {
        resetMapPoints();
    }
    // Reset estimasi bibit
const luasManualBibitInput = document.getElementById('luasManualBibit');
if (luasManualBibitInput) luasManualBibitInput.value = '';
const jarakTanamInput = document.getElementById('jarakTanam');
if (jarakTanamInput) jarakTanamInput.value = '2';
const jumlahBibitSpan = document.getElementById('jumlahBibit');
if (jumlahBibitSpan) jumlahBibitSpan.textContent = '- pohon';
const kelilingManualInput = document.getElementById('kelilingManual');
    if (kelilingManualInput) kelilingManualInput.value = '';
    const jumlahTitikElem = document.getElementById('jumlahTitik');
    if (jumlahTitikElem) jumlahTitikElem.value = 5;
    generateInputFields();
    const kelilingElem = document.getElementById('kelilingValue');
if (kelilingElem) kelilingElem.textContent = '- meter';
const totalBiayaElem = document.getElementById('totalBiaya');
if (totalBiayaElem) totalBiayaElem.textContent = 'Rp 0';
    resetView();
    drawEmptyCanvas();
    
    const luasPoligonElem = document.getElementById('luasPoligon');
    const luasRiemannElem = document.getElementById('luasRiemann');
    const luasTrapezoidaElem = document.getElementById('luasTrapezoida');
    const luasSimpsonElem = document.getElementById('luasSimpson');
    const errorRiemannElem = document.getElementById('errorRiemann');
    const errorTrapezoidaElem = document.getElementById('errorTrapezoida');
    const errorSimpsonElem = document.getElementById('errorSimpson');
    const kesimpulanTextElem = document.getElementById('kesimpulanText');
    const kesimpulanDetailElem = document.getElementById('kesimpulanDetail');
    const infoInterpolasiElem = document.getElementById('infoInterpolasi');
    const perhitunganContainer = document.getElementById('perhitunganContainer'); // TAMBAHKAN INI
    
    if (luasPoligonElem) luasPoligonElem.textContent = '-';
    if (luasRiemannElem) luasRiemannElem.textContent = '-';
    if (luasTrapezoidaElem) luasTrapezoidaElem.textContent = '-';
    if (luasSimpsonElem) luasSimpsonElem.textContent = '-';
    if (errorRiemannElem) errorRiemannElem.textContent = '-';
    if (errorTrapezoidaElem) errorTrapezoidaElem.textContent = '-';
    if (errorSimpsonElem) errorSimpsonElem.textContent = '-';
    
    if (kesimpulanTextElem) kesimpulanTextElem.innerHTML = '⏳ Silakan masukkan titik dan tekan HITUNG LUAS';
    if (kesimpulanDetailElem) kesimpulanDetailElem.innerHTML = '';
    if (infoInterpolasiElem) infoInterpolasiElem.innerHTML = '<strong>💡 STATUS:</strong> Siap menghitung. Partisi: 200';
    if (perhitunganContainer) perhitunganContainer.innerHTML = ''; // TAMBAHKAN INI
    // Hapus active class dari semua preset
document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    currentPoints = [];
    showToast('Semua direset', 'info');
}

function loadPreset(preset) {
    let points = [];
    
    switch(preset) {
        case 'persegi':
            points = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }];
            break;
        case 'segitiga':
            points = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 5 }];
            break;
        case 'trapesium':
            points = [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 4, y: 3 }, { x: 2, y: 3 }];
            break;
        case 'lahanL':
            points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 }];
            break;
        case 'lingkaran':
            for (let i = 0; i < 8; i++) {
                const sudut = (i / 8) * 2 * Math.PI;
                points.push({ x: 5 + 3 * Math.cos(sudut), y: 5 + 3 * Math.sin(sudut) });
            }
            break;
        case 'acak':
            points = [{ x: 1, y: 2 }, { x: 4, y: 1 }, { x: 6, y: 3 }, { x: 5, y: 6 }, { x: 2, y: 5 }];
            break;
    }
    
    setPointsToInput(points);
    showToast(`📋 Preset ${preset} dimuat`, 'success');
}

function importCSV() {
    const fileInput = document.getElementById('fileCSV');
    const file = fileInput?.files[0];
    
    if (!file) {
        showToast('Pilih file CSV terlebih dahulu!', 'warning');
        return;
    }
    
    // Validasi ukuran file (max 1MB)
    if (file.size > 1024 * 1024) {
        showToast('Ukuran file terlalu besar! Maksimal 1MB', 'error');
        return;
    }
    
    // Validasi ekstensi file
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
        showToast('Format file harus .csv atau .txt', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n');
            const points = [];
            
            // Batasi maksimal titik
            const MAX_POINTS = 100;
            
            for (let index = 0; index < lines.length && points.length < MAX_POINTS; index++) {
                const line = lines[index].trim();
                if (line === '' || line.startsWith('#') || line.startsWith('//')) continue;
                
                // Support berbagai separator: koma, spasi, tab, titik koma
                let parts;
                if (line.includes(',')) parts = line.split(',');
                else if (line.includes(';')) parts = line.split(';');
                else if (line.includes('\t')) parts = line.split('\t');
                else parts = line.split(/\s+/);
                
                if (parts.length >= 2) {
                    // Konversi koma desimal ke titik
                    let xStr = parts[0].replace(',', '.').trim();
                    let yStr = parts[1].replace(',', '.').trim();
                    
                    const x = parseFloat(xStr);
                    const y = parseFloat(yStr);
                    
                    if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
                        // Validasi rentang nilai yang masuk akal
                        if (Math.abs(x) > 10000 || Math.abs(y) > 10000) {
                            showToast(`Baris ${index+1}: koordinat terlalu besar, dilewati`, 'warning');
                            continue;
                        }
                        points.push({ x, y });
                    } else {
                        showToast(`Baris ${index+1} tidak valid, dilewati`, 'warning');
                    }
                }
            }
            
            if (points.length >= 3) {
                setPointsToInput(points);
                showToast(`✅ Berhasil import ${points.length} titik!`, 'success');
            } else if (points.length > 0 && points.length < 3) {
                showToast(`Hanya ${points.length} titik valid. Minimal 3 titik!`, 'error');
            } else {
                showToast('File CSV tidak valid atau kosong!', 'error');
            }
        } catch (err) {
            console.error('Import error:', err);
            showToast('Gagal membaca file!', 'error');
        }
    };
    
    reader.onerror = function() {
        showToast('Gagal membaca file!', 'error');
    };
    
    reader.readAsText(file, 'UTF-8');
}

function exportHasil() {
    if (!currentPoints || currentPoints.length < 3) {
        showToast('Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const hasil = hitungSemuaLuas(currentPoints);
    const presisi = parseInt(document.getElementById('fiturPresisi')?.value) || 3;
    
    const data = {
        timestamp: new Date().toISOString(),
        points: currentPoints,
        hasil: {
            poligon: hasil.poligon.toFixed(presisi),
            riemann: hasil.riemann.toFixed(presisi),
            trapezoida: hasil.trapezoida.toFixed(presisi),
            simpson: hasil.simpson.toFixed(presisi),
            errorRiemann: hasil.errorRiemann.toFixed(presisi) + '%',
            errorTrapezoida: hasil.errorTrapezoida.toFixed(presisi) + '%',
            errorSimpson: hasil.errorSimpson.toFixed(presisi) + '%'
        },
        settings: {
            partisi: hasil.partisi,
            interpolasi: hasil.interpolasi,
            presisi: presisi
        }
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `hasil_lahan_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('📥 Hasil diexport!', 'success');
}

function drawPartisiVisualisasi(jumlahPartisi = 10) {
    const canvasPartisi = document.getElementById('partisiCanvas');
    if (!canvasPartisi) return;
    
    const ctxPartisi = canvasPartisi.getContext('2d');
    ctxPartisi.clearRect(0, 0, canvasPartisi.width, canvasPartisi.height);
    
    ctxPartisi.beginPath();
    ctxPartisi.strokeStyle = '#2e7d32';
    ctxPartisi.lineWidth = 2;
    
    for (let x = 0; x <= 6; x += 0.1) {
        const canvasX = 40 + (x / 6) * (canvasPartisi.width - 80);
        const y = 0.5 * x * x + 1;
        const canvasY = canvasPartisi.height - 40 - (y / 15) * (canvasPartisi.height - 80);
        
        if (x === 0) ctxPartisi.moveTo(canvasX, canvasY);
        else ctxPartisi.lineTo(canvasX, canvasY);
    }
    ctxPartisi.stroke();
    
    ctxPartisi.beginPath();
    ctxPartisi.strokeStyle = '#333';
    ctxPartisi.lineWidth = 1;
    ctxPartisi.moveTo(40, canvasPartisi.height - 40);
    ctxPartisi.lineTo(canvasPartisi.width - 40, canvasPartisi.height - 40);
    ctxPartisi.stroke();
    ctxPartisi.moveTo(40, 40);
    ctxPartisi.lineTo(40, canvasPartisi.height - 40);
    ctxPartisi.stroke();
    
    const dx = 6 / jumlahPartisi;
    ctxPartisi.fillStyle = 'rgba(76, 175, 80, 0.3)';
    ctxPartisi.strokeStyle = '#ff6f00';
    ctxPartisi.lineWidth = 1;
    
    for (let i = 0; i < jumlahPartisi; i++) {
        const x1 = i * dx;
        const x2 = (i + 1) * dx;
        const xMid = (x1 + x2) / 2;
        const yMid = 0.5 * xMid * xMid + 1;
        
        const canvasX1 = 40 + (x1 / 6) * (canvasPartisi.width - 80);
        const canvasX2 = 40 + (x2 / 6) * (canvasPartisi.width - 80);
        const canvasYMid = canvasPartisi.height - 40 - (yMid / 15) * (canvasPartisi.height - 80);
        const canvasYBottom = canvasPartisi.height - 40;
        
        ctxPartisi.fillRect(canvasX1, canvasYMid, canvasX2 - canvasX1, canvasYBottom - canvasYMid);
        
        ctxPartisi.beginPath();
        ctxPartisi.moveTo(canvasX2, 40);
        ctxPartisi.lineTo(canvasX2, canvasPartisi.height - 40);
        ctxPartisi.stroke();
    }
    
    ctxPartisi.fillStyle = '#333';
    ctxPartisi.font = '10px Arial';
    ctxPartisi.fillText('0', 35, canvasPartisi.height - 25);
    ctxPartisi.fillText('6', canvasPartisi.width - 45, canvasPartisi.height - 25);
    ctxPartisi.fillText('f(x)', 15, 45);
    
    ctxPartisi.fillStyle = '#2e7d32';
    ctxPartisi.font = 'bold 12px Arial';
    ctxPartisi.fillText('f(x) = 0.5x² + 1', canvasPartisi.width - 150, 60);
}

function setupPartisiSlider() {
    const slider = document.getElementById('partisiSlider');
    const value = document.getElementById('partisiValue');
    const text = document.getElementById('jumlahPartisiText');
    const btn = document.getElementById('btnTerapkanPartisi');
    
    if (!slider) return;
    
    slider.addEventListener('input', function() {
        if (value) value.textContent = this.value;
        if (text) text.textContent = this.value;
    });
    
    if (btn) {
        btn.addEventListener('click', function() {
            drawPartisiVisualisasi(parseInt(slider.value));
        });
    }
    
    drawPartisiVisualisasi(10);
}

// ============================================================
// INISIALISASI SAAT HALAMAN DIMUAT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('lahanCanvas');
    ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;
    
    const btnGenerate = document.getElementById('btnGenerate');
    const btnHitung = document.getElementById('btnHitung');
    const btnReset = document.getElementById('btnReset');
    const btnImport = document.getElementById('btnImport');
    const btnExport = document.getElementById('btnExport');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnResetView = document.getElementById('btnResetView');
    const btnBantuan = document.getElementById('btnBantuan');
    const tutupPopup = document.getElementById('tutupPopup');
    const popupPanduan = document.getElementById('popupPanduan');
    
    if (btnGenerate) btnGenerate.addEventListener('click', debounce(generateInputFields, 300));
if (btnHitung) btnHitung.addEventListener('click', debounce(hitungLuas, 300));
if (btnReset) btnReset.addEventListener('click', debounce(resetAll, 300));
    if (btnImport) btnImport.addEventListener('click', importCSV);
    if (btnExport) btnExport.addEventListener('click', exportHasil);
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => zoom(1.2));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => zoom(0.8));
    if (btnResetView) btnResetView.addEventListener('click', resetView);
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Hapus active dari semua preset
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        // Tandai yang diklik sebagai active
        this.classList.add('active');
        
        const preset = this.dataset.preset;
        loadPreset(preset);
    });
});
    
    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', drag);
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', endDrag);

    // Touch events untuk mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(touch);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    drag(touch);
});
const btnKonversi = document.getElementById('btnKonversi');
if (btnKonversi) {
    btnKonversi.addEventListener('click', function() {
        updateKonversi();
        showToast('Konversi diperbarui', 'info');
    });
}
canvas.addEventListener('touchend', endDrag);
canvas.addEventListener('touchcancel', endDrag);
    
    generateInputFields();
    drawEmptyCanvas();
    setupPartisiSlider();
    
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey) {
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoom(1.2);
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoom(0.8);
            } else if (e.key === '0') {
                e.preventDefault();
                resetView();
            }
        }
    });
    
    if (btnBantuan && popupPanduan) {
        btnBantuan.addEventListener('click', function() {
            popupPanduan.classList.add('show');
            showToast('📖 Panduan dibuka', 'info');
        });
    }
    
    if (tutupPopup && popupPanduan) {
        tutupPopup.addEventListener('click', function() {
            popupPanduan.classList.remove('show');
        });
        
        popupPanduan.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
            }
        });
    }
    // ============================================================
// INTEGRASI PETA LEAFLET
// ============================================================

// Inisialisasi peta dengan koordinat default (UNIMED Medan)
// Latitude: 3.5952, Longitude: 98.6722
// Inisialisasi peta
var map = L.map('lahanMap').setView([3.5952, 98.6722], 12);

// Tambahkan tile layer dari OpenStreetMap dengan pengaturan zoom
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19, // Level zoom maksimal data yang tersedia
    maxZoom: 22        // Level zoom maksimal yang bisa dilakukan user
}).addTo(map);

// Array untuk menyimpan titik dari peta
var mapPoints = [];
var markers = [];

// Variabel untuk referensi titik pertama (konversi ke meter)
var referencePoint = null;
       // ========== MOBILE NAVIGATION (KIRI ATAS, DROPDOWN KE BAWAH) ==========
    const navBtn = document.getElementById('btnNavMobile');
    const navMenu = document.getElementById('navMobileMenu');

    function toggleNavButton() {
        if (!navBtn) return;
        if (window.innerWidth <= 768) {
            navBtn.style.display = 'block';
        } else {
            navBtn.style.display = 'none';
            if (navMenu) navMenu.classList.remove('show');
        }
    }

    if (navBtn && navMenu) {
        window.addEventListener('resize', toggleNavButton);
        toggleNavButton();

        navBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (navMenu && !navBtn.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('show');
            }
        });

        const menuButtons = navMenu.querySelectorAll('button');
        menuButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    navMenu.classList.remove('show');
                } else {
                    console.warn('Elemen dengan id "' + targetId + '" tidak ditemukan.');
                }
            });
        });
    }
// Fungsi untuk konversi lintang/bujur ke koordinat meter
function latLngToMeters(lat, lng, refLat, refLng) {
    // Konstanta: 1 derajat ≈ 111319.9 meter (di ekuator)
    const METER_PER_DEGREE = 111319.9;
    
    // Konversi ke meter
    var x = (lng - refLng) * METER_PER_DEGREE * Math.cos(refLat * Math.PI / 180);
    var y = (lat - refLat) * METER_PER_DEGREE;
    
    return { x: x, y: y };
}

// Fungsi untuk update input form dari titik peta
function updateFormFromMapPoints() {
    if (mapPoints.length === 0) return;
    
    // Titik pertama sebagai referensi (0,0)
    referencePoint = mapPoints[0];
    
    // Konversi semua titik ke koordinat meter
    var meterPoints = [];
    for (var i = 0; i < mapPoints.length; i++) {
        var pt = mapPoints[i];
        var meters = latLngToMeters(pt.lat, pt.lng, referencePoint.lat, referencePoint.lng);
        meterPoints.push({ x: meters.x, y: meters.y });
    }
    
    // Update input form
    setPointsToInput(meterPoints);
    
    // Tampilkan notifikasi
    showToast(`✅ ${mapPoints.length} titik dari peta telah dimasukkan ke form`, 'success');
}

// Fungsi untuk hapus semua marker
function clearMarkers() {
    for (var i = 0; i < markers.length; i++) {
        map.removeLayer(markers[i]);
    }
    markers = [];
}

// Fungsi reset peta
function resetMapPoints() {
    mapPoints = [];
    clearMarkers();
    referencePoint = null;
    showToast('🗺️ Semua titik pada peta telah dihapus', 'info');
}

// Event klik pada peta
function onMapClick(e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;
    
    // Simpan titik
    mapPoints.push({ lat: lat, lng: lng });
    
    // Tambah marker
    var marker = L.marker([lat, lng]).addTo(map)
        .bindPopup(`Titik ${mapPoints.length}<br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
        .openPopup();
    
    markers.push(marker);
    
    // Update form
    updateFormFromMapPoints();
    
    showToast(`📍 Titik ${mapPoints.length} ditambahkan`, 'info');
}

// Pasang event klik
map.on('click', onMapClick);

// ============================================================
// TOMBOL UNTUK PETA
// ============================================================

// Fungsi hapus titik terakhir
function hapusTitikTerakhir() {
    if (mapPoints.length === 0) {
        showToast('⚠️ Tidak ada titik yang dihapus', 'warning');
        return;
    }
    
    // Hapus marker terakhir
    var lastMarker = markers.pop();
    if (lastMarker) map.removeLayer(lastMarker);
    
    // Hapus titik terakhir dari array
    mapPoints.pop();
    
    // Update form
    updateFormFromMapPoints();
    
    showToast(`↩️ Titik terakhir dihapus. Tersisa ${mapPoints.length} titik`, 'info');
}
// ===== TOMBOL PETA (event listener) =====
var btnResetPeta = document.getElementById('btnResetPeta');
var btnHapusTerakhir = document.getElementById('btnHapusTitikTerakhir');

if (btnResetPeta) {
    btnResetPeta.addEventListener('click', resetSemuaTitikPeta);
}

if (btnHapusTerakhir) {
    btnHapusTerakhir.addEventListener('click', hapusTitikTerakhir);
}
// Fungsi reset semua titik peta
function resetSemuaTitikPeta() {
    if (mapPoints.length === 0 && markers.length === 0) {
        showToast('⚠️ Tidak ada titik untuk direset', 'warning');
        return;
    }
    
    // Hapus semua marker
    for (var i = 0; i < markers.length; i++) {
        map.removeLayer(markers[i]);
    }
    markers = [];
    mapPoints = [];
    
    // Update form
    updateFormFromMapPoints();
    
    showToast('🗑️ Semua titik pada peta telah dihapus', 'success');
}



    // ============================================================
// SETUP ROLLDOWN INTEGRAL (DENGAN ANIMASI HALUS)
// ============================================================
const integralHeader = document.querySelector('.integral-header');
const integralContent = document.getElementById('integralContent');
const integralIcon = document.querySelector('.integral-header .toggle-icon');

// Set initial state (tertutup)
if (integralContent && integralIcon) {
    integralContent.classList.remove('show');
    integralIcon.textContent = '▶';
    panelStates.integral = false;
}

if (integralHeader && integralContent && integralIcon) {
    integralHeader.addEventListener('click', function() {
        togglePanel('integral');
    });
}
    
   // Setup metode section (sekarang di HTML)
const metodeHeader = document.getElementById('metodeHeader');
const metodeContent = document.getElementById('metodeContent');
const metodeIcon = document.getElementById('metodeIcon');

if (metodeHeader && metodeContent && metodeIcon) {
    // Set initial state (tertutup)
    metodeContent.classList.remove('open');
    metodeIcon.textContent = '▶';
    
    metodeHeader.addEventListener('click', function() {
        if (metodeContent.classList.contains('open')) {
            metodeContent.classList.remove('open');
            metodeIcon.textContent = '▶';
        } else {
            metodeContent.classList.add('open');
            metodeIcon.textContent = '▼';
        }
    });
}
    
    // ============================================================
// DARK MODE FUNCTION
// ============================================================
function applyDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Simpan preferensi ke localStorage
    localStorage.setItem('darkMode', isDark ? 'dark' : 'light');
}

// Setup dark mode listener
const darkModeSelect = document.getElementById('fiturDarkMode');
if (darkModeSelect) {
    // Load saved preference
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'dark') {
        darkModeSelect.value = 'dark';
        applyDarkMode(true);
    } else if (savedMode === 'light') {
        darkModeSelect.value = 'light';
        applyDarkMode(false);
    }
    
    // Listen for changes
    darkModeSelect.addEventListener('change', function() {
        applyDarkMode(this.value === 'dark');
        showToast(this.value === 'dark' ? '🌙 Dark mode aktif' : '🌞 Light mode aktif', 'info');
    });
}

    const popupBody = document.querySelector('.popup-body');
if (popupBody) {
    popupBody.innerHTML = `
    <!-- TENTANG APLIKASI -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">🌾 TENTANG APLIKASI INI</h3>
        <p>Aplikasi <strong>Kalkulator Luas Lahan Pintar</strong> adalah alat bantu untuk menghitung luas lahan tidak beraturan menggunakan metode integral numerik. Dikembangkan sebagai project mata kuliah Kalkulus Integral (Bab 5 & Bab 7).</p>
        <p><strong>Versi 3.0</strong> - Dengan 14 fitur lanjutan: Interpolasi, Skala, Presisi, Partisi, Riemann (3 varian), Simpson (3 varian), Trapezoida Adaptive, Import CSV, Export, Dark Mode, Peta Interaktif, Kalkulator Konversi Satuan, Estimasi Pagar & Biaya, Estimasi Bibit/Tanaman.</p>
    </div>
    
    <!-- CARA PENGGUNAAN DASAR -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">📝 CARA PENGGUNAAN DASAR</h3>
        <ol style="margin-left: 20px; line-height: 1.6;">
            <li><strong>Input Titik:</strong> Masukkan koordinat (x,y) dalam meter pada kolom yang tersedia. Minimal 3 titik untuk membentuk poligon.</li>
            <li><strong>Urutan Titik:</strong> Masukkan titik searah atau berlawanan jarum jam. Urutan yang salah tetap menghasilkan luas yang sama (nilai absolut).</li>
            <li><strong>Atur Jumlah Titik:</strong> Ubah nilai "Jumlah Titik" lalu klik "Generate Input" untuk menambah atau mengurangi titik.</li>
            <li><strong>Hapus Titik:</strong> Klik tombol × pada baris titik untuk menghapus titik tersebut.</li>
            <li><strong>Klik HITUNG LUAS:</strong> Program akan menghitung luas dengan 4 metode (Poligon, Riemann, Trapezoida, Simpson) dan menampilkan hasil di tabel serta grafik.</li>
        </ol>
    </div>
    
    <!-- CONTOH BENTUK LAHAN -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">📋 CONTOH BENTUK LAHAN</h3>
        <p>Gunakan tombol preset untuk memuat contoh bentuk lahan:</p>
        <ul style="margin-left: 20px; line-height: 1.6;">
            <li><strong>⬜ Persegi (5×5):</strong> Lahan berbentuk persegi dengan sisi 5 meter.</li>
            <li><strong>🔺 Segitiga (6×5):</strong> Lahan berbentuk segitiga dengan alas 6m dan tinggi 5m.</li>
            <li><strong>🔷 Trapesium:</strong> Lahan berbentuk trapesium dengan sisi sejajar 4m dan 2m.</li>
            <li><strong>↩️ Lahan L:</strong> Lahan berbentuk huruf L (cekung) untuk menguji akurasi metode.</li>
            <li><strong>⭕ 8 Titik Lingkaran:</strong> Lahan berbentuk lingkaran dengan 8 titik sampel.</li>
            <li><strong>📊 Poligon Acak:</strong> Lahan dengan bentuk acak 5 titik.</li>
        </ul>
    </div>
    
    <!-- ========== FITUR LANJUTAN (14 FITUR LENGKAP) ========== -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">✨ FITUR LANJUTAN (14 Fitur)</h3>
        
        <!-- 1. INTERPOLASI -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px;">
            <h4 style="color: #2e7d32; margin-bottom: 5px;">🔄 1. INTERPOLASI</h4>
            <p><strong>Fungsi:</strong> Menambah titik-titik di antara titik asli untuk membuat kurva lebih halus.</p>
            <p><strong>Penggunaan:</strong> Pilih faktor interpolasi (2×, 3×, 4×). Semakin tinggi faktor, semakin halus kurva.</p>
            <p><strong>Manfaat:</strong> Berguna untuk lahan yang memiliki batas melengkung (bukan garis lurus).</p>
        </div>
        
        <!-- 2. SKALA GAMBAR -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e1f5fe; border-radius: 8px;">
            <h4 style="color: #0288d1; margin-bottom: 5px;">📏 2. SKALA GAMBAR</h4>
            <p><strong>Fungsi:</strong> Mengatur zoom visualisasi lahan pada canvas.</p>
            <p><strong>Penggunaan:</strong> Masukkan nilai skala (1-100) atau gunakan tombol + / - pada canvas. Zoom juga bisa menggunakan Ctrl + / Ctrl -.</p>
            <p><strong>Manfaat:</strong> Memudahkan melihat detail lahan yang kecil atau melihat keseluruhan lahan yang besar.</p>
        </div>
        
        <!-- 3. PRESISI -->
        <div style="margin-bottom: 15px; padding: 10px; background: #fff3e0; border-radius: 8px;">
            <h4 style="color: #ff6f00; margin-bottom: 5px;">🎯 3. PRESISI</h4>
            <p><strong>Fungsi:</strong> Mengatur jumlah angka di belakang koma pada hasil perhitungan.</p>
            <p><strong>Penggunaan:</strong> Pilih presisi (2, 3, atau 4 desimal).</p>
            <p><strong>Manfaat:</strong> Menyesuaikan tingkat detail hasil perhitungan yang ditampilkan.</p>
        </div>
        
        <!-- 4. PARTISI -->
        <div style="margin-bottom: 15px; padding: 10px; background: #f3e5f5; border-radius: 8px;">
            <h4 style="color: #7b1fa2; margin-bottom: 5px;">📊 4. PARTISI</h4>
            <p><strong>Fungsi:</strong> Mengatur jumlah irisan (interval) untuk metode integrasi numerik.</p>
            <p><strong>Penggunaan:</strong> Pilih tingkat kehalusan (Kasar 100, Sedang 200, Halus 500, Sangat Halus 1000).</p>
            <p><strong>Manfaat:</strong> Semakin halus partisi, semakin akurat hasil perhitungan. Partisi 1000 direkomendasikan untuk hasil terbaik.</p>
        </div>
        
        <!-- 5. JENIS RIEMANN (BARU) -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e0f2fe; border-radius: 8px;">
            <h4 style="color: #0288d1; margin-bottom: 5px;">📐 5. JENIS RIEMANN</h4>
            <p><strong>Fungsi:</strong> Memilih posisi titik pengambilan tinggi pada metode Riemann.</p>
            <p><strong>Pilihan:</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Riemann Kiri (Left):</strong> Mengambil tinggi dari titik kiri interval → cenderung underestimate untuk fungsi naik.</li>
                <li><strong>Riemann Kanan (Right):</strong> Mengambil tinggi dari titik kanan interval → cenderung overestimate untuk fungsi naik.</li>
                <li><strong>Riemann Tengah (Midpoint):</strong> Mengambil tinggi dari titik tengah interval → paling akurat di antara ketiganya.</li>
            </ul>
            <p><strong>Rekomendasi:</strong> Gunakan Riemann Tengah untuk hasil paling akurat.</p>
        </div>
        
        <!-- 6. JENIS SIMPSON (BARU) -->
        <div style="margin-bottom: 15px; padding: 10px; background: #fce4ec; border-radius: 8px;">
            <h4 style="color: #c2185b; margin-bottom: 5px;">📈 6. JENIS SIMPSON</h4>
            <p><strong>Fungsi:</strong> Memilih varian metode Simpson yang digunakan.</p>
            <p><strong>Pilihan:</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Simpson 1/3:</strong> Menggunakan pendekatan parabola, membutuhkan partisi genap. Cocok untuk bentuk umum.</li>
                <li><strong>Simpson 3/8:</strong> Menggunakan pendekatan kubik, membutuhkan partisi kelipatan 3. Lebih akurat untuk kurva tajam.</li>
                <li><strong>Auto (Gabungan):</strong> Program otomatis memilih metode terbaik berdasarkan jumlah partisi.</li>
            </ul>
            <p><strong>Rekomendasi:</strong> Gunakan Auto untuk hasil optimal tanpa perlu memikirkan jumlah partisi.</p>
        </div>
        
        <!-- 7. TRAPEZOIDA (UNIFORM vs ADAPTIVE) - BARU -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e8eaf6; border-radius: 8px;">
            <h4 style="color: #283593; margin-bottom: 5px;">🔄 7. TRAPEZOIDA</h4>
            <p><strong>Fungsi:</strong> Memilih metode Trapezoida yang digunakan.</p>
            <p><strong>Pilihan:</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Uniform (Sama Rata):</strong> Membagi lahan menjadi interval dengan lebar sama. Cepat dan sederhana.</li>
                <li><strong>Adaptive (Rapat di Lengkung):</strong> Membagi lahan dengan interval yang tidak sama - lebih rapat di area melengkung, lebih jarang di area lurus. Lebih akurat dengan jumlah partisi yang sama.</li>
            </ul>
            <p><strong>Manfaat:</strong> Adaptive memberikan akurasi lebih tinggi untuk bentuk lahan yang tidak beraturan.</p>
        </div>
        
        <!-- 8. IMPORT CSV -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e1f5fe; border-radius: 8px;">
            <h4 style="color: #0288d1; margin-bottom: 5px;">📁 8. IMPORT CSV</h4>
            <p><strong>Fungsi:</strong> Mengimpor data titik koordinat dari file CSV atau TXT.</p>
            <p><strong>Format File:</strong> Setiap baris berisi koordinat x dan y, dipisahkan koma atau spasi. Contoh: <code>0,0</code> atau <code>5 10</code>.</p>
            <p><strong>Batasan:</strong> Maksimal 100 titik, ukuran file maksimal 1MB.</p>
            <p><strong>Manfaat:</strong> Memudahkan input data dalam jumlah banyak tanpa harus mengetik manual.</p>
        </div>
        
        <!-- 9. EXPORT HASIL -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e8eaf6; border-radius: 8px;">
            <h4 style="color: #283593; margin-bottom: 5px;">📥 9. EXPORT HASIL</h4>
            <p><strong>Fungsi:</strong> Menyimpan data titik dan hasil perhitungan ke file JSON.</p>
            <p><strong>Cara Pakai:</strong> Setelah menghitung luas, klik tombol "Export". File akan otomatis terunduh.</p>
            <p><strong>Manfaat:</strong> Menyimpan data untuk dokumentasi atau analisis lebih lanjut.</p>
        </div>
        
        <!-- 10. DARK MODE (BARU) -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px;">
            <h4 style="color: #2e7d32; margin-bottom: 5px;">🌓 10. DARK MODE</h4>
            <p><strong>Fungsi:</strong> Mengubah tema tampilan aplikasi.</p>
            <p><strong>Pilihan:</strong> Terang (Light) untuk siang hari, Gelap (Dark) untuk malam hari atau mengurangi ketegangan mata.</p>
            <p><strong>Manfaat:</strong> Preferensi tersimpan di browser, akan aktif kembali saat membuka aplikasi.</p>
        </div>

        <!-- 11. PETA INTERAKTIF (BARU) -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e0f2fe; border-radius: 8px;">
            <h4 style="color: #0288d1; margin-bottom: 5px;">🗺️ 11. PETA INTERAKTIF</h4>
            <p><strong>Fungsi:</strong> Memudahkan input titik koordinat lahan langsung dari peta.</p>
            <p><strong>Cara Pakai:</strong> Klik pada peta untuk menandai batas lahan. Titik akan otomatis masuk ke form input. Gunakan tombol <strong>"Hapus Terakhir"</strong> untuk menghapus titik terakhir, atau <strong>"Reset Semua"</strong> untuk menghapus semua titik.</p>
            <p><strong>Manfaat:</strong> Tidak perlu memasukkan koordinat manual, cukup klik pada peta. Data koordinat diambil dari OpenStreetMap (gratis, akurat).</p>
        </div>
        
        <!-- 12. KALKULATOR KONVERSI SATUAN (BARU) -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e8eaf6; border-radius: 8px;">
            <h4 style="color: #283593; margin-bottom: 5px;">🔄 12. KALKULATOR KONVERSI SATUAN</h4>
            <p><strong>Fungsi:</strong> Mengkonversi luas dari meter persegi (m²) ke hektar (ha), are (a), atau kilometer persegi (km²).</p>
            <p><strong>Cara Pakai:</strong> Masukkan nilai dalam m² pada kolom input, pilih satuan target, hasil konversi akan langsung muncul.</p>
            <p><strong>Manfaat:</strong> Memudahkan memahami skala luas lahan, misalnya untuk lahan pertanian yang biasa diukur dalam hektar.</p>
        </div>
        <!-- 13. ESTIMASI PAGAR & BIAYA -->
    <div style="margin-bottom: 15px; padding: 10px; background: #e8eaf6; border-radius: 8px;">
    <h4 style="color: #283593; margin-bottom: 5px;">🧱 13. ESTIMASI PAGAR & BIAYA</h4>
    <p><strong>Fungsi:</strong> Menghitung panjang batas lahan (keliling) dan estimasi biaya pagar.</p>
    <p><strong>Cara Pakai:</strong> Setelah menghitung luas, keliling akan muncul otomatis. Masukkan harga pagar per meter, maka total biaya akan dihitung.</p>
    <p><strong>Manfaat:</strong> Membantu perencanaan anggaran pemagaran lahan.</p>
</div>
<!-- 14. ESTIMASI BIBIT/TANAMAN -->
<div style="margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px;">
    <h4 style="color: #2e7d32; margin-bottom: 5px;">🌱 14. ESTIMASI BIBIT / TANAMAN</h4>
    <p><strong>Fungsi:</strong> Menghitung perkiraan jumlah bibit atau tanaman yang dapat ditanam pada lahan berdasarkan luas dan jarak tanam.</p>
    <p><strong>Cara Pakai:</strong> Setelah menghitung luas, masukkan jarak tanam (dalam meter). Program akan menghitung jumlah tanaman (asumsi grid persegi). Anda juga dapat mengisi luas secara manual jika ingin simulasi tanpa hitung luas terlebih dahulu.</p>
    <p><strong>Manfaat:</strong> Membantu perencanaan kebutuhan bibit untuk pertanian, perkebunan, atau kehutanan.</p>
</div>
    </div>
    
    <!-- METODE PERHITUNGAN (LENGKAP DENGAN VARIAN) -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">🧮 METODE PERHITUNGAN</h3>
        
        <!-- Poligon -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px;">
            <h4 style="color: #2e7d32;">📐 1. Poligon (Shoelace) - Referensi</h4>
            <p><strong>Rumus:</strong> Luas = ½|Σ(xᵢyᵢ₊₁ - xᵢ₊₁yᵢ)|</p>
            <p><strong>Keterangan:</strong> Metode eksak untuk poligon dengan sisi lurus. Digunakan sebagai referensi kebenaran.</p>
        </div>
        
        <!-- Riemann -->
        <div style="margin-bottom: 15px; padding: 10px; background: #e1f5fe; border-radius: 8px;">
            <h4 style="color: #0288d1;">🧱 2. Riemann Sum</h4>
            <p><strong>Rumus:</strong> Luas ≈ Σ f(x) · Δx</p>
            <p><strong>Varian:</strong> Kiri, Kanan, Tengah</p>
            <p><strong>Keterangan:</strong> Membagi area menjadi persegi panjang. Riemann Tengah adalah yang paling akurat.</p>
        </div>
        
        <!-- Trapezoida -->
        <div style="margin-bottom: 15px; padding: 10px; background: #fff3e0; border-radius: 8px;">
            <h4 style="color: #ff6f00;">📊 3. Trapezoida</h4>
            <p><strong>Rumus:</strong> Luas ≈ Σ (f(xᵢ) + f(xᵢ₊₁))/2 · Δx</p>
            <p><strong>Varian:</strong> Uniform (sama rata), Adaptive (rapat di lengkung)</p>
            <p><strong>Keterangan:</strong> Menghubungkan titik dengan garis lurus membentuk trapesium. Adaptive lebih akurat untuk bentuk tidak beraturan.</p>
        </div>
        
        <!-- Simpson -->
        <div style="margin-bottom: 15px; padding: 10px; background: #f3e5f5; border-radius: 8px;">
            <h4 style="color: #7b1fa2;">📈 4. Simpson</h4>
            <p><strong>Rumus 1/3:</strong> Δx/3 · (y₀ + 4y₁ + 2y₂ + 4y₃ + ... + yₙ)</p>
            <p><strong>Rumus 3/8:</strong> 3Δx/8 · (y₀ + 3y₁ + 3y₂ + 2y₃ + ... + yₙ)</p>
            <p><strong>Varian:</strong> Simpson 1/3, Simpson 3/8, Auto</p>
            <p><strong>Keterangan:</strong> Mengaproksimasi dengan parabola/kubik. Metode paling akurat untuk kurva mulus.</p>
        </div>
    </div>
    
    <!-- VISUALISASI CANVAS -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">🖱️ VISUALISASI CANVAS</h3>
        <ul style="margin-left: 20px; line-height: 1.6;">
            <li><strong>Zoom In/Out:</strong> Klik tombol ➕/➖ di pojok kanan atas canvas, atau tekan Ctrl + / Ctrl - pada keyboard.</li>
            <li><strong>Geser Canvas:</strong> Klik tahan dan geser mouse untuk memindahkan tampilan (support touch di HP).</li>
            <li><strong>Reset View:</strong> Klik tombol ⟲ untuk mengembalikan zoom dan posisi ke default.</li>
            <li><strong>Informasi:</strong> Canvas menampilkan grid, sumbu X dan Y, titik koordinat dengan label, serta legenda luas di bagian bawah.</li>
        </ul>
    </div>
    
    <!-- DETAIL PERHITUNGAN -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">🔍 DETAIL PERHITUNGAN</h3>
        <p>Setelah menghitung luas, klik bagian <strong>"🔍 DETAIL PERHITUNGAN"</strong> untuk melihat:</p>
        <ul style="margin-left: 20px; line-height: 1.6;">
            <li>Langkah-langkah perhitungan metode Poligon (Shoelace) dengan rumus lengkap.</li>
            <li>Nilai Δx (lebar interval) dan partisi yang digunakan.</li>
            <li>Jenis Riemann yang dipilih (Kiri/Kanan/Tengah).</li>
            <li>Jenis Simpson yang dipilih (1/3/3/8/Auto).</li>
            <li>Jenis Trapezoida yang dipilih (Uniform/Adaptive).</li>
            <li>Hasil luas dan error percentage untuk setiap metode numerik.</li>
        </ul>
    </div>
    
    <!-- PENJELASAN METODE & MATERI KULIAH -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">📚 KAITAN DENGAN MATERI KULIAH</h3>
        
        <div style="margin-bottom: 15px;">
            <h4 style="color: #2e7d32;">BAB 5: APLIKASI INTEGRAL</h4>
            <p>Konsep integral sebagai luas daerah di bawah kurva diterapkan untuk menghitung luas lahan. Program membagi lahan menjadi irisan-irisan tipis (Δx → 0) dan menjumlahkannya - persis seperti definisi integral Riemann.</p>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4 style="color: #0288d1;">BAB 7: TEKNIK INTEGRASI NUMERIK</h4>
            <p>Ketika fungsi tidak dapat diintegralkan secara analitik, kita menggunakan metode numerik. Program mengimplementasikan 4 metode dengan berbagai varian:</p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Riemann:</strong> 3 varian (Kiri, Kanan, Tengah) - menunjukkan pengaruh posisi titik sampel</li>
                <li><strong>Trapezoida:</strong> 2 varian (Uniform, Adaptive) - menunjukkan konsep partisi adaptif</li>
                <li><strong>Simpson:</strong> 3 varian (1/3, 3/8, Auto) - menunjukkan pendekatan orde lebih tinggi</li>
            </ul>
        </div>
    </div>
    
    <!-- SHORTCUT KEYBOARD -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #2e7d32; margin-bottom: 10px;">⌨️ SHORTCUT KEYBOARD</h3>
        <ul style="margin-left: 20px; line-height: 1.6;">
            <li><strong>Ctrl + (+)</strong> atau <strong>Ctrl + (=)</strong> : Zoom In</li>
            <li><strong>Ctrl + (-)</strong> : Zoom Out</li>
            <li><strong>Ctrl + 0</strong> : Reset View</li>
        </ul>
    </div>
    
    <!-- FOOTER PANDUAN -->
    <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; color: #666;">
        <p>© 2026 - Project Kalkulus Integral | S1 Ilmu Komputer UNIMED</p>
        <p style="font-size: 11px;">Versi 3.0 - Dengan 4 metode, 3 varian Riemann, 3 varian Simpson, Trapezoida Adaptive, dan Dark Mode</p>
    </div>
`;
}
// ============================================================
// KALKULATOR KONVERSI SATUAN
// ============================================================

function updateKonversi() {
    const inputVal = parseFloat(document.getElementById('konversiInput').value);
    const target = document.getElementById('konversiSatuanTarget').value;
    const hasilDiv = document.getElementById('konversiHasil');
    
    if (isNaN(inputVal)) {
        hasilDiv.textContent = '0 m²';
        return;
    }
    
    let hasil = inputVal;
    let satuan = 'm²';
    
    switch(target) {
        case 'hektar':
            hasil = inputVal / 10000;
            satuan = 'ha';
            break;
        case 'are':
            hasil = inputVal / 100;
            satuan = 'a';
            break;
        case 'km2':
            hasil = inputVal / 1000000;
            satuan = 'km²';
            break;
        default:
            hasil = inputVal;
            satuan = 'm²';
    }
    
    // Tentukan jumlah desimal berdasarkan besarnya angka
    let desimal;
    if (Math.abs(hasil) >= 100) desimal = 2;
    else if (Math.abs(hasil) >= 1) desimal = 3;
    else if (Math.abs(hasil) >= 0.001) desimal = 6;
    else desimal = 8;
    
    // Format dengan koma sebagai desimal
    let formatted = hasil.toFixed(desimal).replace('.', ',');
    
    // Hilangkan desimal yang tidak perlu (misal 1,0000 -> 1)
    if (desimal > 2) {
        formatted = formatted.replace(/,0+$/, '');
        formatted = formatted.replace(/,$/, '');
    }
    
    hasilDiv.textContent = `${formatted} ${satuan}`;
}

// Pasang event listener
const konversiInput = document.getElementById('konversiInput');
const konversiSelect = document.getElementById('konversiSatuanTarget');
if (konversiInput && konversiSelect) {
    konversiInput.addEventListener('input', updateKonversi);
    konversiSelect.addEventListener('change', updateKonversi);
    updateKonversi(); // inisialisasi
}
    
   // Tunda toast pertama hingga semua resource (termasuk gambar, peta) selesai dimuat
window.addEventListener('load', function() {
    setTimeout(function() {
        showToast('🎉 Selamat datang di Kalkulator Luas Lahan v3.0', 'success');
    }, 300);
});
});