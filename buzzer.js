let peer = null;
let conn = null;
let myTeamName = "";

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam) {
        document.getElementById('code-input').value = codeParam;
        // On met directement le focus (le curseur) sur le nom d'équipe pour gagner du temps !
        document.getElementById('team-input').focus();
    }
};

function joinGame() {
    const code = document.getElementById('code-input').value.trim();
    myTeamName = document.getElementById('team-input').value.trim();
    if(!code || !myTeamName) return;

    const btn = document.getElementById('btn-connect');
    btn.innerText = "Connexion...";
    btn.style.opacity = "0.7";

    peer = new Peer({
        secure: true, 
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', () => {
        conn = peer.connect('astro-' + code);
        
        conn.on('open', () => {
            conn.send({ type: 'join', teamName: myTeamName });
        });

        conn.on('data', (data) => {
            if (data.type === 'joined') {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('buzzer-screen').style.display = 'flex';
            }
            else if (data.type === 'unlock') {
                const b = document.getElementById('big-buzzer');
                b.className = 'buzzer-ready';
                b.innerHTML = '<span class="icon">⚡</span><span>BUZZ</span>';
                document.getElementById('status-text').innerText = 'Prêt !';
                if(navigator.vibrate) navigator.vibrate([30, 50, 30]); // Double petite vibration
            }
            else if (data.type === 'lock') {
                const b = document.getElementById('big-buzzer');
                if(data.winner === myTeamName) {
                    document.getElementById('status-text').innerHTML = '<span class="status-highlight">C\'EST À VOUS !</span>';
                    b.className = 'buzzer-winner';
                    b.innerHTML = '<span class="icon">🎤</span><span>PARLEZ</span>';
                    if(navigator.vibrate) navigator.vibrate(200); // Longue vibration pour le gagnant
                } else {
                    document.getElementById('status-text').innerText = data.winner ? data.winner : 'Bloqué';
                    b.className = 'buzzer-locked';
                    b.innerHTML = '<span class="icon">🔒</span><span>BLOQUÉ</span>';
                }
            } else if (data.type === 'podium_result') {
                document.getElementById('buzzer-screen').style.display = 'none';
                const podScreen = document.getElementById('podium-screen');
                podScreen.style.display = 'flex';
                
                const rText = document.getElementById('podium-rank-text');
                const medal = document.getElementById('podium-medal');
                document.getElementById('podium-score-text').innerText = data.score + ' pts';
                
                document.body.className = ''; 
                
                if (data.rank === 1) {
                    document.body.classList.add('rank-1');
                    rText.innerText = '1er !'; medal.innerText = '🏆';
                } else if (data.rank === 2) {
                    document.body.classList.add('rank-2');
                    rText.innerText = '2ème'; medal.innerText = '🥈';
                } else if (data.rank === 3) {
                    document.body.classList.add('rank-3');
                    rText.innerText = '3ème'; medal.innerText = '🥉';
                } else {
                    rText.innerText = data.rank + 'ème'; medal.innerText = '👏';
                }
                if(navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 300]); // Célébration
            }
        });
        
        conn.on('error', () => {
            btn.innerText = "Erreur, réessayer";
            btn.style.opacity = "1";
            btn.style.background = "var(--danger)";
            btn.style.color = "white";
        });
    });
}

function triggerBuzz(e) {
    if (e) e.preventDefault(); 
    const btn = document.getElementById('big-buzzer');
    if (conn && conn.open && btn.classList.contains('buzzer-ready')) {
        // Rendu immédiat pour la sensation de vitesse avant même le retour réseau
        btn.className = 'buzzer-locked';
        btn.innerHTML = '<span class="icon">⌛</span><span>ENVOI...</span>';
        if(navigator.vibrate) navigator.vibrate(50);
        
        conn.send({ type: 'buzz', teamName: myTeamName });
    }
}

const btnBuzz = document.getElementById('big-buzzer');
btnBuzz.addEventListener('touchstart', triggerBuzz, { passive: false });
btnBuzz.addEventListener('mousedown', triggerBuzz);
