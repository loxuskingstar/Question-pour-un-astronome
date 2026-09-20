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
        // Le premier signal reçu bloque immédiatement les autres
        if (isBuzzerActive && !getTeam(data.teamName).blocked) {
            isBuzzerActive = false;
            currentBuzzerWinner = data.teamName;
            
            // Verrouille tous les autres téléphones
            Object.values(connections).forEach(c => {
                c.send({ type: 'lock', winner: currentBuzzerWinner });
            });
            
            // Déclenche l'affichage sur l'écran principal
            triggerBuzzUI(currentBuzzerWinner);
        }
    }
}

function openBuzzers() {
    isBuzzerActive = true;
    currentBuzzerWinner = null;
    
    // Débloque uniquement les équipes qui n'ont pas fait d'erreur sur cette question
    Object.keys(connections).forEach(teamName => {
        if (!getTeam(teamName).blocked) {
            connections[teamName].send({ type: 'unlock' });
        } else {
            connections[teamName].send({ type: 'lock', winner: 'Erreur - Bloqué pour cette question' });
        }
    });
}

let buzzQueue = [];
let isQuestionActive = false;
let currentBuzzedTeam = null;

// Quand un signal 'buzz' arrive d'un téléphone :
function handleIncomingBuzz(teamName) {
    if (!isQuestionActive || getTeam(teamName).blocked) return;

    if (currentPhase === 'p2_q') {
        // PHASE 2 : Mode "Vol"
        // Si c'est le moment de voler, seul le PREMIER buzz est pris.
        if (canSteal && !currentBuzzedTeam) {
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
    
    // Pour la Phase 3 : Met en pause l'animation des lettres
    if (currentPhase === 'p3_q') {
        pausePhase3Animation = true; 
    }
}

// Réinitialise les blocages pour la question suivante
function resetBuzzerBlocks() {
    teams.forEach(t => t.blocked = false);
}