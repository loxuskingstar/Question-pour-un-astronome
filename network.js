// network.js
let peer = null;
let connections = {}; 
let roomCode = "";
let isBuzzerActive = false;
let currentBuzzerWinner = null;

function initNetwork() {
    // Génère un code à 5 chiffres
    roomCode = Math.floor(10000 + Math.random() * 90000).toString();
    
    // Initialise le serveur PeerJS avec un préfixe unique
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

function handleNetworkData(conn, data) {
    if (data.type === 'join') {
        const teamName = data.teamName.trim();
        connections[teamName] = conn;
        addTeam(teamName); 
        conn.send({ type: 'joined', success: true });
    } 
    else if (data.type === 'buzz') {
        // Envoie le buzz dans la nouvelle fonction de gestion de file d'attente
        handleIncomingBuzz(data.teamName);
    }
}

function openBuzzers() {
    isQuestionActive = true;
    currentBuzzedTeam = null; // ➔ On s'assure que la place est libre !
    buzzQueue = []; // ➔ On vide la file d'attente par sécurité
    
    // Débloque uniquement les équipes qui n'ont pas fait d'erreur sur cette question
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
        // PHASE 2 : Un seul buzz pris à la fois (pas de file d'attente)
        if (!currentBuzzedTeam) {
            triggerBuzzPopup(teamName);
        }
    } else {
        // PHASES 1 & 3 : File d'attente
        if (!buzzQueue.includes(teamName)) {
            buzzQueue.push(teamName);
            // S'il n'y a personne en train de répondre, on affiche direct la popup
            if (!currentBuzzedTeam) {
                processNextInQueue();
            }
        }
    }
}

function processNextInQueue() {
    if (buzzQueue.length > 0) {
        let nextTeam = buzzQueue.shift(); // Récupère le premier de la file
        triggerBuzzPopup(nextTeam);
    }
}

function triggerBuzzPopup(teamName) {
    currentBuzzedTeam = teamName;
    document.getElementById('buzz-team-name').innerText = getTeam(teamName).emoji + ' ' + teamName;
    document.getElementById('buzz-popup').style.display = 'flex';
    
    // On cache le bouton "Révéler la réponse" pendant la décision
    const btnReveal = document.getElementById('btn-reveal');
    if (btnReveal) btnReveal.style.display = 'none';
    
    // Verrouille immédiatement tous les téléphones pour écouter la réponse
    Object.values(connections).forEach(c => {
        c.send({ type: 'lock', winner: teamName });
    });
    
    // AJOUT : Si on est en Phase 3, on stoppe net l'animation de la touche Espace
    if (typeof currentPhase !== 'undefined' && currentPhase === 'p3_q') {
        if (typeof p3RevealInterval !== 'undefined' && p3RevealInterval) {
            clearInterval(p3RevealInterval);
            p3RevealInterval = null;
        }
    }
}

// Réinitialise les blocages pour la question suivante
function resetBuzzerBlocks() {
    teams.forEach(t => t.blocked = false);
}