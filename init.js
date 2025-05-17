// ── Grab all the DOM refs up front ─────────────────────────────────────────────
const parallaxBg               = document.getElementById('parallax-bg');
const container                = document.getElementById('card-container');
const detailContainer          = document.getElementById('detail-container');
const detailTitle              = document.getElementById('detail-title');
const detailList               = document.getElementById('detail-list');
const backBtn                  = document.getElementById('back-btn');
const overlay                  = document.getElementById('overlay');
const overlayDialog            = overlay.querySelector('[tabindex="-1"]');
const overlayClose             = document.getElementById('overlay-close');
const copyBtn                  = document.getElementById('copy-btn');
const overlayHeader            = document.getElementById('overlay-header');
const overlayBody              = document.getElementById('overlay-body');
const searchInput              = document.getElementById('search-input');
const searchSuggestions        = document.getElementById('search-suggestions');
const notifBtn                 = document.getElementById('notification-btn');
const notifCountEl             = document.getElementById('notification-count');
const notifDropdown            = document.getElementById('notification-dropdown');
const notifListEl              = document.getElementById('notification-list');
const clearNotifsBtn           = document.getElementById('clear-notifications');
const updatesFilterContainer   = document.getElementById('updates-filter-container');
const updatesFilter            = document.getElementById('updates-filter');
const updatesToggleBtn         = document.getElementById('updates-filter-toggle');
const mobileUpdatesFilterContainer = document.getElementById('mobile-updates-filter-container');
const mobileUpdatesFilter      = document.getElementById('mobile-updates-filter');
const mobileUpdatesToggleBtn   = document.getElementById('mobile-updates-filter-toggle');
const updatesContainer         = document.getElementById('updates-container');
const mobileUpdatesContainer   = document.getElementById('mobile-updates-container');
const toTopBtn                 = document.getElementById('to-top');
const seenNotifIds             = new Set(JSON.parse(localStorage.getItem('seenNotifIds') || '[]'));

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
  const M   = d.getMonth()+1, D = d.getDate();
  const YY  = String(d.getFullYear()%100).padStart(2,'0');
  let   h   = d.getHours();
  const m   = String(d.getMinutes()).padStart(2,'0');
  const ampm = h<12?'AM':'PM';
  h = h%12||12;
  return `${M}/${D}/${YY} ${h}:${m}${ampm}`;
}

// ── Read/seen helpers ─────────────────────────────────────────────────────────
function getReadItems() {
  try { return JSON.parse(localStorage.getItem('readItems')||'{}'); }
  catch { return {}; }
}
function saveReadItems(obj) {
  localStorage.setItem('readItems', JSON.stringify(obj));
}
function markItemRead(slug, id) {
  const read = getReadItems();
  read[slug] = read[slug]||[];
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
  return ids.some(id => !isItemRead(slug,id));
}

// ── Update‐banner helpers ─────────────────────────────────────────────────────
function getLastSeenUpdate()     { return localStorage.getItem('lastSeenUpdate'); }
function setLastSeenUpdate(ts)  { localStorage.setItem('lastSeenUpdate', ts); }
let bannerClosed = false;
function showUpdateBanner(msg) {
  if (bannerClosed) return;
  const b = document.getElementById('update-banner'),
        c = document.getElementById('update-banner-content');
  c.textContent = msg;
  b.classList.remove('hidden');
  b.classList.add('show');
}
function hideUpdateBanner() {
  document.getElementById('update-banner').classList.add('hidden');
}

// ── JSON fetch & cache ───────────────────────────────────────────────────────
const contentCache = {};
async function fetchItems(slug) {
  if (contentCache[slug]) return contentCache[slug];
  const res = await fetch(`data/${slug}.json`);
  if (!res.ok) throw new Error('Failed to load '+slug);
  const data = await res.json();
  contentCache[slug] = data;
  return data;
}

// ── Recently Viewed ──────────────────────────────────────────────────────────
function renderRecentlyViewed(recents) {
  const list = document.getElementById('recent-list');
  list.innerHTML = '';
  if (!recents.length) {
    list.innerHTML = '<li class="py-2 text-gray-500 italic">No recently viewed items</li>';
    return;
  }
  recents.forEach(item => {
    const li = document.createElement('li');
    li.className = 'py-2 text-indigo-600 hover:underline cursor-pointer';
    li.textContent = item.title;
    li.onclick = () => {
      if (item.type==='card') showContent(item.slug,item.title);
      else openEmailOverlay(item.title,item.content,item.slug);
    };
    list.appendChild(li);
  });
}
function addToRecents(item) {
  const key = 'recentlyViewed';
  let recents = JSON.parse(localStorage.getItem(key)||'[]');
  recents = recents.filter(r=>!(r.slug===item.slug&&r.id===item.id));
  recents.unshift(item);
  recents = recents.slice(0,10);
  localStorage.setItem(key,JSON.stringify(recents));
  renderRecentlyViewed(recents);
}

// ── Cards setup ──────────────────────────────────────────────────────────────
const cardsData = [
  { title:'Email Templates', slug:'email-templates', description:'Browse pre-built email templates.' },
  { title:'Processes',      slug:'processes',      description:'Step-by-step how-to guides and workflows.' },
  { title:'Reports',        slug:'reports',        description:'Access performance and usage reports.' },
  { title:'Links',          slug:'links',          description:'Quick access to essential resources.' },
  { title:'Tutorials',      slug:'tutorials',      description:'Video lessons to guide you through every step.' },
  { title:'Directory',      slug:'directory',      description:'Key people to contact.' }
];
function updateCardBadges() {
  cardsData.forEach(async c => {
    const badge = document.querySelector(`[data-slug="${c.slug}"] .badge`);
    if (!badge) return;
    try {
      const data = await fetchItems(c.slug),
            items = Array.isArray(data)?data:Object.values(data).flat(),
            hasU  = items.some(i=>!isItemRead(c.slug,i.id||i.name));
      badge.classList.toggle('hidden',!hasU);
    } catch{}
  });
}
function renderCards() {
  container.innerHTML = '';
  cardsData.forEach(card => {
    const art = document.createElement('article');
    art.setAttribute('data-tilt','');
    art.dataset.slug = card.slug;
    art.className    = 'relative bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 flex flex-col';
    art.innerHTML = `
      <span class="badge absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full hidden">new</span>
      <h3 tabindex="0" class="text-xl font-semibold mb-2 hover:text-indigo-600 cursor-pointer">${card.title}</h3>
      <p class="text-gray-600 flex-1">${card.description}</p>
      <button class="bg-indigo-600 hover:bg-indigo-700 text-white mt-4 font-medium px-4 py-2 rounded-lg transition">
        View ${card.title} →
      </button>
    `;
    art.querySelector('h3').onclick    = ()=>showContent(card.slug,card.title);
    art.querySelector('button').onclick= ()=>showContent(card.slug,card.title);
    container.appendChild(art);
  });
  updateCardBadges();
}

// ── Detail View & Overlay ────────────────────────────────────────────────────
async function showContent(slug,title) {
  addToRecents({id:slug,slug,title,type:'card'});
  container.classList.add('hidden');
  detailContainer.classList.remove('hidden');
  detailTitle.textContent = title;
  detailList.innerHTML    = '';

  if (slug==='links') {
    const groups = await fetchItems('links');
    const oldIds = new Set((window.initialLinks||[]).map(i=>i.id));
    for (const [cat,items] of Object.entries(groups)) {
      if (cat) {
        const h3 = document.createElement('h3');
        h3.className='text-lg font-semibold mt-4';
        h3.textContent=cat;
        detailList.appendChild(h3);
      }
      items.forEach(it=>{
        if (oldIds.has(it.name)) markItemRead('links',it.name);
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.href=it.url; a.target='_blank'; a.rel='noopener noreferrer';
        a.textContent=it.name; a.className='text-indigo-600 hover:underline';
        const dot=document.createElement('span');
        dot.className='ml-2 inline-block w-2 h-2 bg-red-600 rounded-full';
        if (isItemRead('links',it.name)) dot.classList.add('hidden');
        a.onclick=()=>{
          markItemRead('links',it.name);
          dot.classList.add('hidden');
          updateCardBadges();
        };
        li.append(a,dot);
        detailList.appendChild(li);
      });
    }
    return updateCardBadges();
  }

  if (slug==='reports') {
    const paths = [
      'https://raw.githubusercontent.com/chmpzu/assets/main/reports/woo_ebay.png',
      'https://raw.githubusercontent.com/chmpzu/assets/main/reports/woo_amz.png'
    ];
    const extra = ['https://raw.githubusercontent.com/chmpzu/assets/main/reports/autoapex_ebay.png'];
    detailList.innerHTML=`
      <div class="prose max-w-none space-y-8">
        <p><a href="https://netorgft5128391.sharepoint.com/:x:/s/WooParts/ER63Z5Stme9LntyUK_P_3YEBxDfhDAG0emS4e_Y2BWpRSA?e=XjLGgl" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">WooParts eBay & Amazon Monthly Performance – 2025</a></p>
        <div class="space-y-4">${paths.map(p=>`<img src="${p}" loading="lazy" class="h-64 w-auto object-contain block" alt="Report">`).join('')}</div>
        <p><a href="https://netorgft5128391.sharepoint.com/:x:/s/WooParts/EdkrNcbAsn1Oj6R_91SAOs4BwbNHpXFXBZtCrfaNoLYq3Q?e=7qIebl" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">AutoApex eBay Monthly Performance – 2025</a></p>
        <div class="space-y-4">${extra.map(p=>`<img src="${p}" loading="lazy" class="h-64 w-auto object-contain block" alt="Extra Report">`).join('')}</div>
      </div>
    `;
    return;
  }

  try {
    const data   = await fetchItems(slug);
    const groups = Array.isArray(data)?{ '':data }:data;
    for (const [cat,items] of Object.entries(groups)) {
      if (cat) {
        const h3=document.createElement('h3');
        h3.className='text-lg font-semibold mt-4';
        h3.textContent=cat;
        detailList.appendChild(h3);
      }
      items.forEach(it=>{
        const li= document.createElement('li');
        const btn=document.createElement('button');
        btn.className='flex items-center text-indigo-600 hover:underline focus:outline-none';
        btn.textContent=it.name;
        const id= it.id||it.name;
        const dot=document.createElement('span');
        dot.className='ml-2 inline-block w-2 h-2 bg-red-600 rounded-full';
        if (isItemRead(slug,id)) dot.classList.add('hidden');
        btn.append(dot);
        btn.onclick=()=>{
          openEmailOverlay(it.name,it.content,slug);
          markItemRead(slug,id);
          dot.classList.add('hidden');
          if (!hasUnreadForSlug(slug)) document.querySelector(`[data-slug="${slug}"] .badge`).classList.add('hidden');
        };
        li.append(btn);
        detailList.append(li);
      });
    }
  } catch {
    detailList.innerHTML=`<li class="text-red-500">This page is under construction – check back soon!</li>`;
  }
}

// ── Overlay / focus trap / copy ───────────────────────────────────────────────
let lastFocused;
function trapFocus(e) {
  const focusable = Array.from(overlayDialog.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled);
  if (!overlay.classList.contains('hidden') && e.key==='Tab') {
    const idx = focusable.indexOf(document.activeElement);
    if (e.shiftKey && idx===0) {
      focusable[focusable.length-1].focus(); e.preventDefault();
    } else if (!e.shiftKey && idx===focusable.length-1) {
      focusable[0].focus(); e.preventDefault();
    }
  }
}
function openEmailOverlay(name,html,slug) {
  lastFocused=document.activeElement;
  document.documentElement.style.overflow='';
  overlayHeader.textContent=name;
  const card=cardsData.find(c=>c.slug===slug),
        titleHtml=card?`<h3 class="text-lg font-semibold mb-2">${card.title}</h3>`:'';
  overlayBody.innerHTML=titleHtml+`<div class="prose max-w-none space-y-4">${html}</div>`;
  addToRecents({id:name,slug,title:name,content:html,type:'item'});
  overlay.classList.remove('hidden');
  overlayDialog.classList.add('opacity-100','scale-100');
  copyBtn.classList.remove('hidden');
  overlayClose.focus();
}
overlayClose.onclick=()=>{
  overlay.classList.add('hidden');
  document.documentElement.style.overflow='';
  lastFocused?.focus();
};
overlay.onclick=e=>{ if(e.target===overlay) overlayClose.click(); };
copyBtn.onclick=()=>{
  navigator.clipboard.writeText(overlayBody.innerText).then(()=>{
    copyBtn.textContent='Copied!';
    setTimeout(()=>copyBtn.textContent='Copy',2000);
  });
};

// ── Breadcrumb “back” & to-top ───────────────────────────────────────────────
backBtn.onclick = ()=>{
  detailContainer.classList.add('hidden');
  container.classList.remove('hidden');
};
window.addEventListener('scroll',()=>{
  toTopBtn.classList.toggle('hidden',window.scrollY<300);
});
toTopBtn.onclick = ()=>window.scrollTo({top:0,behavior:'smooth'});

// ── Notifications poll & render ──────────────────────────────────────────────
function iconFor(type) {
  return { updates:'🔔','email-templates':'✉️',processes:'🛠️',reports:'📊',links:'🔗',tutorials:'🎥',directory:'📇' }[type] || '🆕';
}
function getRelativeTime(date) {
  const now= new Date(), diff=(now-date)/1000;
  if(diff<60) return 'just now';
  if(diff<3600) return `${Math.floor(diff/60)} min`;
  if(diff<86400) return `${Math.floor(diff/3600)} hour`;
  return date.toLocaleDateString();
}
async function pollNotifications() {
  let all = [];
  try {
    const r=await fetch('data/updates.json');
    if(r.ok) {
      (await r.json()).forEach(u=>all.push({id:u.id||u.timestamp+u.text,text:u.text,time:new Date(u.timestamp),type:'updates'}));
    }
  }catch{}
  for(const c of cardsData) {
    if(c.slug==='reports') continue;
    try {
      const r=await fetch(`data/${c.slug}.json`);
      if(!r.ok) continue;
      const raw=await r.json(), arr=Array.isArray(raw)?raw:Object.values(raw).flat();
      arr.forEach(i=>all.push({id:`${c.slug}|${i.name}`,text:`New ${c.title}: ${i.name}`,time:new Date(i.timestamp||Date.now()),type:c.slug}));
    }catch{}
  }
  const unread=all.filter(i=>!seenNotifIds.has(i.id)), read=all.filter(i=>seenNotifIds.has(i.id));
  const sortDesc=list=>list.sort((a,b)=>b.time-a.time), sorted=[...sortDesc(unread),...sortDesc(read)];
  notifListEl.innerHTML='';
  let newCount=unread.length;
  sorted.forEach(item=>{
    const li=document.createElement('li');
    li.className='p-2 border-b hover:bg-gray-50 flex justify-between';
    const wrap=document.createElement('div');
    if(!seenNotifIds.has(item.id)) {
      const badge=document.createElement('span');
      badge.textContent='New '; badge.className='text-red-600 text-xs font-semibold mr-1';
      wrap.appendChild(badge);
    }
    const txt=document.createElement('span'); txt.textContent=`${iconFor(item.type)} ${item.text}`;
    wrap.appendChild(txt);
    li.appendChild(wrap);
    const tm=document.createElement('time'); tm.className='text-xs text-gray-500';
    tm.textContent=getRelativeTime(item.time); tm.title=item.time.toLocaleString();
    li.appendChild(tm);
    notifListEl.appendChild(li);
    seenNotifIds.add(item.id);
  });
  localStorage.setItem('seenNotifIds',JSON.stringify([...seenNotifIds]));
  notifCountEl.textContent=newCount; notifCountEl.classList.toggle('hidden',newCount===0);
  const bell=document.getElementById('bellIcon');
  bell.style.animation='bell-bounce .6s';
  bell.addEventListener('animationend',()=>bell.style.animation='',{once:true});
}
setInterval(pollNotifications,60000); pollNotifications();
notifBtn.onclick=()=>{
  const open=!notifDropdown.classList.toggle('hidden');
  notifBtn.setAttribute('aria-expanded',open);
  if(open){
    notifCountEl.classList.add('hidden');
    document.querySelectorAll('#notification-list .new-badge').forEach(e=>e.remove());
    localStorage.setItem('seenNotifIds',JSON.stringify([...seenNotifIds]));
  }
};
clearNotifsBtn.onclick=()=>{
  seenNotifIds.forEach(id=>seenNotifIds.add(id));
  localStorage.setItem('seenNotifIds',JSON.stringify([...seenNotifIds]));
  notifListEl.innerHTML=''; notifCountEl.classList.add('hidden');
};

// ── Updates panel ────────────────────────────────────────────────────────────
let allUpdates=[], displayCount=5, initialLoad=true;
async function pollUpdatesPanel(){
  try{
    const r=await fetch('data/updates.json');
    if(!r.ok) return;
    allUpdates=(await r.json()).map(u=>({text:u.text,time:u.time,link:u.link}));
    renderUpdatesPanel();
  }catch{}
}
function renderUpdatesPanel(){
  const fv=(updatesFilter?.value||mobileUpdatesFilter?.value||'').toLowerCase();
  const filtered=allUpdates.filter(u=>u.text.toLowerCase().includes(fv)).sort((a,b)=>new Date(b.time)-new Date(a.time));
  const toShow=filtered.slice(0,displayCount);
  const latest=toShow[0]?.time, isNew=latest&&latest!==getLastSeenUpdate();
  [updatesContainer,mobileUpdatesContainer].forEach(cn=>{
    cn.innerHTML='';
    if(!toShow.length){
      const li=document.createElement('li');
      li.textContent='No updates available.'; li.className='py-2 text-gray-500';
      cn.appendChild(li);
    } else {
      toShow.forEach((u,i)=>{
        const li=document.createElement('li');
        if(u.link){
          const a=document.createElement('a'); a.href=u.link; a.className='block py-2 hover:underline';
          if(i===0&&initialLoad){
            const b=document.createElement('span'); b.textContent='New '; b.className='text-red-600 text-xs font-semibold';
            a.appendChild(b); showUpdateBanner(u.text);
          }
          a.appendChild(document.createTextNode(`${u.time}: ${u.text}`));
          li.appendChild(a);
        } else {
          if(i===0&&initialLoad){
            const b=document.createElement('span'); b.textContent='New '; b.className='text-red-600 text-xs font-semibold';
            li.appendChild(b); showUpdateBanner(u.text);
          }
          li.appendChild(document.createTextNode(`${u.time}: ${u.text}`));
          li.className='py-2';
        }
        cn.appendChild(li);
      });
    }
  });
  if(isNew) setLastSeenUpdate(latest);
  initialLoad=false;
}
setInterval(pollUpdatesPanel,60000); pollUpdatesPanel();
updatesToggleBtn.onclick       = ()=>updatesFilterContainer.classList.toggle('hidden');
mobileUpdatesToggleBtn.onclick = ()=>mobileUpdatesFilterContainer.classList.toggle('hidden');
updatesFilter?.addEventListener('input',debounce(renderUpdatesPanel,200));
mobileUpdatesFilter?.addEventListener('input',debounce(renderUpdatesPanel,200));

// ── Fuzzy search ─────────────────────────────────────────────────────────────
let fuse;
async function buildSearchIndex(){
  const items = cardsData.map(c=>({name:c.title,content:c.description,slug:c.slug,isRoot:true}));
  for(const c of cardsData){
    if(c.slug==='reports') continue;
    try{
      const data=await fetchItems(c.slug), arr=Array.isArray(data)?data:Object.values(data).flat();
      arr.forEach(i=>items.push({name:i.name,content:i.content,slug:c.slug,isRoot:false}));
    }catch{}
  }
  fuse=new Fuse(items,{keys:['name','content'],includeMatches:true,threshold:0.4});
}
function renderSuggestions(results){
  searchSuggestions.innerHTML='';
  if(!results.length){
    searchSuggestions.innerHTML='<li class="px-4 py-2 text-gray-500">No results</li>';
  } else {
    results.forEach(r=>{
      let label=r.item.name;
      const m=r.matches.find(x=>x.key==='name');
      if(m){
        let h='', last=0;
        m.indices.forEach(([s,e])=>{
          h+=label.slice(last,s)+`<mark>${label.slice(s,e+1)}</mark>`;
          last=e+1;
        });
        h+=label.slice(last); label=h;
      }
      const li=document.createElement('li');
      li.role='option'; li.className='px-4 py-2 hover:bg-gray-100 cursor-pointer';
      li.innerHTML=label;
      li.onclick=()=>{
        (r.item.isRoot?showContent:openEmailOverlay)(r.item.slug||r.item.name,r.item.content,r.item.slug);
        searchSuggestions.classList.add('hidden');
        searchInput.setAttribute('aria-expanded','false');
      };
      searchSuggestions.appendChild(li);
    });
  }
}
searchInput.addEventListener('input',debounce(async e=>{
  const q=e.target.value.trim();
  if(!q) return searchSuggestions.classList.add('hidden');
  if(!fuse) await buildSearchIndex();
  renderSuggestions(fuse.search(q));
  searchSuggestions.classList.remove('hidden');
  searchInput.setAttribute('aria-expanded','true');
},250));
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&document.activeElement!==searchInput){
    e.preventDefault(); searchInput.focus();
  }
});

// ── Final DOMContentLoaded ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  renderRecentlyViewed(JSON.parse(localStorage.getItem('recentlyViewed')||'[]'));
  renderCards(); buildSearchIndex();
  // Change-log SSE subscription if needed...
});
