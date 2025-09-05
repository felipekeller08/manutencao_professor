// home.js — salva chamados no Firestore; foto vai para Storage (se disponível) ou Base64 no doc (fallback)
import {
  auth, onAuthStateChanged, signOut,
  db, addDoc, collection, serverTimestamp, onSnapshot, query, where,
  storage, ref, uploadString, getDownloadURL
} from './firebase.js';

/* =========================
   Helpers
========================= */
function fmtDate(ts){
  try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString(); }
  catch { return ''; }
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[m]);
}
function badgeClass(g){
  const s=(g||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(s==='baixa') return 'badge grav-baixa';
  if(s==='media') return 'badge grav-media';
  if(s==='alta')  return 'badge grav-alta';
  return 'badge grav-critica';
}
function withTimeout(promise, ms, label='operação'){
  return Promise.race([
    promise,
    new Promise((_, rej)=> setTimeout(()=> rej(new Error(`${label} demorou demais (${ms}ms)`)), ms))
  ]);
}

// Comprime um dataURL p/ JPEG com largura/altura máx. (padrão 1280) e qualidade (0.7)
function compressDataUrl(dataUrl, maxDim=600, quality=0.5){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      let { width, height } = img;
      if (width > maxDim || height > maxDim){
        const ratio = Math.min(maxDim/width, maxDim/height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL('image/jpeg', quality);
      resolve(out);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/* =========================
   Auth
========================= */
let currentUser = null;
onAuthStateChanged(auth, (u) => {
  if (!u) { location.href = 'index.html'; return; }
  currentUser = u;
  initTicketsListener();
});

document.getElementById('btnSair')?.addEventListener('click', async (ev)=>{
  ev?.preventDefault?.();
  try { await signOut(auth); } catch {}
  location.href = 'index.html';
});

/* =========================
   Foto (preview + compressão)
========================= */
let fotoBase64 = '';
const inputFoto      = document.getElementById('foto');
const preview        = document.getElementById('preview');
const previewImg     = preview?.querySelector('img');
const btnRemoverFoto = document.getElementById('btnRemoverFoto');

inputFoto?.addEventListener('change', async (e)=>{
  const f = e.target.files?.[0];
  if (!f){
    if(preview) preview.style.display = 'none';
    fotoBase64 = '';
    if (previewImg) previewImg.src = '';
    return;
  }
  const r = new FileReader();
  r.onload = async (ev)=>{
    try{
      const compressed = await compressDataUrl(ev.target.result, 900, 0.5);
      fotoBase64 = compressed;
      if (previewImg){
        previewImg.src = fotoBase64;
        if (preview) preview.style.display = 'block';
      }
    }catch(err){
      console.warn('Falha ao comprimir imagem:', err);
      fotoBase64 = ev.target.result; // fallback
      if (previewImg){
        previewImg.src = fotoBase64;
        if (preview) preview.style.display = 'block';
      }
    }
  };
  r.readAsDataURL(f);
});

// botão "Remover foto"
btnRemoverFoto?.addEventListener('click', ()=>{
  try { inputFoto.value = ''; } catch {}
  fotoBase64 = '';
  if (previewImg) previewImg.src = '';
  if (preview) preview.style.display = 'none';
});

/* =========================
   Registrar chamado
========================= */
const btnSalvar = document.getElementById('btnSalvar');

btnSalvar?.addEventListener('click', async (ev)=>{
  ev?.preventDefault?.();
  if(!currentUser) return;

  const setor     = document.getElementById('setor').value.trim();
  const sala      = document.getElementById('sala').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const gravidade = document.getElementById('gravidade').value.trim();

  if (!setor)     return alert('Escolha o setor.');
  if (!sala)      return alert('Informe a sala/local.');
  if (!descricao) return alert('Descreva o problema.');
  if (!gravidade) return alert('Selecione a gravidade.');

  const oldLabel = btnSalvar.textContent;
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Registrando...(aguarde)';

  try {
    let photoUrl = '';
    let photoBase64ToSave = '';

    if (fotoBase64 && fotoBase64.startsWith('data:')){
      // 1) tenta Storage
      try {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const storageRef = ref(storage, `tickets/${currentUser.uid}/${id}.jpg`);
        await withTimeout(uploadString(storageRef, fotoBase64, 'data_url'), 100, 'upload da imagem');
        photoUrl = await withTimeout(getDownloadURL(storageRef), 10000, 'obter URL da imagem');
      } catch (upErr) {
        console.warn('[Storage] indisponível/falhou — salvando Base64 no doc:', upErr);
        photoUrl = '';
        photoBase64ToSave = fotoBase64; // fallback
        const approxBytes = Math.ceil((photoBase64ToSave.length - 'data:image/jpeg;base64,'.length) * 3/4);
        if (approxBytes > 900 * 1024) {
          alert('A imagem está muito grande para salvar no documento (limite ~1MB). Tente uma foto menor.');
          photoBase64ToSave = '';
        }
      }
    }

    // 2) salva documento (inclui nome do solicitante)
    await withTimeout(
      addDoc(collection(db, 'tickets'), {
        userUid:          currentUser.uid,
        userEmail:        currentUser.email || '',
        userDisplayName:  currentUser.displayName || '',
        solicitante:      currentUser.displayName || '',
        setor, sala, descricao, gravidade,
        photoUrl,                          // quando Storage funcionar
        photoBase64: photoBase64ToSave,    // fallback sem Storage
        createdAt: serverTimestamp(),
        status: 'aberto'
      }),
      15000,
      'salvar chamado'
    );

    // 3) limpa formulário
    document.getElementById('sala').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('gravidade').value = '';
    try { document.getElementById('foto').value = ''; } catch {}
    fotoBase64 = '';
    if (previewImg) previewImg.src = '';
    if (preview) preview.style.display = 'none';

    alert('Chamado registrado!');
  } catch (err) {
    console.error('[Chamado] erro:', err);
    alert('Erro ao salvar chamado: ' + (err?.message || err));
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = oldLabel;
  }
});

/* =========================
   Listagem em tempo real
========================= */
function initTicketsListener(){
  const wrap = document.getElementById('lista');
  if(!wrap) return;

  const q = query(collection(db, 'tickets'), where('userUid','==', currentUser.uid));
  onSnapshot(q, (snap)=>{
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    list.sort((a,b)=> (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));

    wrap.innerHTML = list.map(t => `
      <div class="ticket-card">
        <div class="ticket-head">
          <strong>${t.id}</strong>
          <span class="${badgeClass(t.gravidade)}">${t.gravidade}</span>
        </div>
        <p><strong>Setor:</strong> ${escapeHtml(t.setor)}</p>
        <p><strong>Sala/Local:</strong> ${escapeHtml(t.sala)}</p>
        <p><strong>Descrição:</strong> ${escapeHtml(t.descricao)}</p>
        ${
          t.photoUrl
            ? `<img class="ticket-thumb" src="${t.photoUrl}" alt="Foto do problema">`
            : (t.photoBase64 ? `<img class="ticket-thumb" src="${t.photoBase64}" alt="Foto do problema">` : '')
        }
        <small>Abertura: ${fmtDate(t.createdAt)}</small>
      </div>
    `).join('');
  }, (err)=>{
    console.error('[Snapshot] erro:', err);
    alert('Erro ao listar chamados: ' + (err?.message || err));
  });
}

/* =========================
   Câmera (Opção B do CSS: usa classe .is-open)
========================= */
let camStream=null, camShot=null;

const camOverlay  = document.getElementById('camOverlay');
const camVideo    = document.getElementById('camVideo');
const camCanvas   = document.getElementById('camCanvas');
const btnCam      = document.getElementById('abrirCamera');
const btnCapturar = document.getElementById('btnCapturar');
const btnUsar     = document.getElementById('btnUsar');
const btnFechar   = document.getElementById('btnFechar');

// trava/destrava scroll do fundo enquanto o modal está aberto
function lockBodyScroll(){
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}
function unlockBodyScroll(){
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

function openCam(){
  camOverlay?.classList.add('is-open');
  camOverlay?.removeAttribute('hidden');
  // estado inicial do modal
  camCanvas?.classList.add('d-none');      // esconde preview (canvas)
  camVideo?.classList.remove('d-none');    // mostra vídeo
  btnUsar.disabled = true;                 // só libera depois da captura
  lockBodyScroll();
}
function closeCam(){
  stopCam();
  camOverlay?.classList.remove('is-open');
  camOverlay?.setAttribute('hidden','');
  // volta ao estado inicial
  camCanvas?.classList.add('d-none');
  camVideo?.classList.remove('d-none');
  unlockBodyScroll();
}
function stopCam(){
  try{ camStream?.getTracks().forEach(t=>t.stop()); }catch{}
  camStream = null;
}

btnCam?.addEventListener('click', async ()=>{
  try{
    openCam();
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:'environment' }, audio:false
    });
    camVideo.srcObject = camStream;
    camShot = null;
  }catch(e){
    closeCam();
    alert('Não foi possível abrir a câmera: ' + (e.message||e));
  }
});

btnCapturar?.addEventListener('click', ()=>{
  // desenha frame atual no canvas
  camCanvas.width  = camVideo.videoWidth  || 1280;
  camCanvas.height = camVideo.videoHeight || 720;
  camCanvas.getContext('2d').drawImage(camVideo,0,0,camCanvas.width,camCanvas.height);
  camShot = camCanvas.toDataURL('image/jpeg', 0.9); // base64 da captura

  // mostra preview (canvas) e esconde vídeo
  camCanvas.classList.remove('d-none');
  camVideo.classList.add('d-none');

  btnUsar.disabled = false;
  // garante que o topo do modal fique visível (evita corte no mobile)
  camOverlay?.scrollTo({ top: 0, behavior: 'smooth' });
});

btnUsar?.addEventListener('click', async ()=>{
  if(!camShot) return;
  // (opcional) comprimir a captura para reduzir tamanho
  try {
    fotoBase64 = await compressDataUrl(camShot, 1280, 0.8);
  } catch {
    fotoBase64 = camShot;
  }
  if(previewImg){ previewImg.src = fotoBase64; preview.style.display='block'; }
  closeCam();
});

btnFechar?.addEventListener('click', closeCam);
