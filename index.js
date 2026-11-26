import { eventSource, event_types } from '../../../../script.js';

// Шансы выпадения в процентах (в сумме должны давать 100)
const CHANCES = {
    white: 85,   // Обычные белые
    heavy: 8,    // Очень сильные брызги
    clear: 5,    // Прозрачные водянистые
    golden: 2,   // Самый редкий: золотой обстрел
};

const canvas = document.createElement('canvas');
canvas.id = 'white-splash-canvas';
Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '999999',
});
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');

let viewW = window.innerWidth;
let viewH = window.innerHeight;

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Адаптивный размер капель под экран (телефон ~0.9-1.0, FullHD ~1.25, 2K ~1.6)
function getScreenScale() {
    const minSide = Math.min(viewW, viewH);
    return Math.max(0.9, Math.min(2.0, minSide / 800));
}

// Адаптивное количество брызг под площадь экрана ПК
function getCountMultiplier() {
    const areaRatio = (viewW * viewH) / (400 * 800);
    return Math.max(1, Math.min(1.9, Math.sqrt(areaRatio)));
}

let splashes = [];
let animationFrame = null;
let lastTime = 0;

class Splatter {
    constructor(x, y, type = 'white') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.alpha = 1.0;

        const scale = getScreenScale();

        if (type === 'heavy') {
            this.fadeRate = 0.009 + Math.random() * 0.006;
            this.mainRadius = (32 + Math.random() * 48) * scale;
            this.dropletCount = 18 + Math.floor(Math.random() * 16);
            this.dripBase = 0.45;
            this.spreadMax = 2.6;
        } else if (type === 'clear') {
            this.fadeRate = 0.013 + Math.random() * 0.008;
            this.mainRadius = (18 + Math.random() * 32) * scale;
            this.dropletCount = 14 + Math.floor(Math.random() * 14);
            this.dripBase = 1.1; // жидкие — стекают быстрее
            this.spreadMax = 2.3;
        } else if (type === 'golden') {
            this.fadeRate = 0.008 + Math.random() * 0.005;
            this.mainRadius = (24 + Math.random() * 40) * scale;
            this.dropletCount = 16 + Math.floor(Math.random() * 14);
            this.dripBase = 0.85;
            this.spreadMax = 2.5;
        } else {
            // white (базовый)
            this.fadeRate = 0.015 + Math.random() * 0.01;
            this.mainRadius = (20 + Math.random() * 35) * scale;
            this.dropletCount = 10 + Math.floor(Math.random() * 12);
            this.dripBase = 0.3;
            this.spreadMax = 2.0;
        }

        this.droplets = [];
        for (let i = 0; i < this.dropletCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.mainRadius * (0.7 + Math.random() * this.spreadMax);
            this.droplets.push({
                offsetX: Math.cos(angle) * distance,
                offsetY: Math.sin(angle) * distance,
                radius: 2 * scale + Math.random() * (this.mainRadius * 0.2),
                dripSpeed: (this.dripBase + Math.random() * 0.7) * scale,
            });
        }
    }

    update(dt) {
        this.alpha -= this.fadeRate * dt;
        for (const drop of this.droplets) {
            drop.offsetY += drop.dripSpeed * dt;
        }
    }

    draw(ctx) {
        const a = Math.max(0, this.alpha);
        if (a <= 0) return;

        ctx.save();

        if (this.type === 'clear') {
            // Прозрачные капли с контуром и бликом
            ctx.fillStyle = `rgba(215, 240, 255, ${a * 0.26})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.65})`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = `rgba(190, 230, 255, ${a * 0.45})`;
            ctx.shadowBlur = 5;

            this.drawMainAndDrops(ctx, true);

            // Блик на основной капле
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.75})`;
            ctx.beginPath();
            ctx.arc(
                this.x - this.mainRadius * 0.32,
                this.y - this.mainRadius * 0.32,
                this.mainRadius * 0.22,
                0,
                Math.PI * 2
            );
            ctx.fill();
        } else if (this.type === 'golden') {
            // Золотой обстрел
            ctx.fillStyle = `rgba(255, 208, 35, ${a * 0.88})`;
            ctx.shadowColor = `rgba(255, 170, 0, ${a * 0.8})`;
            ctx.shadowBlur = 8;

            this.drawMainAndDrops(ctx, false);

            // Светло-золотой блик
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(255, 250, 190, ${a * 0.8})`;
            ctx.beginPath();
            ctx.arc(
                this.x - this.mainRadius * 0.28,
                this.y - this.mainRadius * 0.28,
                this.mainRadius * 0.2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        } else if (this.type === 'heavy') {
            // Очень сильные белые брызги
            ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
            ctx.shadowColor = `rgba(220, 225, 255, ${a * 0.75})`;
            ctx.shadowBlur = 7;

            this.drawMainAndDrops(ctx, false);
        } else {
            // Обычные белые
            ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
            ctx.shadowColor = `rgba(230, 230, 255, ${a * 0.6})`;
            ctx.shadowBlur = 4;

            this.drawMainAndDrops(ctx, false);
        }

        ctx.restore();
    }

    drawMainAndDrops(ctx, withStroke) {
        // Главная клякса
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.mainRadius, 0, Math.PI * 2);
        ctx.fill();
        if (withStroke) ctx.stroke();

        ctx.beginPath();
        ctx.arc(
            this.x + this.mainRadius * 0.2,
            this.y + this.mainRadius * 0.15,
            this.mainRadius * 0.7,
            0,
            Math.PI * 2
        );
        ctx.fill();
        if (withStroke) ctx.stroke();

        // Мелкие капли рисуем без тяжёлой тени одним батчем для стабильного FPS на ПК
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (const drop of this.droplets) {
            const dx = this.x + drop.offsetX;
            const dy = this.y + drop.offsetY;
            ctx.moveTo(dx + drop.radius, dy);
            ctx.arc(dx, dy, drop.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        if (withStroke) ctx.stroke();
    }
}

function rollLiquidType() {
    const roll = Math.random() * 100;
    if (roll < CHANCES.white) return 'white';
    if (roll < CHANCES.white + CHANCES.heavy) return 'heavy';
    if (roll < CHANCES.white + CHANCES.heavy + CHANCES.clear) return 'clear';
    return 'golden';
}

function spawnWave(type, baseCount) {
    const count = Math.round(baseCount * getCountMultiplier());
    const padX = viewW * 0.05;
    const padY = viewH * 0.05;

    for (let i = 0; i < count; i++) {
        const x = padX + Math.random() * (viewW - padX * 2);
        const y = padY + Math.random() * (viewH - padY * 2);
        splashes.push(new Splatter(x, y, type));
    }

    if (!animationFrame) {
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(render);
    }
}

function triggerSplashEffect(forcedType = null) {
    const type = typeof forcedType === 'string' ? forcedType : rollLiquidType();

    if (type === 'golden') {
        // Золотой обстрел: 4 быстрых залпа по всему экрану
        for (let w = 0; w < 4; w++) {
            setTimeout(() => {
                spawnWave('golden', 5 + Math.floor(Math.random() * 4));
            }, w * 130);
        }
    } else if (type === 'heavy') {
        // Очень сильные брызги: 2 плотных залпа
        spawnWave('heavy', 8 + Math.floor(Math.random() * 4));
        setTimeout(() => {
            spawnWave('heavy', 5 + Math.floor(Math.random() * 3));
        }, 120);
    } else if (type === 'clear') {
        spawnWave('clear', 7 + Math.floor(Math.random() * 4));
    } else {
        spawnWave('white', 5 + Math.floor(Math.random() * 4));
    }
}

function render(now) {
    // Нормализация к 60 FPS (ограничение до 3 защищает от скачка при сворачивании вкладки)
    const dt = Math.min((now - lastTime) / (1000 / 60), 3);
    lastTime = now;

    ctx.clearRect(0, 0, viewW, viewH);

    for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.update(dt);
        s.draw(ctx);
        if (s.alpha <= 0) splashes.splice(i, 1);
    }

    if (splashes.length > 0) {
        animationFrame = requestAnimationFrame(render);
    } else {
        ctx.clearRect(0, 0, viewW, viewH);
        animationFrame = null;
    }
}

jQuery(() => {
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => triggerSplashEffect());
    eventSource.on(event_types.USER_MESSAGE_RENDERED, () => triggerSplashEffect());
});

// Проверка любого типа вручную из консоли браузера (F12)
window.testSplash = (type) => triggerSplashEffect(type);
