// =============================================
// OTUSAT-1 Ground Station — JS Interop Module
// =============================================

// SPA navigasyonunda tarayıcının scroll pozisyonunu geri yüklemesini engelle
history.scrollRestoration = 'manual';

const MOTION_KEY = 'motionEnabled';

// ---------------------------------------------
// HAREKET DURUMU
// Durumun tek sahibi burasıdır. Blazor render döngüsünden bağımsız
// olarak sayfa yüklenir yüklenmez senkron biçimde belirlenir; böylece
// component'ler hangi sırada render olursa olsun durum tutarlıdır.
// ---------------------------------------------
let isMotionEnabled = (() => {
    try {
        const stored = localStorage.getItem(MOTION_KEY);
        if (stored === 'true') return true;
        if (stored === 'false') return false;
    } catch {
        // Gizli sekme / storage kapalı — sistem tercihine düş
    }
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
})();

function applyMotionClass() {
    document.documentElement.classList.toggle('reduce-motion', !isMotionEnabled);
}

applyMotionClass();

// Blazor'un çağırdığı okuma ucu. matchMedia'yı doğrudan interop'a
// açmak yerine burada bool'a indirgiyoruz (MediaQueryList serialize edilemez).
function getMotionStatus() {
    return isMotionEnabled;
}

function setMotionStatus(status) {
    isMotionEnabled = !!status;
    applyMotionClass();

    try {
        localStorage.setItem(MOTION_KEY, isMotionEnabled ? 'true' : 'false');
    } catch {
        // Kalıcı yazamıyorsak sessizce geç, oturum içi davranış korunur
    }

    // GSAP scroll animasyonlarını yeni duruma göre kur veya kaldır
    refreshGSAP();
    return isMotionEnabled;
}

// ---------------------------------------------
// NAVİGASYON / SCROLL
// ---------------------------------------------
function scrollToTop() {
    // CSS smooth-scroll'u anlık sıfırlama için geçici olarak devre dışı bırak
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = prev;
    });
}

// Navigasyon sonrası konumlanma. URL'de fragment varsa ilgili bölüme
// iner, yoksa sayfa başına döner. Hedef eleman henüz render edilmemiş
// olabileceği için birkaç frame boyunca tekrar dener.
// Yeni sayfa render edilip GSAP tetikleyicileri kurulana kadar false kalır.
// Kaydırmayı bu bayrağa bağlamak, ölçümlerin kaydırma sürerken yapılmasından
// doğan yarışı ortadan kaldırır.
let layoutReady = true;

// Erişilebilirlik: sayfa değişince odağı yeni başlığa taşı. preventScroll
// şart — onsuz tarayıcı odaklanan elemanı görünür kılmak için sayfayı
// kaydırır ve fragment hedefinden geri fırlatır (FocusOnNavigate'in yaptığı).
function focusHeading(fallback) {
    const el = fallback || document.querySelector('h1');
    if (!el) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try {
        el.focus({ preventScroll: true });
    } catch {
        // preventScroll desteklenmiyorsa odaklamayı hiç yapma; kaydırmayı
        // bozmak, odak taşımamaktan daha kötü.
    }
}

// ScrollTrigger.refresh() ölçüm sırasında sayfayı geçici olarak 0'a alıp geri
// yükler. Bu yüzden yalnızca kaydırmadan ÖNCE çağrılmalı; sonrasında çağrılırsa
// süren yumuşak kaydırmayı iptal eder.
function refreshTriggerPositions() {
    if (typeof ScrollTrigger === 'undefined') return;
    ScrollTrigger.refresh();
}

function handleNavigation() {
    const hash = window.location.hash;
    const hasFragment = hash && hash.length > 1;

    let attempts = 0;
    (function seek() {
        let target = null;
        if (hasFragment) {
            try {
                target = document.querySelector(hash);
            } catch {
                // Geçersiz seçici üreten fragment (ör. "#1bolum")
            }
        }

        // Hedef henüz render edilmediyse ya da tetikleyiciler kurulmadıysa bekle.
        if ((hasFragment && !target) || !layoutReady) {
            if (attempts++ < 60) {
                requestAnimationFrame(seek);
                return;
            }
        }

        refreshTriggerPositions();

        if (target) {
            target.scrollIntoView({
                behavior: isMotionEnabled ? 'smooth' : 'instant',
                block: 'start'
            });
            focusHeading(target.querySelector('h1, h2'));
        } else {
            scrollToTop();
            focusHeading();
        }
    })();
}

// ---------------------------------------------
// YILDIZ ALANI (Three.js)
// Tek sefer kurulur. Home component'i her yeniden ziyarette yeniden
// mount olduğu için, guard olmadan her seferinde yeni bir WebGL
// renderer + animasyon döngüsü + event listener birikirdi.
// ---------------------------------------------
let starfieldReady = false;

function initStarfield() {
    if (starfieldReady) return;

    const canvas = document.getElementById('bg-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    starfieldReady = true;

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
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let time = 0;
    (function animate() {
        requestAnimationFrame(animate);
        if (isMotionEnabled) {
            time += 0.0002;
            stars.rotation.y = time;
            stars.rotation.x = scrollY * 0.00002;
        }
        renderer.render(scene, camera);
    })();
}

// ---------------------------------------------
// SCROLL ANİMASYONLARI (GSAP)
// ---------------------------------------------
const ANIMATED_SELECTORS = ['.section-header', '.mission__description', '.mission__specs-panel', '.team-card'];

function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        layoutReady = true;
        return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // Önceki mount'tan kalan trigger'lar artık DOM'da olmayan
    // elemanlara işaret ediyor olabilir — temizle.
    ScrollTrigger.getAll().forEach(t => t.kill());

    // Hareket kapalıyken hiçbir şeyi gizleme: gsap.from() elemanları
    // opacity:0 ile başlatacağı için animasyonsuz modda içerik
    // kalıcı olarak görünmez kalırdı.
    if (!isMotionEnabled) {
        ANIMATED_SELECTORS.forEach(sel => gsap.set(sel, { clearProps: 'all' }));
        return;
    }

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

    gsap.from('.team-card', {
        scrollTrigger: { trigger: '.team__grid', start: 'top 80%' },
        scale: 0.88, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'back.out(1.3)'
    });
}

// Hareket durumu değiştiğinde animasyonları yeniden kur.
// Ana sayfada değilsek sadece temizlik yeterli.
function refreshGSAP() {
    if (typeof ScrollTrigger === 'undefined') return;

    if (!document.querySelector('.team__grid')) {
        ScrollTrigger.getAll().forEach(t => t.kill());
        return;
    }

    initGSAP();
}

// ---------------------------------------------
// UTC SAATİ
// Tek bir interval yeterli; Home her mount olduğunda yenisi kurulmamalı.
// ---------------------------------------------
let clockStarted = false;

function startUTCClock() {
    if (clockStarted) return;
    clockStarted = true;

    function tick() {
        const now = new Date();
        _setText('hero-utc', [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
            .map(x => String(x).padStart(2, '0')).join(':'));
    }

    tick();
    setInterval(tick, 1000);
}

// ---------------------------------------------
// ANA SAYFA GİRİŞ NOKTASI
// ---------------------------------------------
function initHome() {
    // Kaydırma, tetikleyiciler kurulana kadar beklesin.
    layoutReady = false;
    initStarfield();
    initGSAP();
    startUTCClock();
    layoutReady = true;
}

// Ana sayfa dışındaki sayfalarda GSAP tetikleyicisi yok; kaydırma beklemesin.
function markLayoutReady() {
    layoutReady = true;
}

// Rota değişimi başladığında çağrılır: hedef sayfa mount olup tetikleyicilerini
// kurana kadar handleNavigation kaydırma yapmasın.
function beginNavigation() {
    layoutReady = false;
}

function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
