(function(){
  const $ = (sel, ctx=document)=>ctx.querySelector(sel);
  const $$ = (sel, ctx=document)=>Array.from(ctx.querySelectorAll(sel));

  // Mobile menu
  const toggle = $('#mobileMenuToggle');
  const nav = $('#mainNav');

  function closeNav(){
    if(nav) nav.classList.remove('open');
  }

  if(toggle && nav){
    // Toggle on button click
    toggle.addEventListener('click', (e)=>{
      e.stopPropagation();
      nav.classList.toggle('open');
    });

    // Close on nav link click
    $$('.nav-link', nav).forEach(link => {
      link.addEventListener('click', closeNav);
    });

    // Close on outside click
    document.addEventListener('click', (e)=>{
      if(nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)){
        closeNav();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' && nav.classList.contains('open')){
        closeNav();
      }
    });

    // Close on resize to desktop breakpoint
    window.addEventListener('resize', ()=>{
      if(window.innerWidth > 860 && nav.classList.contains('open')){
        closeNav();
      }
    });
  }

  // Back to top
  const back = $('#backToTop');
  if(back){
    window.addEventListener('scroll', ()=>{
      if(window.scrollY>500){ back.classList.add('show'); } else { back.classList.remove('show'); }
    });
    back.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
  }

  // Particle canvas (lightweight ambient)
  const canvas = $('#particleCanvas');
  if(canvas){
    const ctx = canvas.getContext('2d');
    function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    const dots = Array.from({length: 40}, ()=>({x:Math.random()*canvas.width, y:Math.random()*canvas.height, vx:(Math.random()-.5)*.2, vy:(Math.random()-.5)*.2}));
    function frame(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle="rgba(198,255,64,.18)";
      dots.forEach(d=>{
        d.x+=d.vx; d.y+=d.vy;
        if(d.x<0||d.x>canvas.width) d.vx*=-1;
        if(d.y<0||d.y>canvas.height) d.vy*=-1;
        ctx.beginPath(); ctx.arc(d.x,d.y,1.2,0,Math.PI*2); ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    frame();
  }

  // Order page logic
  const serviceSelect = $('#serviceSelect');
  const packageSection = $('#packageSection');
  const packageGrid = $('#packageGrid');
  const totalAmountEl = $('#totalAmount');
  const payBtn = $('#payButton');
  const intakeBtn = $('#submitIntakeButton');
  const intakeNotice = $('#intakeNotice');
  const notesArea = $('#projectNotes');

  const summaryService = $('#summaryService');
  const summaryPackage = $('#summaryPackage');
  const summaryAddons = $('#summaryAddons');

  const serviceError = $('#serviceError');
  const packageError = $('#packageError');

  const PRICES = {
    aiReel: {name:'AI Reel Edit', basic:25, standard:60, premium:140},
    socialEdit: {name:'Social Media Edit', basic:30, standard:70, premium:160},
    viralCaptions: {name:'Viral Captions', basic:20, standard:50, premium:110},
    podcastRepurpose: {name:'Podcast / YouTube Repurpose', basic:40, standard:95, premium:220},
    autoCaptions: {name:'Auto Captions', basic:15, standard:35, premium:75},
    smartCut: {name:'Video Trim / Smart Cut', basic:20, standard:50, premium:120},
    backgroundRemoval: {name:'Background Removal', basic:25, standard:60, premium:150},
    audioSync: {name:'Add Music / Audio Sync', basic:15, standard:40, premium:95}
  };

  let selectedService = '';
  let selectedPackage = '';
  let addons = new Map(); // id -> {name, price}

  // Preselect service from ?service=
  const params = new URLSearchParams(location.search);
  const incomingService = params.get('service');

  function formatUSD(n){ return `$${n.toFixed(2)}`; }

  function renderPackages(){
    packageGrid.innerHTML = '';
    if(!selectedService){ packageSection.style.display='none'; return; }
    const p = PRICES[selectedService];
    if(!p){ packageSection.style.display='none'; return; }
    const meta = [
      {key:'basic', title:'Basic', tag:'Essentials only', price:p.basic},
      {key:'standard', title:'Standard', tag:'Most popular', price:p.standard},
      {key:'premium', title:'Premium', tag:'Expert polish', price:p.premium},
    ];
    meta.forEach(m=>{
      const el = document.createElement('label');
      el.className = 'package-option';
      el.innerHTML = `<input type="radio" name="sff-package" value="${m.key}">
        <strong>${m.title}</strong> <span class="package-price">$${m.price}</span><div style="color:#9aa0a6;font-size:.85rem">${m.tag}</div>`;
      el.querySelector('input').addEventListener('change', ()=>{
        selectedPackage = m.key;
        packageError && (packageError.style.display='none');
        recalc();
      });
      packageGrid.appendChild(el);
    });
    packageSection.style.display = '';
  }

  function recalc(){
    let total = 0;
    const svc = PRICES[selectedService];
    if(svc && selectedPackage){
      total += svc[selectedPackage] || 0;
    }
    const addonNames = [];
    $$('.addon-checkbox input').forEach(cb=>{
      const id = cb.value;
      if(cb.checked){
        const price = parseFloat(cb.dataset.price||'0');
        const name = cb.dataset.name || id;
        addons.set(id, {name, price});
      }else{
        addons.delete(id);
      }
    });
    addons.forEach(a=> addonNames.push(`${a.name} (+$${a.price})`));
    addons.forEach(a=> total += a.price);

    summaryService && (summaryService.textContent = svc ? svc.name : '—');
    if(svc && selectedPackage){
      const label = selectedPackage==='basic'?'Basic':selectedPackage==='standard'?'Standard':'Premium';
      summaryPackage && (summaryPackage.textContent = `${label} ($${svc[selectedPackage]})`);
    } else {
      summaryPackage && (summaryPackage.textContent = '—');
    }
    summaryAddons && (summaryAddons.textContent = addonNames.length? addonNames.join('; ') : 'None');
    totalAmountEl && (totalAmountEl.textContent = formatUSD(total));

    const ready = Boolean(svc && selectedPackage);
    if(payBtn) payBtn.disabled = !ready || total<=0;
    // intake lock/unlock is handled by paypal-config.js via sessionStorage
    // don't override it here, just set initial disabled state
    if(intakeBtn && !sessionStorage.getItem('sff_payment_confirmed')){
      intakeBtn.disabled = true;
    }
  }

  if(serviceSelect){
    serviceSelect.addEventListener('change', ()=>{
      selectedService = serviceSelect.value;
      if(!selectedService){ serviceError && (serviceError.style.display='block'); }
      else { serviceError && (serviceError.style.display='none'); }
      selectedPackage='';
      renderPackages();
      recalc();
    });
    if(incomingService && PRICES[incomingService]){
      serviceSelect.value = incomingService;
      selectedService = incomingService;
      renderPackages();
    }
  }

  // Add-on changes recalc
  $$('.addon-checkbox input').forEach(cb=> cb.addEventListener('change', recalc));

  // Pay button is handled by paypal-config.js (PayPal Buttons SDK)

  // Intake mailto - handled by paypal-config.js to include Order ID from sessionStorage

  // Notes hint
  if(notesArea){
    notesArea.placeholder = "Optional quick notes (links, style refs, timing cues). These notes will be included in your intake email after payment.";
  }

  // Initial calc
  recalc();
})();
