// network.js
let peer = null;
let connections = {}; 
let roomCode = "";
let isBuzzerActive = false;
let currentBuzzerWinner = null;

function initNetwork() {
    roomCode = Math.floor(10000 + Math.random() * 90000).toString();
    peer = new Peer('astro-' + roomCode);

    peer.on('open', (id) => {
        console.log('Salon créé. Code :', roomCode);
        const codeDisplay = document.getElementById('room-code-display');
        if (codeDisplay) codeDisplay.innerText = roomCode;
    });

    peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            handleNetworkData(conn, data);
        });
    });
}

let masterConn = null;

function handleNetworkData(conn, data) {
    if (data.type === 'join') {
        const teamName = data.teamName.trim();
        const isReconnecting = teams.some(t => t.name === teamName);
        
        // On écrase l'ancienne connexion par la nouvelle
        connections[teamName] = conn; 
        
        if (!isReconnecting) {
            addTeam(teamName); 
        }
        conn.send({ type: 'joined', success: true });
        
        // RECONNEXION AUTOMATIQUE : On renvoie l'état exact du jeu à l'écran
        setTimeout(() => {
            if (currentPhase !== '') {
                const teamData = getTeam(teamName);
                if (teamData.blocked) {
                    conn.send({ type: 'lock', winner: 'Bloqué' });
                } else if (currentBuzzedTeam === teamName) {
                    conn.send({ type: 'lock', winner: teamName });
                } else if (currentPhase === 'p2_q' && !isQuestionActive && activeTeamIndex !== -1 && teams[activeTeamIndex].name === teamName && !currentBuzzedTeam) {
                    conn.send({ type: 'lock', winner: teamName }); // Écran jaune Phase 2
                } else if (!isQuestionActive) {
                    conn.send({ type: 'lock', winner: 'Écoutez bien...' });
                } else {
                    conn.send({ type: 'unlock' });
                }
            }
        }, 500);
    } 
    else if (data.type === 'join_master') {
        masterConn = conn;
        conn.send({ type: 'master_joined' });
        if (typeof syncMaster === 'function') syncMaster();
    }
    else if (data.type === 'master_cmd') {
        if (typeof handleMasterCommand === 'function') handleMasterCommand(data);
    }
    else if (data.type === 'buzz') {
        handleIncomingBuzz(data.teamName);
    }
}

const originalTriggerBuzzPopup = triggerBuzzPopup;
triggerBuzzPopup = function(teamName) {
    originalTriggerBuzzPopup(teamName);
    if (typeof syncMaster === 'function') syncMaster();
};

function openBuzzers() {
    isQuestionActive = true;
    currentBuzzedTeam = null; 
    buzzQueue = []; 
    Object.keys(connections).forEach(teamName => {
        if (!getTeam(teamName).blocked) {
            connections[teamName].send({ type: 'unlock' });
        } else {
            connections[teamName].send({ type: 'lock', winner: 'Bloqué' });
        }
    });
}

let buzzQueue = [];
let isQuestionActive = false;
let currentBuzzedTeam = null;

function handleIncomingBuzz(teamName) {
    if (!isQuestionActive || getTeam(teamName).blocked) return;

    if (currentPhase === 'p2_q') {
        if (!currentBuzzedTeam) triggerBuzzPopup(teamName);
    } else {
        if (!buzzQueue.includes(teamName)) {
            buzzQueue.push(teamName);
            if (!currentBuzzedTeam) processNextInQueue();
        }
    }
}

function processNextInQueue() {
    if (buzzQueue.length > 0) {
        let nextTeam = buzzQueue.shift();
        triggerBuzzPopup(nextTeam);
    }
}

function triggerBuzzPopup(teamName) {
    currentBuzzedTeam = teamName;
    document.getElementById('buzz-team-name').innerText = getTeam(teamName).emoji + ' ' + teamName;
    document.getElementById('buzz-popup').style.display = 'flex';
    
    const btnReveal = document.getElementById('btn-reveal');
    if (btnReveal) btnReveal.style.display = 'none';
    
    Object.values(connections).forEach(c => {
        c.send({ type: 'lock', winner: teamName });
    });
    
    if (typeof currentPhase !== 'undefined' && currentPhase === 'p3_q') {
        if (typeof p3RevealInterval !== 'undefined' && p3RevealInterval) {
            clearInterval(p3RevealInterval);
            p3RevealInterval = null;
        }
    }
}

function resetBuzzerBlocks() {
    teams.forEach(t => t.blocked = false);
}