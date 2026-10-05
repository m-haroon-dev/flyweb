(() => {
  const heroScroll = document.getElementById("heroScroll");
  const hero = document.getElementById("hero");
  const canvas = document.getElementById("tunnel");
  const cursor = document.getElementById("cursor");
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  const title = document.getElementById("motoTitle");
  const video = document.getElementById("bgVideo");
  const header = document.getElementById("header");
  const introText = document.getElementById("introText");

  const PORTAL_START = 0.55; // scroll progress where the video starts to open
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // ----- split the headline into letters -----
  let charIndex = 0;
  title.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((word, w) => {
      const wordEl = document.createElement("span");
      wordEl.className = "word";
      [...word].forEach((letter) => {
        const charEl = document.createElement("span");
        charEl.className = "char";
        charEl.textContent = letter;
        charEl.style.setProperty("--i", charIndex++);
        wordEl.appendChild(charEl);
      });
      el.appendChild(wordEl);
      if (w < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });
  title.style.setProperty("--dur", `${charIndex * 38 + 500}ms`);

  // ----- loader -----
  let loaded = false;
  function finishLoading() {
    if (loaded) return;
    loaded = true;
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-loaded");
    loadVideo();
  }
  window.addEventListener("load", () => setTimeout(finishLoading, 500));
  setTimeout(finishLoading, 4000);

  // ----- full-screen menu -----
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", !open);
  }
  menuBtn.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });

  // ----- 3D tunnel -----
  // soft round glow used for every floating star
  function makeStarSprite() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.25, "rgba(255,255,255,0.7)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  // one puffy cloud built from overlapping soft blobs
  function makeCloudSprite() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 58;
      const x = 128 + Math.cos(angle) * dist * 1.05;
      const y = 128 + Math.sin(angle) * dist * 0.7;
      const r = 34 + Math.random() * 30;
      const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
      blob.addColorStop(0, `rgba(255,255,255,${0.1 + Math.random() * 0.16})`);
      blob.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = blob;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }

  // grey deep-space wall: wispy clouds, small blurry galaxies and faint stars
  function makeTunnelTexture() {
    const W = 2048;
    const H = 1024;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#020202";
    ctx.fillRect(0, 0, W, H);

    // soft ellipse, repeated across the edges so the texture tiles without seams
    function glow(x, y, r, squash, rotation, alpha) {
      for (let ox = -W; ox <= W; ox += W) {
        for (let oy = -H; oy <= H; oy += H) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx + r < 0 || cx - r > W || cy + r < 0 || cy - r > H) continue;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rotation);
          ctx.scale(1, squash);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, `rgba(255,255,255,${alpha})`);
          g.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.35})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.restore();
        }
      }
    }

    // big hazy cloud patches
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      for (let j = 0; j < 9; j++) {
        glow(
          x + (Math.random() - 0.5) * 380,
          y + (Math.random() - 0.5) * 240,
          90 + Math.random() * 170,
          0.35 + Math.random() * 0.5,
          Math.random() * Math.PI,
          0.02 + Math.random() * 0.035
        );
      }
    }

    // thin wispy cloud filaments
    for (let i = 0; i < 34; i++) {
      let x = Math.random() * W;
      let y = Math.random() * H;
      let dir = Math.random() * Math.PI * 2;
      const width = 10 + Math.random() * 26;
      const alpha = 0.02 + Math.random() * 0.04;
      for (let j = 0; j < 46; j++) {
        dir += (Math.random() - 0.5) * 0.5;
        x += Math.cos(dir) * 11;
        y += Math.sin(dir) * 11;
        glow(x, y, width * (0.7 + Math.random() * 0.6), 1, 0, alpha);
      }
    }

    // small blurry galaxies
    for (let i = 0; i < 130; i++) {
      glow(
        Math.random() * W,
        Math.random() * H,
        5 + Math.random() * 20,
        0.3 + Math.random() * 0.3,
        Math.random() * Math.PI,
        0.25 + Math.random() * 0.45
      );
    }

    // faint pin-point stars
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.5})`;
      const size = 0.5 + Math.random() * 1.3;
      ctx.fillRect(Math.random() * W, Math.random() * H, size, size);
    }
    return c;
  }

  function createTunnel() {
    if (!window.THREE) return null;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (err) {
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 1, 30);

    // the rig follows the path, the camera inside it turns with the mouse
    const camera = new THREE.PerspectiveCamera(62, 1, 0.01, 200);
    camera.rotation.y = Math.PI;
    const rig = new THREE.Group();
    rig.add(camera);
    scene.add(rig);

    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, -40),
      new THREE.Vector3(7, -2, -80),
      new THREE.Vector3(-6, 3, -120),
      new THREE.Vector3(3, -3, -160),
      new THREE.Vector3(0, 0, -200),
      new THREE.Vector3(0, 0, -240),
    ]);

    const texture = new THREE.CanvasTexture(makeTunnelTexture());
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 2);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(path, 300, 5, 32, false),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
    );
    scene.add(tube);

    // a few bright stars floating in the space you fly through
    const COUNT = 260;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const point = path.getPointAt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 4.4;
      positions[i * 3] = point.x + Math.cos(angle) * radius;
      positions[i * 3 + 1] = point.y + Math.sin(angle) * radius;
      positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 2;

      color.setScalar(0.45 + Math.random() * 0.55);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 0.11,
      map: new THREE.CanvasTexture(makeStarSprite()),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    // soft clouds you fly through
    const CLOUD_COLORS = [0xffffff, 0xd6d6d6, 0xb4b4b4];
    const cloudTextures = [0, 1, 2].map(() => new THREE.CanvasTexture(makeCloudSprite()));
    const clouds = [];
    for (let i = 0; i < 36; i++) {
      const material = new THREE.SpriteMaterial({
        map: cloudTextures[i % cloudTextures.length],
        color: CLOUD_COLORS[i % CLOUD_COLORS.length],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        rotation: Math.random() * Math.PI * 2,
      });
      const cloud = new THREE.Sprite(material);
      const point = path.getPointAt(0.04 + Math.random() * 0.96);
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 2.6;
      cloud.position.set(point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius, point.z);
      const size = 5 + Math.random() * 5;
      cloud.scale.set(size * 1.4, size, 1);
      cloud.userData.opacity = 0.07 + Math.random() * 0.11;
      cloud.userData.spin = (Math.random() - 0.5) * 0.06;
      clouds.push(cloud);
      scene.add(cloud);
    }

    function resize() {
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    let time = 0;
    return {
      render(progress, mx, my, dt) {
        const t = 0.02 + progress * 0.9;
        rig.position.copy(path.getPointAt(t));
        rig.lookAt(path.getPointAt(Math.min(t + 0.025, 1)));
        camera.rotation.y = Math.PI - mx * 0.22;
        camera.rotation.x = my * 0.14;
        // clouds fade out as you pass through them and into the distance
        clouds.forEach((cloud) => {
          const dist = cloud.position.distanceTo(rig.position);
          const near = clamp((dist - 1.5) / 7, 0, 1);
          const far = clamp((30 - dist) / 12, 0, 1);
          cloud.material.opacity = cloud.userData.opacity * near * far;
          cloud.visible = cloud.material.opacity > 0.003;
          if (!reducedMotion) cloud.material.rotation += cloud.userData.spin * dt;
        });
        if (!reducedMotion) {
          texture.offset.x -= dt * 0.02; // idle forward drift
          time += dt;
          starMaterial.size = 0.11 + Math.sin(time * 2.4) * 0.02; // twinkle
        }
        renderer.render(scene, camera);
      },
    };
  }

  const tunnel = createTunnel();
  if (!tunnel) canvas.style.display = "none";

  // ----- scroll + mouse state -----
  const target = { p: 0, mx: 0, my: 0, cx: -100, cy: -100 };
  const current = { p: 0, mx: 0, my: 0, cx: -100, cy: -100 };
  let heroVisible = true;

  // intro paragraph: split into words that light up as you scroll past
  const introWords = [];
  if (!reducedMotion) {
    const words = introText.textContent.trim().split(/\s+/);
    introText.textContent = "";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.textContent = word;
      introWords.push(span);
      introText.appendChild(span);
      if (i < words.length - 1) introText.appendChild(document.createTextNode(" "));
    });
  }

  function onScroll() {
    const vh = window.innerHeight;
    const heroRect = heroScroll.getBoundingClientRect();
    const total = heroScroll.offsetHeight - vh;
    if (total > 0) target.p = clamp(-heroRect.top / total, 0, 1);

    // solid header bar once the hero is behind you
    header.classList.toggle("is-solid", heroRect.bottom < 90);

    if (introWords.length) {
      const rect = introText.getBoundingClientRect();
      const progress = clamp((vh * 0.85 - rect.top) / (vh * 0.5 + rect.height), 0, 1);
      const lit = Math.round(progress * introWords.length);
      introWords.forEach((span, i) => span.classList.toggle("is-lit", i < lit));
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    target.mx = (e.clientX / window.innerWidth) * 2 - 1; // -1..1
    target.my = (e.clientY / window.innerHeight) * 2 - 1;
    target.cx = e.clientX;
    target.cy = e.clientY;
    cursor.classList.add("is-active");
  });
  document.documentElement.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));

  // cursor grows over clickable things
  document.addEventListener("pointerover", (e) => {
    cursor.classList.toggle("is-hover", !!e.target.closest("a, button"));
  });

  new IntersectionObserver(([entry]) => (heroVisible = entry.isIntersecting)).observe(heroScroll);

  // ----- main loop -----
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    current.p = lerp(current.p, target.p, 0.08);
    current.mx = lerp(current.mx, target.mx, 0.06);
    current.my = lerp(current.my, target.my, 0.06);
    current.cx = lerp(current.cx, target.cx, 0.2);
    current.cy = lerp(current.cy, target.cy, 0.2);

    cursor.style.transform = `translate3d(${current.cx}px, ${current.cy}px, 0)`;

    const v = clamp((current.p - PORTAL_START) / (1 - PORTAL_START), 0, 1);
    syncVideo(heroVisible, now);

    if (heroVisible) {
      hero.style.setProperty("--p", current.p.toFixed(4));
      hero.style.setProperty("--v", v.toFixed(4));
      hero.classList.toggle("is-traveling", current.p > 0.1);
      if (tunnel) tunnel.render(current.p, current.mx, current.my, dt);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ----- reveal the next section on scroll -----
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    [...group.children].forEach((el, i) => el.style.setProperty("--i", i));
  });
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll(".fade-up").forEach((el) => observer.observe(el));

  // ----- service cards: light follows the mouse -----
  document.querySelectorAll(".service").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--sx", `${e.clientX - r.left}px`);
      card.style.setProperty("--sy", `${e.clientY - r.top}px`);
    });
  });

  // ----- YouTube video inside the portal -----
  const REVEAL_DELAY = 3500; // ms of steady playback before the iframe is shown
  let player = null;
  let playerReady = false;
  let running = false;
  let revealTimer = null;
  let lastLoopCheck = 0;

  function hideVideo() {
    clearTimeout(revealTimer);
    revealTimer = null;
    hero.classList.remove("is-video-ready");
  }

  // The video runs muted behind the closed portal the whole time the hero is on
  // screen, so it is already playing when the portal opens: no start-up lag.
  function syncVideo(visible, now) {
    if (!playerReady) return;

    if (visible !== running) {
      running = visible;
      if (visible) player.playVideo();
      else {
        hideVideo();
        player.pauseVideo();
      }
    }

    // loop by hand just before the end, so YouTube's end screen never shows
    if (running && now - lastLoopCheck > 250) {
      lastLoopCheck = now;
      const duration = player.getDuration();
      if (duration > 0 && duration - player.getCurrentTime() < 0.6) player.seekTo(0, true);
    }
  }

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player("bgVideo", {
      events: {
        onReady: (e) => {
          e.target.mute();
          playerReady = true;
        },
        // YouTube draws its play icon and title whenever the video is not
        // steadily playing, so the iframe is only visible while it is; the
        // poster image covers every other moment.
        onStateChange: (e) => {
          const state = e.data;
          if (state === YT.PlayerState.PLAYING) {
            if (!revealTimer && !hero.classList.contains("is-video-ready")) {
              revealTimer = setTimeout(() => {
                revealTimer = null;
                hero.classList.add("is-video-ready");
              }, REVEAL_DELAY);
            }
          } else if (state !== YT.PlayerState.BUFFERING) {
            hideVideo();
            if (state === YT.PlayerState.ENDED) e.target.playVideo();
          }
        },
      },
    });
  };

  // loaded after the page so it does not slow down the tunnel
  function loadVideo() {
    video.src = video.dataset.src;
    const api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);
  }
})();
