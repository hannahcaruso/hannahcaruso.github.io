// Theme toggle: remembers the visitor's choice, otherwise follows their device.
(function () {
  const root = document.documentElement;
  const btn = document.querySelector(".theme-toggle");

  function saved() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }

  function isDark() {
    const t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function paint() {
    if (!btn) return;
    const dark = isDark();
    btn.textContent = dark ? "☀" : "☾";
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  const s = saved();
  if (s) root.setAttribute("data-theme", s);
  paint();

  if (btn) {
    btn.addEventListener("click", function () {
      const next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      paint();
    });
  }
})();

// Tabs
document.querySelectorAll(".tabs").forEach(function (tabs) {
  const buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));

  function select(btn) {
    buttons.forEach(function (b) {
      const on = b === btn;
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
      document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
    });
  }

  buttons.forEach(function (btn, i) {
    btn.addEventListener("click", function () { select(btn); });
    btn.addEventListener("keydown", function (e) {
      let j = null;
      if (e.key === "ArrowRight") j = (i + 1) % buttons.length;
      if (e.key === "ArrowLeft") j = (i - 1 + buttons.length) % buttons.length;
      if (j !== null) {
        e.preventDefault();
        buttons[j].focus();
        select(buttons[j]);
      }
    });
  });
});

// Gallery: filter buttons + lightbox that steps through only the visible photos.
(function () {
  const gallery = document.querySelector(".gallery");
  if (!gallery) return;

  const items = Array.from(gallery.querySelectorAll("button"));
  const filters = Array.from(document.querySelectorAll(".filters button"));
  const count = document.querySelector(".gallery-count");
  const box = document.querySelector(".lightbox");
  const boxImg = box.querySelector("img");
  const boxCap = box.querySelector("figcaption");
  let current = 0;

  function visible() {
    return items.filter(function (b) { return !b.hidden; });
  }

  function updateCount(label) {
    const n = visible().length;
    count.textContent = n + (n === 1 ? " photo" : " photos") + (label ? " · " + label : "");
  }

  filters.forEach(function (f) {
    f.addEventListener("click", function () {
      const tag = f.dataset.filter;
      filters.forEach(function (x) { x.setAttribute("aria-pressed", x === f); });
      items.forEach(function (b) {
        b.hidden = tag !== "all" && !b.dataset.tags.split(" ").includes(tag);
      });
      updateCount(tag === "all" ? "" : f.textContent);
    });
  });

  function show(i) {
    const list = visible();
    current = (i + list.length) % list.length;
    const b = list[current];
    const img = b.querySelector("img");
    boxImg.src = img.src;
    boxImg.alt = img.alt;
    boxCap.textContent = b.dataset.story;
  }

  items.forEach(function (b) {
    b.addEventListener("click", function () {
      show(visible().indexOf(b));
      box.showModal();
    });
  });

  box.querySelector("[data-prev]").addEventListener("click", function () { show(current - 1); });
  box.querySelector("[data-next]").addEventListener("click", function () { show(current + 1); });
  box.querySelector("[data-close]").addEventListener("click", function () { box.close(); });

  // Clicking the dark backdrop (outside the photo) closes it.
  box.addEventListener("click", function (e) {
    if (e.target === box) box.close();
  });

  box.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") show(current + 1);
    if (e.key === "ArrowLeft") show(current - 1);
  });

  updateCount("");
})();

// "What brings you joy?" quiz
(function () {
  const form = document.querySelector(".quiz form");
  if (!form) return;

  const IDEAS = {
    blue: {
      name: "Blue Spaces",
      text: "You're pulled toward water. Research on \"blue spaces\" links time near lakes, rivers and the ocean to lower stress and a calmer mood. That's my favorite one too.",
      photo: "photos/img_5567.jpg",
      alt: "Turquoise alpine lake with mountains behind it"
    },
    awe: {
      name: "Awe",
      text: "You chase the big view. Dacher Keltner's research on awe says moments of vastness shrink our worries and make us feel more connected to everything around us.",
      photo: "photos/img_3344.jpg",
      alt: "Waterfall pouring into mist under a huge blue sky"
    },
    restore: {
      name: "Attention Restoration",
      text: "You recharge with quiet. The Kaplans' attention restoration theory says nature holds our attention gently (\"soft fascination\"), giving a tired mind room to recover.",
      photo: "photos/img_5195.jpg",
      alt: "Stream winding through green hills toward a waterfall"
    },
    savor: {
      name: "Savoring",
      text: "You notice the little things. Savoring research shows that pausing to really take in a good moment makes the joy stronger and last longer.",
      photo: "photos/img_4016.jpg",
      alt: "Monarch butterfly resting on a hand over the grass"
    },
    bio: {
      name: "Biophilia",
      text: "You feel at home among living things. E. O. Wilson's biophilia hypothesis says humans have an inborn pull toward nature, a leftover from when our survival depended on it.",
      photo: "photos/img_6485.jpg",
      alt: "Mossy lava fields and evergreens beside a calm lake"
    },
    small: {
      name: "Small, Frequent Joys",
      text: "You find happiness in routine moments. Because we adapt fast to big changes, small repeated pleasures (like a nightly sunset) keep making us happy long after the big stuff fades.",
      photo: "photos/sunset.jpg",
      alt: "Orange and pink sunset clouds over trees"
    }
  };

  const result = document.querySelector(".result");
  const hint = form.querySelector(".quiz-hint");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const picked = Array.from(form.querySelectorAll("input:checked"));
    if (picked.length === 0) {
      hint.textContent = "Pick at least one thing first.";
      result.hidden = true;
      return;
    }
    hint.textContent = "";

    const scores = {};
    picked.forEach(function (input) {
      input.dataset.ideas.split(" ").forEach(function (key) {
        scores[key] = (scores[key] || 0) + 1;
      });
    });

    // Highest score wins; ties go to whichever idea appears first in IDEAS.
    let best = null;
    Object.keys(IDEAS).forEach(function (key) {
      if ((scores[key] || 0) > (best ? scores[best] : 0)) best = key;
    });

    const idea = IDEAS[best];
    result.querySelector("img").src = idea.photo;
    result.querySelector("img").alt = idea.alt;
    result.querySelector("h3").textContent = idea.name;
    result.querySelector("p").textContent = idea.text;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  form.addEventListener("reset", function () {
    result.hidden = true;
    hint.textContent = "";
  });
})();
