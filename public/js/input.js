// Entrada unificada: teclado + ratón en ordenador, joystick y botones táctiles en móvil.
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.joy = { x: 0, y: 0 };
    this.pressed = new Set(); // acciones de un solo toque (se consumen)
    this.enabled = true;
    this.sensitivity = parseFloat(localStorage.getItem('sens') || '1') || 1;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || isTyping()) return;
      const k = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) {
        if (k === 'KeyE' || k === 'KeyF') this.pressed.add('action');
        if (k === 'KeyQ') this.pressed.add('undisguise');
        if (k === 'KeyT' || k === 'KeyG') this.pressed.add('taunt');
        if (k === 'KeyR') this.pressed.add('lock');
        if (k === 'Space') this.pressed.add('jump');
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (isTouch || !this.enabled) return;
      if (!this.locked) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.pressed.add('fire');
      if (e.button === 2) this.pressed.add('action');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX * 0.0022 * this.sensitivity;
      this.lookY += e.movementY * 0.0022 * this.sensitivity;
    });

    if (isTouch) this.setupTouch();
  }

  setSensitivity(v) {
    this.sensitivity = v;
    localStorage.setItem('sens', String(v));
  }

  setupTouch() {
    const joyEl = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    let joyId = null;
    let lookId = null;
    let jx = 0;
    let jy = 0;
    let lx = 0;
    let ly = 0;
    const R = 55;

    const zone = document.getElementById('touch-zone');
    zone.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && joyId === null) {
          joyId = t.identifier; jx = t.clientX; jy = t.clientY;
          joyEl.style.left = `${jx - 70}px`; joyEl.style.top = `${jy - 70}px`;
          joyEl.classList.add('active');
        } else if (lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - jx;
          let dy = t.clientY - jy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
          this.joy.x = dx / R; this.joy.y = dy / R;
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === lookId) {
          this.lookX += (t.clientX - lx) * 0.006 * this.sensitivity;
          this.lookY += (t.clientY - ly) * 0.006 * this.sensitivity;
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null; this.joy.x = 0; this.joy.y = 0;
          knob.style.transform = ''; joyEl.classList.remove('active');
          joyEl.style.left = ''; joyEl.style.top = ''; // vuelve a su sitio en la esquina
        } else if (t.identifier === lookId) lookId = null;
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);

    const bind = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.pressed.add(action);
        el.classList.add('down');
        if (action === 'fire') this.keys.add('TouchFire');
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        el.classList.remove('down');
        if (action === 'fire') this.keys.delete('TouchFire');
      }, { passive: false });
    };
    bind('btn-fire', 'fire');
    bind('btn-action', 'action');
    bind('btn-jump', 'jump');
    bind('btn-taunt', 'taunt');
    bind('btn-lock', 'lock');
    bind('btn-undisguise', 'undisguise');
  }

  // Dirección de movimiento: x = derecha, y = adelante.
  move() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.joy.x;
    y -= this.joy.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  down() { return this.keys.has('ControlLeft') || this.keys.has('KeyC'); }
  firing() { return this.keys.has('TouchFire'); }

  consumeLook() {
    const r = [this.lookX, this.lookY];
    this.lookX = 0; this.lookY = 0;
    return r;
  }

  take(action) {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  clearPressed() { this.pressed.clear(); }
}

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
}
