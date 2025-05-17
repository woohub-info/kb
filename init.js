// init.js

// ── Utility: debounce ─────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ── Timestamp formatting ──────────────────────────────────────────────────────
function formatTimestamp(ts) {
  const d   = new Date(ts);
  const M   = d.getMonth() + 1;
  const D   = d.getDate();
  const YY  = String(d.getFullYear() % 100).padStart(2, '0');
  let   h   = d.getHours();
  const m   = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${M}/${D}/${YY} ${h}:${m}${ampm}`;
}

// ── Read / “seen” state for items ─────────────────────────────────────────────
function getReadItems() {
  try { return JSON.parse(localStorage.getItem('readItems') || '{}'); }
  catch { return {}; }
}
function saveReadItems(obj) {
  localStorage.setItem('readItems', JSON.stringify(obj));
}
function markItemRead(slug, id) {
  const read = getReadItems();
  read[slug] = read[slug] || [];
  if (!read[slug].includes(id)) {
    read[slug].push(id);
    saveReadItems(read);
  }
}
function isItemRead(slug, id) {
  const read = getReadItems();
  return Array.isArray(read[slug]) && read[slug].includes(id);
}

// ── Badge logic ───────────────────────────────────────────────────────────────
const badgeDataMap = {};
function hasUnreadForSlug(slug) {
  const ids = badgeDataMap[slug] || [];
  return ids.some(id => !isItemRead(slug, id));
}

// ── Last-seen update banner ──────────────────────────────────────────────────
function getLastSeenUpdate() {
  return localStorage.getItem('lastSeenUpdate');
}
function setLastSeenUpdate(ts) {
  localStorage.setItem('lastSeenUpdate', ts);
}

// ── Notification badge animation ─────────────────────────────────────────────
async function updateCardBadges() {
  for (const c of cardsData) {
    const badge = document.querySelector(`[data-slug="${c.slug}"] .badge`);
    if (!badge) continue;
    try {
      const data  = await fetchItems(c.slug);
      const items = Array.isArray(data) ? data : Object.values(data).flat();
      const hasUnread = items.some(item => {
        const id = item.id || item.name;
        return !isItemRead(c.slug, id);
      });
      badge.classList.toggle('hidden', !hasUnread);
    } catch {}
  }
}

// ── Banner show/hide ─────────────────────────────────────────────────────────
function showUpdateBanner(message) {
  if (bannerClosed) return;
  const banner = document.getElementById('update-banner');
  const content = document.getElementById('update-banner-content');
  content.textContent = message;
  banner.classList.remove('hidden');
  banner.classList.add('show');
}
function hideUpdateBanner() {
  document.getElementById('update-banner').classList.add('hidden');
}

// ── Fetch & cache JSON data ──────────────────────────────────────────────────
const contentCache = {};
async function fetchItems(slug) {
  if (contentCache[slug]) return contentCache[slug];
  const res = await fetch(`data/${slug}.json`);
  if (!res.ok) throw new Error('Failed to load data');
  const data = await res.json();
  contentCache[slug] = data;
  return data;
}

// ── Recently Viewed ──────────────────────────────────────────────────────────
function renderRecentlyViewed(recents) {
  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = '';
  if (!recents.length) {
    recentList.innerHTML = '<li class="py-2 text-gray-500 italic">No recently viewed items</li>';
    return;
  }
  recents.forEach(item => {
    const li = document.createElement('li');
    li.className = 'py-2 text-indigo-600 hover:underline cursor-pointer';
    li.textContent = item.title;
    li.onclick = () => {
      if (item.type === 'card') showContent(item.slug, item.title);
      else openEmailOverlay(item.title, item.content, item.slug);
    };
    recentList.appendChild(li);
  });
}
function addToRecents(item) {
  const key = 'recentlyViewed';
  let recents = JSON.parse(localStorage.getItem(key) || '[]');
  recents = recents.filter(r => !(r.slug === item.slug && r.id === item.id));
  recents.unshift(item);
  recents = recents.slice(0, 10);
  localStorage.setItem(key, JSON.stringify(recents));
  renderRecentlyViewed(recents);
}

// ── Card rendering ───────────────────────────────────────────────────────────
const cardsData = [
  { title: 'Email Templates', slug: 'email-templates', description: 'Browse pre-built email templates.' },
  { title: 'Processes',      slug: 'processes',      description: 'Step-by-step how-to guides and workflows.' },
  { title: 'Reports',        slug: 'reports',        description: 'Access performance and usage reports.' },
  { title: 'Links',          slug: 'links',          description: 'Quick access to essential resources.' },
  { title: 'Tutorials',      slug: 'tutorials',      description: 'Video lessons to guide you through every step.' },
  { title: 'Directory',      slug: 'directory',      description: 'Key people to contact.' }
];
function renderCards() {
  const container = document.getElementById('card-container');
  container.innerHTML = '';
  cardsData.forEach(card => {
    const article = document.createElement('article');
    article.setAttribute('data-tilt', '');
    article.dataset.slug = card.slug;
    article.className = 'relative bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 flex flex-col';
    article.innerHTML = `
      <span class="badge absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full hidden">new</span>
      <h3 tabindex="0" class="text-xl font-semibold mb-2 hover:text-indigo-600 cursor-pointer">${card.title}</h3>
      <p class="text-gray-600 flex-1">${card.description}</p>
      <button class="bg-indigo-600 hover:bg-indigo-700 text-white mt-4 font-medium px-4 py-2 rounded-lg transition">
        View ${card.title} →
      </button>
    `;
    article.querySelector('h3').onclick    = () => showContent(card.slug, card.title);
    article.querySelector('button').onclick = () => showContent(card.slug, card.title);
    container.appendChild(article);
  });
  updateCardBadges();
}

// ── Detail view & email-overlay ──────────────────────────────────────────────
async function showContent(slug, title) {
  addToRecents({ id: slug, slug, title, type: 'card' });
  document.getElementById('card-container').classList.add('hidden');
  document.getElementById('detail-container').classList.remove('hidden');
  document.getElementById('detail-title').textContent = title;
  const detailList = document.getElementById('detail-list');
  detailList.innerHTML = '';

  if (slug === 'links') {
    const groups = await fetchItems('links');
    const oldIds = new Set((window.initialLinks || []).map(i => i.id));
    for (const [category, items] of Object.entries(groups)) {
      if (category) {
        const hdr = document.createElement('h3');
        hdr.className = 'text-lg font-semibold mt-4';
        hdr.textContent = category;
        detailList.appendChild(hdr);
      }
      items.forEach(item => {
        if (oldIds.has(item.name)) markItemRead('links', item.name);
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.href       = item.url;
        a.target     = '_blank';
        a.rel        = 'noopener noreferrer';
        a.textContent= item.name;
        a.className  = 'text-indigo-600 hover:underline';
        const dot = document.createElement('span');
        dot.className = 'ml-2 inline-block w-2 h-2 bg-red-600 rounded-full';
        if (isItemRead('links', item.name)) dot.classList.add('hidden');
        a.onclick = () => {
          markItemRead('links', item.name);
          dot.classList.add('hidden');
          updateCardBadges();
        };
        li.appendChild(a);
        li.appendChild(dot);
        detailList.appendChild(li);
      });
    }
    updateCardBadges();
    return;
  }

  if (slug === 'reports') {
    // Reports logic remains identical to your original
    const imagePaths = [
      'https://raw.githubusercontent.com/chmpzu/assets/main/reports/woo_ebay.png',
      'https://raw.githubusercontent.com/chmpzu/assets/main/reports/woo_amz.png'
    ];
    const extraPaths = [
      'https://raw.githubusercontent.com/chmpzu/assets/main/reports/autoapex_ebay.png'
    ];
    detailList.innerHTML = `
      <div class="prose max-w-none space-y-8">
        <p>
          <a href="https://netorgft5128391.sharepoint.com/:x:/s/WooParts/ER63Z5Stme9LntyUK_P_3YEBxDfhDAG0emS4e_Y2BWpRSA?e=XjLGgl"
             target="_blank" rel="noopener noreferrer"
             class="text-blue-600 hover:underline">
            WooParts eBay and Amazon Monthly Performance – 2025
          </a>
        </p>
        <div class="space-y-4">
          ${imagePaths.map(p => `<img src="${p}" loading="lazy" class="h-64 w-auto object-contain block" alt="Report">`).join('')}
        </div>
        <p>
          <a href="https://netorgft5128391.sharepoint.com/:x:/s/WooParts/EdkrNcbAsn1Oj6R_91SAOs4BwbNHpXFXBZtCrfaNoLYq3Q?e=7qIebl"
             target="_blank" rel="noopener noreferrer"
             class="text-blue-600 hover:underline">
            AutoApex eBay Monthly Performance – 2025
          </a>
        </p>
        <div class="space-y-4">
          ${extraPaths.map(p => `<img src="${p}" loading="lazy" class="h-64 w-auto object-contain block" alt="Extra Report">`).join('')}
        </div>
      </div>
    `;
    return;
  }

  // Default: fetch JSON items & show as list
  try {
    const data   = await fetchItems(slug);
    const groups = Array.isArray(data) ? { '': data } : data;
    for (const [category, items] of Object.entries(groups)) {
      if (category) {
        const hdr = document.createElement('h3');
        hdr.className = 'text-lg font-semibold mt-4';
        hdr.textContent= category;
        detailList.appendChild(hdr);
      }
      items.forEach(item => {
        const li = document.createElement('li');
        const btn= document.createElement('button');
        btn.className = 'flex items-center text-indigo-600 hover:underline focus:outline-none';
        btn.textContent= item.name;
        const id  = item.id || item.name;
        const dot = document.createElement('span');
        dot.className = 'ml-2 inline-block w-2 h-2 bg-red-600 rounded-full';
        if (isItemRead(slug, id)) dot.classList.add('hidden');
        btn.appendChild(dot);
        btn.onclick = () => {
          openEmailOverlay(item.name, item.content, slug);
          markItemRead(slug, id);
          dot.classList.add('hidden');
          if (!hasUnreadForSlug(slug)) {
            const badge = document.querySelector(`[data-slug="${slug}"] .badge`);
            if (badge) badge.classList.add('hidden');
          }
        };
        li.appendChild(btn);
        detailList.appendChild(li);
      });
    }
  } catch {
    detailList.innerHTML = `<li class="text-red-500">This page is under construction – check back soon!</li>`;
  }
}

// ── Modal focus trap ──────────────────────────────────────────────────────────
function trapFocus(e) {
  const focusable = Array.from(overlayDialog.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'))
                         .filter(el => !el.disabled);
  if (!overlay.classList.contains('hidden') && e.key === 'Tab') {
    const idx = focusable.indexOf(document.activeElement);
    if (e.shiftKey && idx === 0) {
      focusable[focusable.length - 1].focus();
      e.preventDefault();
    } else if (!e.shiftKey && idx === focusable.length - 1) {
      focusable[0].focus();
      e.preventDefault();
    }
  }
}

// ── Overlay open/close & copy ───────────────────────────────────────────────
let lastFocused;
function openEmailOverlay(name, htmlContent, slug) {
  lastFocused = document.activeElement;
  document.documentElement.style.overflow = 'hidden';
  overlayHeader.textContent = name;
  const card      = cardsData.find(c => c.slug === slug);
  const titleHtml = card ? `<h3 class="text-lg font-semibold mb-2">${card.title}</h3>` : '';
  overlayBody.innerHTML = titleHtml + `<div class="prose max-w-none space-y-4">${htmlContent}</div>`;
  addToRecents({ id: name, slug, title: name, content: htmlContent, type: 'item' });
  overlay.classList.remove('hidden');
  overlayDialog.classList.add('opacity-100','scale-100');
  copyBtn.classList.remove('hidden');
  overlayClose.focus();
}

// ── Back button & scroll-to-top ─────────────────────────────────────────────
backBtn.onclick = () => {
  detailContainer.classList.add('hidden');
  container.classList.remove('hidden');
  document.documentElement.style.overflow = '';
};
window.addEventListener('scroll', () => {
  toTopBtn.classList.toggle('hidden', window.scrollY < 300);
});
toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// ── Notification icon mapping ───────────────────────────────────────────────
function iconFor(type) {
  return {
    updates: '🔔',
    'email-templates': '✉️',
    processes: '🛠️',
    reports: '📊',
    links: '🔗',
    tutorials: '🎥',
    directory: '📇'
  }[type] || '🆕';
}

// ── Relative time formatting ─────────────────────────────────────────────────
function getRelativeTime(date) {
  const now     = new Date();
  const diffSec = (now - date) / 1000;
  if (diffSec < 60)      return 'just now';
  if (diffSec < 3600)    {
    const m = Math.floor(diffSec / 60);
    return `${m} min${m > 1 ? 's' : ''} ago`;
  }
  if (diffSec < 86400)   {
    const h = Math.floor(diffSec / 3600);
    return `${h} hour${h > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

// ── Poll notifications ───────────────────────────────────────────────────────
async function pollNotifications() {
  let allItems = [];
  try {
    const res = await fetch('data/updates.json');
    if (res.ok) {
      const data = await res.json();
      allItems = data.map(u => ({
        id:   u.id || u.timestamp + u.text,
        text: u.text,
        time: new Date(u.timestamp),
        type: 'updates'
      }));
    }
  } catch {}

  for (const c of cardsData) {
    if (c.slug === 'reports') continue;
    try {
      const res = await fetch(`data/${c.slug}.json`);
      if (!res.ok) continue;
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : Object.values(raw).flat();
      allItems.push(...arr.map(i => ({
        id: `${c.slug}|${i.name}`,
        text: `New ${c.title}: ${i.name}`,
        time: new Date(i.timestamp || Date.now()),
        type: c.slug
      })));
    } catch {}
  }

  const unread = allItems.filter(i => !seenNotifIds.has(i.id));
  const read   = allItems.filter(i =>  seenNotifIds.has(i.id));
  const sortDesc = list => list.sort((a,b) => b.time - a.time);
  const sorted   = [...sortDesc(unread), ...sortDesc(read)];

  notifListEl.innerHTML = '';
  let newCount = unread.length;
  sorted.forEach(item => {
    const li = document.createElement('li');
    li.className = 'p-2 border-b hover:bg-gray-50 flex justify-between items-center';
    const wrapper = document.createElement('div');
    if (!seenNotifIds.has(item.id)) {
      const nb = document.createElement('span');
      nb.textContent = 'New ';
      nb.className   = 'new-badge text-red-600 text-xs font-semibold mr-1';
      wrapper.appendChild(nb);
    }
    const txt = document.createElement('span');
    txt.textContent = `${iconFor(item.type)} ${item.text}`;
    wrapper.appendChild(txt);
    li.appendChild(wrapper);
    const tm = document.createElement('time');
    tm.className = 'text-xs text-gray-500';
    tm.textContent = getRelativeTime(item.time);
    tm.title       = item.time.toLocaleString();
    li.appendChild(tm);
    notifListEl.appendChild(li);
    seenNotifIds.add(item.id);
  });
  localStorage.setItem('seenNotifIds', JSON.stringify([...seenNotifIds]));
  setNotifCount(newCount);

  const bellIcon = document.getElementById('bellIcon');
  bellIcon.style.animation = 'bell-bounce 0.6s';
  bellIcon.addEventListener('animationend', () => { bellIcon.style.animation = ''; }, { once: true });
}
setInterval(pollNotifications, 60000);
pollNotifications();

// ── Notification handlers ───────────────────────────────────────────────────
notifBtn.onclick = () => {
  const isOpen = !notifDropdown.classList.toggle('hidden');
  notifBtn.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) {
    setNotifCount(0);
    document.querySelectorAll('#notification-list li .new-badge').forEach(el => el.remove());
    localStorage.setItem('seenNotifIds', JSON.stringify([...seenNotifIds]));
  }
};
clearNotifsBtn.onclick = () => {
  const allKnownIds = Object.values(badgeDataMap).flat();
  allKnownIds.forEach(id => seenNotifIds.add(id));
  localStorage.setItem('seenNotifIds', JSON.stringify([...seenNotifIds]));
  notifListEl.innerHTML = '';
  setNotifCount(0);
};

// ── Update banner close ─────────────────────────────────────────────────────
document.getElementById('update-banner-close').addEventListener('click', hideUpdateBanner);

// ── Updates panel polling & rendering ────────────────────────────────────────
let allUpdates = [], displayCount = 5, initialUpdatesLoad = true;
async function pollUpdatesPanel() {
  try {
    const res = await fetch('data/updates.json');
    if (!res.ok) return;
    allUpdates = (await res.json()).map(u => ({ text: u.text, time: u.timestamp, link: u.link }));
    renderUpdatesPanel();
  } catch { console.error('Updates panel error'); }
}
function renderUpdatesPanel() {
  const filterVal = (updatesFilter?.value || mobileUpdatesFilter?.value || '').toLowerCase();
  const filtered = allUpdates.filter(u => u.text.toLowerCase().includes(filterVal))
                             .sort((a,b) => new Date(b.time) - new Date(a.time));
  const toShow = filtered.slice(0, displayCount);
  const latestTime = toShow[0]?.time;
  const isNew      = latestTime && latestTime !== getLastSeenUpdate();

  [updatesContainer, mobileUpdatesContainer].forEach(cn => {
    cn.innerHTML = '';
    if (!toShow.length) {
      const li = document.createElement('li');
      li.textContent = 'No updates available.';
      li.className   = 'py-2 text-gray-500';
      cn.appendChild(li);
    } else {
      toShow.forEach((u,i) => {
        const li = document.createElement('li');
        if (u.link) {
          const a = document.createElement('a');
          a.href = u.link;
          a.className = 'block py-2 hover:underline';
          if (i === 0 && initialUpdatesLoad) {
            const badge = document.createElement('span');
            badge.textContent = 'New ';
            badge.className   = 'text-red-600 text-xs font-semibold';
            a.appendChild(badge);
            showUpdateBanner(u.text);
          }
          a.appendChild(document.createTextNode(`${u.time}: ${u.text}`));
          li.appendChild(a);
        } else {
          if (i === 0 && initialUpdatesLoad) {
            const badge = document.createElement('span');
            badge.textContent = 'New ';
            badge.className   = 'text-red-600 text-xs font-semibold';
            li.appendChild(badge);
            showUpdateBanner(u.text);
          }
          li.appendChild(document.createTextNode(`${u.time}: ${u.text}`));
          li.className = 'py-2';
        }
        cn.appendChild(li);
      });
    }
  });

  if (isNew) setLastSeenUpdate(latestTime);
  initialUpdatesLoad = false;
}
setInterval(pollUpdatesPanel, 60000);
pollUpdatesPanel();

// ── Filter toggles ──────────────────────────────────────────────────────────
updatesToggleBtn.onclick       = () => updatesFilterContainer.classList.toggle('hidden');
mobileUpdatesToggleBtn.onclick = () => mobileUpdatesFilterContainer.classList.toggle('hidden');
updatesFilter?.addEventListener('input', debounce(renderUpdatesPanel, 200));
mobileUpdatesFilter?.addEventListener('input', debounce(renderUpdatesPanel, 200));

// ── Fuzzy search index & suggestions ────────────────────────────────────────
let fuse;
async function buildSearchIndex() {
  const items = cardsData.map(c => ({ name: c.title, content: c.description, slug: c.slug, isRoot: true }));
  for (const c of cardsData) {
    if (c.slug === 'reports') continue;
    try {
      const data = await fetchItems(c.slug);
      const arr  = Array.isArray(data) ? data : Object.values(data).flat();
      arr.forEach(i => items.push({ name: i.name, content: i.content, slug: c.slug, isRoot: false }));
    } catch {}
  }
  fuse = new Fuse(items, { keys: ['name','content'], includeMatches: true, threshold: 0.4 });
}
function renderSuggestions(results) {
  searchSuggestions.innerHTML = '';
  if (!results.length) {
    searchSuggestions.innerHTML = '<li class="px-4 py-2 text-gray-500">No results</li>';
  } else {
    results.forEach(r => {
      let label = r.item.name;
      const match = r.matches.find(m => m.key === 'name');
      if (match) {
        let h = '', last = 0;
        match.indices.forEach(([s,e]) => {
          h += label.slice(last,s) + `<mark>${label.slice(s,e+1)}</mark>`;
          last = e+1;
        });
        h += label.slice(last);
        label = h;
      }
      const li = document.createElement('li');
      li.role      = 'option';
      li.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer';
      li.innerHTML = label;
      li.onclick = () => {
        (r.item.isRoot ? showContent : openEmailOverlay)(r.item.slug||r.item.name, r.item.content, r.item.slug);
        searchSuggestions.classList.add('hidden');
        searchInput.setAttribute('aria-expanded', 'false');
      };
      searchSuggestions.appendChild(li);
    });
  }
}

// ── Keyboard shortcut for Search ────────────────────────────────────────────
searchInput.addEventListener('input', debounce(async e => {
  const q = e.target.value.trim();
  if (!q) return searchSuggestions.classList.add('hidden');
  if (!fuse) await buildSearchIndex();
  renderSuggestions(fuse.search(q));
  searchSuggestions.classList.remove('hidden');
  searchInput.setAttribute('aria-expanded','true');
}, 250));
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
});

// ── Final initialization on page load ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const recents = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  renderRecentlyViewed(recents);

  renderCards();
  buildSearchIndex();
  renderChangeLog(JSON.parse(localStorage.getItem('changeLog') || '[]'));

  // SSE subscription for change-log
  const evtSource2 = new EventSource('/events');
  evtSource2.onmessage = e => {
    const { file, updatedAt } = JSON.parse(e.data);
    const ts = formatTimestamp(updatedAt);
    const storedLogs = JSON.parse(localStorage.getItem('changeLog') || '[]');
    storedLogs.unshift(`[${ts}] ${file} changed`);
    localStorage.setItem('changeLog', JSON.stringify(storedLogs));
    renderChangeLog(storedLogs);
  };
  
  // Tilt & parallax effects
  VanillaTilt.init(document.querySelectorAll('article[data-tilt]'), { max:15, speed:400, glare:true,'max-glare':0.2 });
  window.addEventListener('scroll', () => { parallaxBg.style.transform = `translateY(${window.scrollY * 0.3}px)`; });

  setNotifCount(0);
});
