/* ---------------------------------------------------
   SNZ PLATFORM - CORE ENGINE (app.js) - ULTIMATE
   Identity: The Architect
--------------------------------------------------- */

const isLocalFile = window.location.protocol === 'file:' || window.location.protocol === 'content:';
let userEmail = localStorage.getItem('currentUserEmail');
let userBalance = 0;
let loaderInterval;

window.addEventListener('load', () => { initApp(); });

async function initApp() {
    // 1. فحص حالة الصيانة كأول خطوة وأولوية قصوى
    await checkGlobalMaintenance();

    if (!userEmail || userEmail === "") {
        if (isLocalFile) userEmail = "architect@local.dev"; 
        else { window.location.replace('index.html'); return; }
    }

    startLoaderTexts();

    const emergencyTimeout = setTimeout(() => {
        hideLoader(); startProfitFeed(); initBinanceSocket();
    }, 3000);

    try {
        const isDataLoaded = await loadUserData();
        if (isDataLoaded) {
            clearTimeout(emergencyTimeout);
            hideLoader(); startProfitFeed(); initBinanceSocket();
        }
    } catch (error) {
        if (document.getElementById('loaderText')) document.getElementById('loaderText').innerText = "TIMEOUT... USING CACHE";
    }
}

function startLoaderTexts() {
    const texts = ["ESTABLISHING SECURE CONNECTION...", "VERIFYING CREDENTIALS...", "SYNCING DATABASE..."];
    const textEl = document.getElementById('loaderText');
    let i = 0;
    if (textEl) loaderInterval = setInterval(() => { i = (i + 1) % texts.length; textEl.innerText = texts[i]; }, 800);
}

function hideLoader() {
    if (loaderInterval) clearInterval(loaderInterval);
    const loader = document.getElementById('ultimateLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; document.body.style.overflow = 'auto'; }, 500);
    }
}

async function loadUserData() {
    if (userEmail === "architect@local.dev") {
        updateDashboardUI("The_Architect", "Dev_Mode", "SNZ-ADMIN", 999.50);
        return true;
    }
    
    if (typeof _supabase === 'undefined') {
        updateDashboardUI(userEmail.split('@')[0], "OFFLINE", "ERROR", 0); return false;
    }

    try {
        const { data, error } = await _supabase.from('users').select('balance, plan, uid').eq('email', userEmail).single();
        if (error) throw error;
        if (data) {
            let currentUID = data.uid || generateUID();
            if(!data.uid) _supabase.from('users').update({ uid: currentUID }).eq('email', userEmail);
            userBalance = parseFloat(data.balance) || 0;
            updateDashboardUI(userEmail.split('@')[0], data.plan || 'Free', currentUID, userBalance);
            loadChatHistory();
            return true;
        }
        return false;
    } catch (e) {
        updateDashboardUI(userEmail.split('@')[0], "OFFLINE", "N/A", 0); return false;
    }
}

function updateDashboardUI(username, plan, uid, balance) {
    if (document.getElementById('displayEmail')) document.getElementById('displayEmail').innerText = username.substring(0, 10);
    if (document.getElementById('displayPlan')) document.getElementById('displayPlan').innerText = `PLAN: ${plan}`;
    if (document.getElementById('displayUID')) document.getElementById('displayUID').innerText = uid;
    
    const investRange = document.getElementById('investRange');
    if (investRange) {
        investRange.max = balance > 0 ? balance : 1;
        investRange.value = balance > 0 ? Math.min(10, balance) : 0;
        updateInvestUI();
    }
    animateNumber('userBalance', balance);
}

function generateUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'SNZ-';
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function animateNumber(elementId, finalValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    let start = parseFloat(element.innerText) || 0;
    const duration = 1500, startTime = performance.now();
    function update(currentTime) {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        element.innerText = (start + (finalValue - start) * (1 - Math.pow(1 - progress, 4))).toFixed(2);
        if (progress < 1) requestAnimationFrame(update); else element.innerText = parseFloat(finalValue).toFixed(2);
    }
    if (finalValue > 0) requestAnimationFrame(update); else element.innerText = "0.00";
}

function updateInvestUI() {
    const val = document.getElementById('investRange') ? document.getElementById('investRange').value : 0;
    if (document.getElementById('investValue')) document.getElementById('investValue').innerText = val;
    if (document.getElementById('expectedProfit')) document.getElementById('expectedProfit').innerText = `+$${(val * 2).toFixed(2)}`;
}

function showInvestmentSlider() {
    const zone = document.getElementById('investmentZone'), code = document.getElementById('signalCode');
    if (zone && code) code.value.length >= 3 ? zone.classList.remove('hidden') : zone.classList.add('hidden');
}

async function executeSignal(event) {
    if (event) event.preventDefault(); 
    const code = document.getElementById('signalCode')?.value.trim().toUpperCase();
    const invest = parseFloat(document.getElementById('investRange')?.value || 0);
    
    if (!code || userEmail === "architect@local.dev") return alert("كود غير متاح في وضع المعاينة");
    if (invest > userBalance || userBalance <= 0) return alert("الرصيد غير كافٍ للاستثمار");

    if(document.getElementById('signalStep1')) document.getElementById('signalStep1').classList.add('hidden');
    if(document.getElementById('investmentZone')) document.getElementById('investmentZone').classList.add('hidden');
    if(document.getElementById('tradeUI')) document.getElementById('tradeUI').classList.remove('hidden');
    
    let time = 60; 
    const interval = setInterval(() => {
        time--;
        if(document.getElementById('tradeTimer')) document.getElementById('tradeTimer').innerText = `00:${time < 10 ? '0'+time : time}`;
        if(document.getElementById('tradeProgress')) document.getElementById('tradeProgress').style.width = `${((60-time)/60)*100}%`;
        if (time <= 0) { clearInterval(interval); finalizeTrade(code, invest); }
    }, 1000);
}

async function finalizeTrade(code, invest) {
    if (typeof _supabase === 'undefined') { alert("خطأ في الاتصال"); return resetTradeUI(); }
    try {
        const { error } = await _supabase.rpc('claim_signal_profit', { s_code: code, u_email: userEmail, u_invest: invest });
        error ? alert("الكود غير صالح أو منتهي") : alert("تم إضافة الأرباح بنجاح!");
    } catch (e) { alert("حدث خطأ في السيرفر."); } 
    finally { resetTradeUI(); }
}

function resetTradeUI() {
    if(document.getElementById('tradeUI')) document.getElementById('tradeUI').classList.add('hidden');
    if(document.getElementById('investmentZone')) document.getElementById('investmentZone').classList.add('hidden');
    if(document.getElementById('signalStep1')) document.getElementById('signalStep1').classList.remove('hidden');
    if(document.getElementById('signalCode')) document.getElementById('signalCode').value = '';
    loadUserData(); // تحديث صامت للرصيد
}

function toggleChat() {
    const win = document.getElementById('chatWindow'), badge = document.getElementById('chatBadge');
    if (!win) return;
    if (win.classList.contains('hidden')) {
        win.classList.remove('hidden'); if(badge) badge.classList.add('hidden');
        setTimeout(() => { win.classList.remove('opacity-0', 'translate-y-10'); scrollToBottom(); }, 10);
    } else {
        win.classList.add('opacity-0', 'translate-y-10'); setTimeout(() => win.classList.add('hidden'), 400);
    }
}

function scrollToBottom() { const body = document.getElementById('chatBody'); if (body) body.scrollTop = body.scrollHeight; }

function renderMessage(text, sender) {
    const body = document.getElementById('chatBody'); if (!body) return;
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'chat-bubble-user p-3 rounded-2xl max-w-[85%] self-end text-[10px] text-white shadow-md' : 'chat-bubble-admin p-3 rounded-2xl max-w-[85%] self-start text-[10px] text-gray-200 shadow-md';
    div.innerText = text; body.appendChild(div); scrollToBottom();
}

async function sendChatMessage(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('chatInput'); if (!input) return;
    const text = input.value.trim(); if (!text || userEmail === "architect@local.dev") return;
    renderMessage(text, 'user'); input.value = '';
    if (typeof _supabase !== 'undefined') { try { await _supabase.from('support_chats').insert([{ user_email: userEmail, message: text, sender: 'user' }]); } catch (e) {} }
}

async function loadChatHistory() {
    if (userEmail === "architect@local.dev" || typeof _supabase === 'undefined') return;
    try {
        const { data } = await _supabase.from('support_chats').select('*').eq('user_email', userEmail).order('created_at', { ascending: true });
        const body = document.getElementById('chatBody');
        if (body && data) {
            body.innerHTML = `<div class="chat-bubble-admin p-3 rounded-2xl max-w-[85%] self-start text-[10px] text-gray-200">أهلاً بك في منصة SNZ. كيف نساعدك؟</div>`;
            data.forEach(msg => renderMessage(msg.message, msg.sender));
        }
        _supabase.channel('support_channel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats', filter: `user_email=eq.${userEmail}` }, p => {
            if (p.new.sender === 'admin') { renderMessage(p.new.message, 'admin'); const win = document.getElementById('chatWindow'), badge = document.getElementById('chatBadge'); if (win && win.classList.contains('hidden') && badge) badge.classList.remove('hidden'); }
        }).subscribe();
    } catch (e) {}
}

function startProfitFeed() {
    const feed = document.getElementById('profitFeedContainer'); if (!feed) return;
    setInterval(() => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-white/5 p-2 rounded-lg mb-2 transform transition-all duration-500 translate-y-[-100%] opacity-0';
        item.innerHTML = `<div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-green-400"></span><span class="text-gray-300 text-[10px] font-mono">User_${Math.floor(Math.random() * 9000) + 1000}**</span></div><span class="text-green-400 font-bold text-[11px]">+$${(Math.random() * 150 + 15).toFixed(2)}</span><span class="text-[8px] text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase tracking-tighter">GOLD</span>`;
        feed.prepend(item);
        requestAnimationFrame(() => { item.classList.remove('translate-y-[-100%]', 'opacity-0'); item.classList.add('translate-y-0', 'opacity-100'); });
        if (feed.children.length > 4) feed.lastElementChild.remove();
    }, 4500);
}

function initBinanceSocket() {
    try {
        const bSocket = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");
        bSocket.onmessage = (e) => {
            const d = JSON.parse(e.data), pEl = document.getElementById('marketPrice'), cEl = document.getElementById('priceChange');
            if (pEl && cEl) { pEl.innerText = parseFloat(d.c).toFixed(2); cEl.innerText = parseFloat(d.P).toFixed(2) + '%'; pEl.className = `text-2xl font-black font-mono transition-colors ${parseFloat(d.P) >= 0 ? 'text-green-400' : 'text-red-400'}`; cEl.style.color = parseFloat(d.P) >= 0 ? '#4ade80' : '#f87171'; }
        };
    } catch(err) {}
}

function navigateToTeam() { setTimeout(() => { window.location.href = 'team.html'; }, 150); }
function logout() { localStorage.removeItem('currentUserEmail'); window.location.replace('index.html'); }

// ==========================================
// SYSTEM MAINTENANCE CHECK 
// ==========================================
async function checkGlobalMaintenance() {
    if (typeof _supabase === 'undefined' || userEmail === "architect@local.dev") return;
    
    try {
        const { data, error } = await _supabase.from('settings').select('is_maintenance').single();
        if (error) return; 

        const currentPage = window.location.pathname.split('/').pop();
        
        // إذا الصيانة مفعلة، والمستخدم ليس في صفحة الصيانة -> اطرده لصفحة الصيانة
        if (data && data.is_maintenance === true && currentPage !== 'maintenance.html') {
            window.location.replace('maintenance.html');
        } 
    } catch(e) {
        console.error("System Check Failed");
    }
}
