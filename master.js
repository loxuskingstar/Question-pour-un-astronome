let peer=null, conn=null, canSkip=false, p3PointerDown=false, transitionAction=null;

const ICE_CONFIG = {
    iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "turn:global.relay.metered.ca:80", username: "0907d928b54ca2829536d9ed", credential: "wDpB1hBTmZb58rhk" },
        { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "0907d928b54ca2829536d9ed", credential: "wDpB1hBTmZb58rhk" },
        { urls: "turn:global.relay.metered.ca:443", username: "0907d928b54ca2829536d9ed", credential: "wDpB1hBTmZb58rhk" },
        { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "0907d928b54ca2829536d9ed", credential: "wDpB1hBTmZb58rhk" }
    ]
};

function joinMaster(){
    const code=document.getElementById('code-input').value.trim();
    if(!code) return;
    document.getElementById('status-msg').innerText="Connexion en cours...";
    
    peer = new Peer({
        secure: true,
        config: ICE_CONFIG
    });

    peer.on('error', () => document.getElementById('status-msg').innerText = "Impossible de se connecter.");
    peer.on('open', () => {
        conn = peer.connect('astro-'+code);
        conn.on('open', () => conn.send({type:'join_master'}));
        
        conn.on('data', (data) => {
            if(data.type==='master_joined'){
                document.getElementById('login-screen').style.display='none';
                document.getElementById('master-screen').style.display='flex';
            }else if(data.type==='sync') updateMasterUI(data);
        });
        
        conn.on('close', () => { document.getElementById('conn-status').style.color = "var(--danger)"; });
    });
}

function sendCmd(action, isCorrect=null){
    if(conn && conn.open) {
        if(navigator.vibrate) navigator.vibrate(40);
        conn.send({type:'master_cmd', action, isCorrect});
    }
}

function sendScoreCmd(teamName, delta) {
    if(conn && conn.open) {
        if(navigator.vibrate) navigator.vibrate(30);
        conn.send({type:'master_cmd', action:'updateScore', teamName: teamName, delta: delta});
    }
}

function requestSkip(){
    if(!canSkip) return;
    canSkip=false; updateSkipButton(); sendCmd('skip');
}

function updateSkipButton(){
    const btn=document.getElementById('btn-skip'), note=document.getElementById('skip-note');
    btn.disabled=!canSkip; note.innerText = canSkip ? "Passez à la suite." : "Révélez d'abord la réponse.";
}

function requestTransition(){
    if(!transitionAction) return;
    const action=transitionAction; transitionAction=null;
    document.getElementById('btn-phase-transition').disabled=true;
    sendCmd(action);
}

function updateMasterUI(data){
    const names={p1:'Qualifications', p2_q:'À la carte', p3_q:'Jeu décisif', p2_cat:'Choix du thème', pre_podium:'Fin de partie', podium:'Classement Final'};
    document.getElementById('ui-phase').innerText=names[data.phase]||'Accueil';
    document.getElementById('ui-question').innerHTML=data.question||'En attente...';
    document.getElementById('ui-answer').innerHTML=data.answer||'••••••••';

    const descBox=document.getElementById('ui-answer-description');
    const descText=document.getElementById('ui-answer-description-text');
    if(data.answerDescription){
        descText.innerHTML=data.answerDescription; descBox.style.display='block';
    } else {
        descBox.style.display='none'; descText.innerHTML='';
    }

    // Rafraîchir la liste des scores dans la pop-up
    if(data.teamsList) {
        const sList = document.getElementById('score-list');
        sList.innerHTML = '';
        const sorted = [...data.teamsList].sort((a,b)=>b.score-a.score);
        sorted.forEach(t => {
            const row = document.createElement('div');
            row.className = 'score-row';
            row.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span class="score-name">${t.name}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span class="score-pts">${t.score}</span>
                    <div class="score-btns">
                        <button class="btn-tiny" style="background:var(--danger); color:#4a0000;" onclick="sendScoreCmd('${t.name}', -1)">-1</button>
                        <button class="btn-tiny" style="background:var(--success); color:#004d27;" onclick="sendScoreCmd('${t.name}', 1)">+1</button>
                    </div>
                </div>
            `;
            sList.appendChild(row);
        });
    }

    if(data.settings) {
        const ep1 = document.getElementById('master-cfg-p1');
        const ep2 = document.getElementById('master-cfg-p2');
        const ep3 = document.getElementById('master-cfg-p3');
        if (document.activeElement !== ep1) ep1.value = data.settings.p1;
        if (document.activeElement !== ep2) ep2.value = data.settings.p2;
        if (document.activeElement !== ep3) ep3.value = data.settings.p3;
    }

    const answerRevealed = data.answerRevealed===true || data.canSkip===true;
    canSkip = answerRevealed && ['p1','p2_q','p3_q'].includes(data.phase);

    ['ctrl-standard', 'phase-transition', 'ctrl-p2', 'ctrl-p2-cat', 'ctrl-p3', 'buzz-overlay'].forEach(id => { document.getElementById(id).style.display = 'none'; });
    document.getElementById('btn-reveal').style.display = answerRevealed ? 'none' : 'flex';

    transitionAction = data.transitionAction || null;

    if (data.buzzedTeam) {
        document.getElementById('buzz-overlay').style.display='flex';
        document.getElementById('buzz-team-title').innerText = data.buzzedTeam;
    } 
    else if (transitionAction) {
        document.getElementById('phase-transition').style.display='block';
        document.getElementById('phase-transition-title').innerText=data.transitionTitle||'Transition';
        const tb = document.getElementById('btn-phase-transition');
        tb.innerText=data.transitionLabel||'CONTINUER ➜'; tb.disabled=false;
    }
    else if (data.phase==='p2_cat' && data.p2Cats) {
        document.getElementById('ctrl-p2-cat').style.display='flex';
        document.getElementById('p2-cat-team-name').innerText = data.choosingTeamName || '';
        const grid = document.getElementById('p2-cat-grid');
        grid.innerHTML = '';
        data.p2Cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'btn ' + (cat.disabled ? 'btn-reveal' : 'btn-skip');
            btn.innerText = cat.name; btn.style.padding = "8px"; btn.style.fontSize = "0.95rem"; btn.style.minHeight = "55px";
            if (cat.disabled) btn.disabled = true;
            else btn.onclick = () => { if(conn && conn.open) conn.send({ type: 'master_cmd', action: 'selectCategory', category: cat.name, teamIndex: data.currentChoosingTeam }); };
            grid.appendChild(btn);
        });
    }
    else if (data.phase==='p2_q' && data.p2AwaitingAnswer) {
        document.getElementById('ctrl-p2').style.display='block';
        document.getElementById('p2-team-name').innerText=data.activeTeamName||'';
    }
    else if (data.phase==='p3_q') {
        document.getElementById('ctrl-p3').style.display='block';
        document.getElementById('ctrl-standard').style.display='block';
    }
    else { document.getElementById('ctrl-standard').style.display='block'; }

    updateSkipButton();
}

function sendSettings() {
    const p1 = document.getElementById('master-cfg-p1').value;
    const p2 = document.getElementById('master-cfg-p2').value;
    const p3 = document.getElementById('master-cfg-p3').value;
    if (conn && conn.open) {
        conn.send({type: 'master_cmd', action: 'updateSettings', p1: p1, p2: p2, p3: p3});
    }
}

const btnP3 = document.getElementById('btn-p3-anim');
btnP3.addEventListener('pointerdown', (e) => { e.preventDefault(); if(p3PointerDown) return; p3PointerDown=true; if(btnP3.setPointerCapture) btnP3.setPointerCapture(e.pointerId); sendCmd('p3_down'); });
const stopP3 = (e) => { if(!p3PointerDown) return; e.preventDefault(); p3PointerDown=false; sendCmd('p3_up'); };
btnP3.addEventListener('pointerup', stopP3); btnP3.addEventListener('pointercancel', stopP3);
btnP3.addEventListener('lostpointercapture', () => { if(p3PointerDown){ p3PointerDown=false; sendCmd('p3_up'); } });