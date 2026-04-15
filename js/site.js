// =============================================
// OTUSAT-1 Ground Station — JS Interop Module
// =============================================

// Prevent browser from restoring scroll position on SPA navigation
history.scrollRestoration = 'manual';

let isMotionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollToTop() {
    // Bypass CSS smooth-scroll for instant navigation reset
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setTimeout(() => {
        document.documentElement.style.scrollBehavior = '';
        document.body.style.scrollBehavior = '';
    }, 50);
}

function initStarfield() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 1;

    const starCount = 4000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colorArr  = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 300;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 300 - 50;

        const t = Math.random();
        if (t < 0.70) {
            const b = 0.7 + Math.random() * 0.3;
            colorArr[i*3] = b; colorArr[i*3+1] = b; colorArr[i*3+2] = b;
        } else if (t < 0.85) {
            colorArr[i*3] = 0.0; colorArr[i*3+1] = 0.94; colorArr[i*3+2] = 1.0;
        } else {
            colorArr[i*3] = 0.44; colorArr[i*3+1] = 0.0; colorArr[i*3+2] = 1.0;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colorArr, 3));

    const mat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);

    let scrollY = 0;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; });
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let time = 0;
    (function animate() {
        requestAnimationFrame(animate);
        if (isMotionEnabled) {
            time += 0.0002; // Reduced from 0.0004
            stars.rotation.y = time;
            stars.rotation.x = scrollY * 0.00002; // Reduced from 0.00004
        }
        renderer.render(scene, camera);
    })();
}

function setMotionStatus(status) {
    isMotionEnabled = status;
}


function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.section-header').forEach(el => {
        gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, x: -60, opacity: 0, duration: 0.9, ease: 'power3.out' });
    });

    gsap.from('.mission__description', {
        scrollTrigger: { trigger: '.mission__grid', start: 'top 80%' },
        x: -80, opacity: 0, duration: 1.0, ease: 'power3.out'
    });
    gsap.from('.mission__specs-panel', {
        scrollTrigger: { trigger: '.mission__grid', start: 'top 80%' },
        x: 80, opacity: 0, duration: 1.0, delay: 0.15, ease: 'power3.out'
    });

    gsap.from('.telem-card', {
        scrollTrigger: { trigger: '.telemetry__grid', start: 'top 80%' },
        y: 50, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out'
    });

    gsap.from('.team-card', {
        scrollTrigger: { trigger: '.team__grid', start: 'top 80%' },
        scale: 0.88, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'back.out(1.3)'
    });

    // --- YENİ EKLENEN KISIM: Zıplamayı Önleyip Animasyonu Tetikleyen Kod ---
    // Sayfa içindeki (#) bağlantılı menü linklerine tıklandığında devreye girer
    document.querySelectorAll('.nav-links a[href^="/#"], a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            // Hedef kimliği ayıkla (örnek: "/#team" -> "#team")
            const targetId = href.includes('#') ? href.substring(href.indexOf('#')) : '';
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault(); // Anında zıplamayı engelle

                // Hedef bölüme yumuşak bir şekilde kaydır (GSAP bu kaymayı algılayacaktır)
                targetElement.scrollIntoView({ behavior: 'smooth' });

                // Kaydırma bitimine yakın ScrollTrigger'ı yenileyerek görünmez kalmaları kesin olarak önle
                setTimeout(() => {
                    ScrollTrigger.refresh();
                }, 600);
            }
        });
    });
}

function startTelemetry() {
    const msgs = [
        'ADCS KALİBRASYONU TAMAMLANDI.',
        'YENİ PAKET ALINDI. SEQ: {PKT}',
        'GÜNEŞ PANELİ VERİMİ: {SOL}%',
        'GPS KONUM GÜNCELLENDİ.',
        'BATARYA ŞARJ DÖNGÜSÜ AKTİF.',
        'RF BAĞLANTI STABIL. RSSI: {SIG} dBm',
        'OBC SICAKLIK: NOMİNAL',
        'YÖN KONTROL MOMENTİ HESAPLANDI.',
        'TELEMETRI ÇERÇEVESİ GÖNDERİLDİ.',
    ];

    let packetCount = 4721, signalVal = -87, battVal = 78,
        tempVal = 24, altVal = 551.2, solarVal = 1.8, logSec = 12;

    setInterval(() => {
        signalVal += (Math.random() - 0.5) * 3;
        signalVal  = Math.max(-105, Math.min(-65, signalVal));
        _setText('signal-strength', Math.round(signalVal));

        battVal += (Math.random() - 0.47) * 0.25;
        battVal  = Math.max(55, Math.min(100, battVal));
        _setText('battery-level', Math.round(battVal));
        _setStyle('battery-fill', 'width', Math.round(battVal) + '%');

        tempVal += (Math.random() - 0.5) * 1.5;
        tempVal  = Math.max(-15, Math.min(65, tempVal));
        _setText('temperature', (tempVal >= 0 ? '+' : '') + Math.round(tempVal));
        _setCSSVar('temp-bar', '--temp-pct', (((tempVal + 15) / 80) * 100).toFixed(1) + '%');

        altVal += (Math.random() - 0.5) * 0.4;
        altVal  = Math.max(540, Math.min(565, altVal));
        _setText('altitude-val', altVal.toFixed(1));

        solarVal += (Math.random() - 0.5) * 0.2;
        solarVal  = Math.max(0.2, Math.min(2.0, solarVal));
        _setText('solar-power', solarVal.toFixed(1));
        _setCSSVar('solar-bar', '--solar-pct', ((solarVal / 2.0) * 100).toFixed(1) + '%');

        packetCount += Math.floor(Math.random() * 3) + 1;
        _setText('packet-count', String(packetCount).padStart(6, '0'));

        const stream = document.getElementById('log-stream');
        if (stream) {
            logSec += Math.floor(Math.random() * 6) + 2;
            const hh = String(Math.floor(logSec / 3600)).padStart(2,'0');
            const mm = String(Math.floor((logSec % 3600) / 60)).padStart(2,'0');
            const ss = String(logSec % 60).padStart(2,'0');
            const msg = msgs[Math.floor(Math.random() * msgs.length)]
                .replace('{PKT}', packetCount)
                .replace('{SOL}', (80 + Math.random() * 15).toFixed(1))
                .replace('{SIG}', Math.round(signalVal));
            const entry = document.createElement('div');
            entry.className = 'log-entry log-entry--new';
            entry.textContent = `[${hh}:${mm}:${ss}] ${msg}`;
            stream.appendChild(entry);
            if (stream.children.length > 10) stream.removeChild(stream.firstChild);
            stream.scrollTop = stream.scrollHeight;
            setTimeout(() => entry.classList.remove('log-entry--new'), 500);
        }
    }, 2000);
}

function startUTCClock() {
    function tick() {
        const n = new Date();
        _setText('hero-utc', [n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()]
            .map(x => String(x).padStart(2,'0')).join(':'));
    }
    tick();
    setInterval(tick, 1000);
}

function _setText(id, val)             { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setStyle(id, prop, val)      { const el = document.getElementById(id); if (el) el.style[prop] = val; }
function _setCSSVar(id, name, val)     { const el = document.getElementById(id); if (el) el.style.setProperty(name, val); }