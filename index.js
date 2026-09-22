let QUESTIONS;

window.onload = function() {
    if (!window.QUESTION_BANK) {
        document.getElementById('main-content').innerHTML = `
            <h1 style="color: var(--danger-color); text-shadow: none; font-size: 4rem;">Erreur de chargement</h1>
            <div class="glass-panel" style="padding: 40px; border-radius: 20px; text-align: center; max-width: 800px;">
                <p style="font-size: 1.8rem; margin-bottom: 20px;">Impossible de lire le fichier <strong>questions.js</strong> !</p>
                <p style="opacity: 0.8; font-size: 1.2rem; line-height: 1.6;">
                    Vérifie que :<br>
                    1. Le fichier <strong>questions.js</strong> est bien dans le même dossier que ce fichier HTML.<br>
                    2. Tu as bien <strong>sauvegardé</strong> les deux fichiers dans ton éditeur de code.<br>
                    3. Il n'y a pas d'erreur de ponctuation (virgule manquante, guillemet oublié) dans ton fichier de questions.
                </p>
            </div>
        `;
        return;
    }
    
    // On affiche l'accueil directement (QUESTIONS sera généré au clic sur "Lancer")
    showHome();
};

let currentPhase = ''; 
let isAnswerRevealed = false;
let pendingTransition = null; 
let currentQuestionIndex = 0;
let activeCategory = '';
let activeTeamIndex = -1;
let categoriesDone = [];

let phase2Order = []; 
let phase2Turn = 0;   

let p3RevealInterval = null;
let p3FullText = "";
let p3CurrentIndex = 0;

const mainContent = document.getElementById('main-content');
const scoreboard = document.getElementById('scoreboard');
const header = document.getElementById('main-header');

document.addEventListener('keydown', (e) => {
    // AJOUT : on vérifie que personne n'a la main (!currentBuzzedTeam)
    if (currentPhase === 'p3_q' && e.code === 'Space' && !currentBuzzedTeam) {
        e.preventDefault(); 
        if (!p3RevealInterval && p3CurrentIndex < p3FullText.length) {
            p3RevealInterval = setInterval(() => {
                if (p3CurrentIndex < p3FullText.length) {
                    const spanLetter = document.getElementById(`p3-l-${p3CurrentIndex}`);
                    if(spanLetter) spanLetter.classList.add('revealed');
                    p3CurrentIndex++;
                } else {
                    clearInterval(p3RevealInterval);
                    p3RevealInterval = null;
                }
            }, 60); // Vitesse apparition - Phase 3
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (currentPhase === 'p3_q' && e.code === 'Space') {
        e.preventDefault();
        if (p3RevealInterval) {
            clearInterval(p3RevealInterval);
            p3RevealInterval = null;
        }
    }
});

function updateScoreboard() {
    const oldPositions = {};
    Array.from(scoreboard.children).forEach(el => {
        const name = el.getAttribute('data-team');
        oldPositions[name] = el.getBoundingClientRect();
    });

    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    
    // Calculer les vrais rangs pour le Top 3
    let tempRank = 1;
    for(let i=0; i<sortedTeams.length; i++) {
        if(i > 0 && sortedTeams[i].score < sortedTeams[i-1].score) tempRank++;
        sortedTeams[i].tempRank = tempRank;
    }

    scoreboard.innerHTML = '';
    sortedTeams.forEach(team => {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'team-score glass-panel';
        teamDiv.setAttribute('data-team', team.name); 
        
        // Coloration dynamique sur toute la durée du jeu (dès qu'une équipe marque au moins 1 point)
        if (team.score > 0) {
            if (team.tempRank === 1) {
                teamDiv.style.border = '2px solid #ffd700'; teamDiv.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.4)';
            } else if (team.tempRank === 2) {
                teamDiv.style.border = '2px solid #e0e0e0'; teamDiv.style.boxShadow = '0 0 15px rgba(224, 224, 224, 0.4)';
            } else if (team.tempRank === 3) {
                teamDiv.style.border = '2px solid #cd7f32'; teamDiv.style.boxShadow = '0 0 15px rgba(205, 127, 50, 0.4)';
            }
        }

        teamDiv.innerHTML = `<span class="team-header-name" title="${team.name}">${team.emoji} ${team.name}</span> <span class="team-header-pts">${team.score} pts</span>`;
        scoreboard.appendChild(teamDiv);
    });

    Array.from(scoreboard.children).forEach(el => {
        const name = el.getAttribute('data-team');
        const oldRect = oldPositions[name];
        if (oldRect) {
            const newRect = el.getBoundingClientRect();
            const deltaX = oldRect.left - newRect.left;
            const deltaY = oldRect.top - newRect.top;

            if (deltaX !== 0 || deltaY !== 0) {
                el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                el.style.transition = 'none';

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        el.style.transform = '';
                        el.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        setTimeout(() => { el.style.transition = ''; }, 800);
                    });
                });
            }
        }
    });
}

function renderView(html) {
    mainContent.innerHTML = `<div class="animate-enter">${html}</div>`;
}

function showHome() {
    header.classList.add('header-hidden');
    pendingTransition = { action: 'startGame', title: 'Accueil', label: 'DÉMARRER LE JEU' }; // Signal télécommande
    renderView(`
        <div class="home-container">
            <img src="logo.png" alt="Questions pour un Astronome" class="home-logo">
            <button class="btn-accent glass-panel" style="font-size: 1.8rem; padding: 20px 60px; border-radius: 50px;" onclick="startGame()">Démarrer</button>
        </div>
    `);
}

function startGame() {
    header.classList.remove('header-hidden');
    showRules();
}

function exportResults() {
    let content = "=========================================\n";
    content += "  RÉSULTATS : QUESTIONS POUR UN ASTRONOME\n";
    content += "=========================================\n\n";

    content += "--- CLASSEMENT FINAL ---\n";
    
    let allRankedTeams = [...teams].sort((a, b) => b.score - a.score);
    let currentRank = 1;
    for(let i=0; i<allRankedTeams.length; i++) {
        if(i > 0 && allRankedTeams[i].score < allRankedTeams[i-1].score) {
            currentRank++; 
        }
        content += `${currentRank}. ${allRankedTeams[i].emoji} ${allRankedTeams[i].name} - ${allRankedTeams[i].score} pts\n`;
    }

    content += "\n=========================================\n";
    content += "  QUESTIONS & RÉPONSES DU JEU\n";
    content += "=========================================\n\n";

    content += "--- QUALIFICATIONS (Phase 1) ---\n";
    QUESTIONS.phase1.forEach((q, i) => {
        content += `Q${i+1} (${q.pts} pts): ${q.q}\nR: ${q.a}\n`;
        if(q.d) content += `> ${q.d}\n`;
        content += `\n`;
    });

    content += "--- A LA CARTE (Phase 2) ---\n";
    Object.keys(QUESTIONS.phase2).forEach(cat => {
        content += `\n[ Thème : ${cat} ]\n`;
        QUESTIONS.phase2[cat].forEach((q, i) => {
            content += `Q${i+1} (${q.pts} pts): ${q.q}\nR: ${q.a}\n`;
            if(q.d) content += `> ${q.d}\n`;
            content += `\n`;
        });
    });

    content += "--- LE JEU DECISIF (Phase 3) ---\n";
    QUESTIONS.phase3.forEach((q, i) => {
        content += `Q${i+1} (${q.pts} pts): ${q.q}\nR: ${q.a}\n`;
        if(q.d) content += `> ${q.d}\n`;
        content += `\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Resultats_Astronomie.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showRules() {
    pendingTransition = { action: 'showTeamSetup', title: 'Règles du jeu', label: 'CRÉER LES ÉQUIPES' };
    renderView(`
        <h1>Règles du jeu</h1>
        <div class="rules-grid">
            <div class="rule-card glass-panel">
                <h3>Qualifications</h3>
                <ul>
                    <li>Une quinzaine de questions diverses</li>
                    <li>Le classement déterminera l'ordre de passage pour la prochaine épreuve</li>
                </ul>
            </div>
            <div class="rule-card glass-panel">
                <h3>A la carte</h3>
                <ul>
                    <li>8 thèmes au choix</li>
                    <li>5 questions par thème</li>
                    <li>Le choix des thèmes se fait selon le classement (du 1er au dernier)</li>
                </ul>
            </div>
            <div class="rule-card glass-panel">
                <h3>Le jeu décisif</h3>
                <ul>
                    <li>5 Questions sous la forme "Que/qui suis-je"</li>
                    <li>Vous pouvez répondre avant la fin de la question</li>
                    <li>Une seule tentative par équipe avant la fin de la question</li>
                </ul>
            </div>
        </div>
        <!-- <button class="btn-accent" style="margin-top: 50px;" onclick="showBuzzer()">Suite</button> -->
        <button class="btn-accent" style="margin-top: 50px;" onclick="showTeamSetup()">Créer les équipes</button>
    `);
}

function showBuzzer() {
    renderView(`
        <h1>Comment jouer ?</h1>
        <div class="rule-card glass-panel" style="text-align: center; max-width: 600px; padding: 50px;">
            <h2 style="margin-bottom: 20px;">Préparez vos smartphones !</h2>
            <p style="font-size: 1.8rem; margin: 10px 0;">Allez sur <strong>buzzin.live</strong></p>
            <p style="font-size: 1.8rem; margin: 10px 0;">Code : <strong style="color: var(--accent-color); font-size: 3.5rem; display:block; margin-top:20px; font-family: 'Chau Philomene One', sans-serif;">557316</strong></p>
        </div>
        <button class="btn-accent" style="margin-top: 50px;" onclick="showTeamSetup()">Créer les équipes</button>
    `);
}

function showTeamSetup() {
    initNetwork(); 
    pendingTransition = { action: 'startPhase1', title: 'Équipes', label: 'LANCER LA PARTIE' };
    
    const btnSettings = document.getElementById('btn-settings-toggle');
    if (btnSettings) btnSettings.style.display = 'block';
    
    renderView(`
        <h1 style="margin-bottom: 40px;">INSCRIRE LES ÉQUIPES</h1>
        
        <div class="glass-panel" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 50px; padding: 40px 60px; border-radius: 30px; margin-bottom: 40px; border: 2px solid var(--accent-color); max-width: 900px;">
            
            <div id="qrcode-container" style="background: white; padding: 10px; border-radius: 15px; display: flex; box-shadow: 0 5px 15px rgba(0,0,0,0.3); width: 230px; height: 230px; justify-content: center; align-items: center;">
                <!-- Le script injectera le QR code ici -->
            </div>
            
            <div style="text-align: center;">
                <p style="font-size: 1.8rem; margin: 0 0 10px 0; color: #dcdcdc; font-weight: 300;">Scannez pour jouer ou entrez le code :</p>
                <h2 id="room-code-display" style="font-size: 8rem; color: var(--accent-color); margin: 0; font-family: 'Chau Philomene One', sans-serif; letter-spacing: 10px; line-height: 1; text-shadow: 0 0 25px rgba(247, 183, 49, 0.4);">...</h2>
            </div>
            
        </div>
        
        <div style="margin-bottom: 30px; display:flex; align-items:center;">
            <input type="text" id="teamName-input" placeholder="Ajout manuel (si besoin)" onkeypress="if(event.key==='Enter') { addTeam(this.value); this.value=''; }">
            <button class="btn-accent" onclick="addTeam(document.getElementById('teamName-input').value); document.getElementById('teamName-input').value='';">Ajouter</button>
        </div>
        
        <div id="team-list" style="font-size: 1.4rem; font-weight:300; margin-bottom: 40px; display:flex; gap:15px; flex-wrap:wrap; max-width: 900px; justify-content: center; min-height: 60px;"></div>
        
        <button class="btn-accent" style="font-size: 1.5rem; padding: 20px 50px;" onclick="startPhase1()">Lancer la partie</button>
    `);
    renderTeamList();

    // GÉNÉRATION DYNAMIQUE DU QR CODE
    setTimeout(() => {
        const qrContainer = document.getElementById("qrcode-container");
        if (qrContainer && roomCode) {
            qrContainer.innerHTML = ""; 
            
            let currentUrl = window.location.href.split('?')[0];
            if (currentUrl.endsWith('index.html')) currentUrl = currentUrl.replace('index.html', '');
            if (!currentUrl.endsWith('/')) currentUrl += '/';
            
            const buzzerUrl = currentUrl + "buzzer.html?code=" + roomCode;
            
            new QRCode(qrContainer, {
                text: buzzerUrl,
                width: 220, // ➔ CORRECTION : Agrandit le QR Code de 20px
                height: 220, // ➔ CORRECTION : Agrandit le QR Code de 20px
                colorDark : "#0b0914",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
            });
        }
    }, 150);
}
    
function renderTeamList() {
    const list = document.getElementById('team-list');
    if(list) list.innerHTML = teams.map(t => `<div class="team-score glass-panel" style="white-space: normal; word-break: break-word;">${t.emoji} ${t.name}</div>`).join('');
}

function revealAnswer() {
    isAnswerRevealed = true; 
    isQuestionActive = false; 
    
    document.getElementById('answer').classList.add('visible');
    const btnReveal = document.getElementById('btn-reveal');
    if (btnReveal) btnReveal.style.display = 'none';
    const btnSkip = document.getElementById('btn-skip-question');
    if (btnSkip) btnSkip.style.display = 'block';
    
    lockAllBuzzers(); // ➔ NOUVEAU : On verrouille immédiatement tous les téléphones
    syncMaster(); 
}

// Fonction qui sélectionne n questions intelligemment (1/3 de chaque difficulté)
function selectQuestions(bankArray, totalNeeded) {
    if (!bankArray || bankArray.length === 0) return [];
    
    // Sécurité : on ne peut pas demander plus de questions qu'il n'y en a dans la banque
    totalNeeded = Math.min(totalNeeded, bankArray.length);

    // On trie la banque par difficulté
    let diff1 = bankArray.filter(q => q.pts === 1);
    let diff2 = bankArray.filter(q => q.pts === 2);
    let diff3 = bankArray.filter(q => q.pts === 3);

    // Fonction pour mélanger un tableau
    const shuffle = (array) => array.sort(() => Math.random() - 0.5);

    shuffle(diff1); shuffle(diff2); shuffle(diff3);

    // On calcule le minimum syndical par difficulté (ex: si on veut 5 questions, on veut min 1 de chaque)
    const minPerDiff = Math.floor(totalNeeded / 3);
    let selected = [];

    // On prend 1/3 de Faciles, 1/3 de Moyennes, 1/3 de Difficiles (dans la limite des stocks disponibles)
    selected.push(...diff1.splice(0, Math.min(minPerDiff, diff1.length)));
    selected.push(...diff2.splice(0, Math.min(minPerDiff, diff2.length)));
    selected.push(...diff3.splice(0, Math.min(minPerDiff, diff3.length)));

    // S'il manque des questions pour atteindre le total, on complète au hasard avec ce qui reste
    const remainingPool = shuffle([...diff1, ...diff2, ...diff3]);
    const needed = totalNeeded - selected.length;
    if (needed > 0) {
        selected.push(...remainingPool.splice(0, needed));
    }

    // On mélange la sélection finale pour ne pas que les difficultés soient toujours dans le même ordre !
    return shuffle(selected);
}

function buildGameQuestions() {
    // Récupération des paramètres (ou valeurs par défaut si bug)
    const p1Count = document.getElementById('cfg-p1') ? parseInt(document.getElementById('cfg-p1').value) : 15;
    const p2Count = document.getElementById('cfg-p2') ? parseInt(document.getElementById('cfg-p2').value) : 5;
    const p3Count = document.getElementById('cfg-p3') ? parseInt(document.getElementById('cfg-p3').value) : 5;

    // ➔ CORRECTION ICI : On utilise bien QUESTIONS (sans window.)
    QUESTIONS = {
        phase1: selectQuestions(window.QUESTION_BANK.phase1, p1Count),
        phase2: {},
        phase3: selectQuestions(window.QUESTION_BANK.phase3, p3Count)
    };

    // Boucle sur les catégories de la Phase 2
    Object.keys(window.QUESTION_BANK.phase2).forEach(cat => {
        QUESTIONS.phase2[cat] = selectQuestions(window.QUESTION_BANK.phase2[cat], p2Count);
    });
    
    console.log("Questions générées pour la partie :", QUESTIONS);
}

function startPhase1() {
    buildGameQuestions(); 
    
    // ➔ CORRECTION ICI : On vérifie que les éléments existent avant de les cacher pour éviter les plantages
    const btnSettings = document.getElementById('btn-settings-toggle');
    if (btnSettings) btnSettings.style.display = 'none';
    
    const popupSettings = document.getElementById('settings-popup');
    if (popupSettings) popupSettings.style.display = 'none';
    
    currentPhase = 'p1';
    currentQuestionIndex = 0;
    isAnswerRevealed = false;
    pendingTransition = null; 
    
    // Lancement effectif de la phase
    renderGeneralPhase("Qualifications", QUESTIONS.phase1, 'startPhase2Categories');
}

function renderGeneralPhase(phaseTitle, questionArray, nextPhaseName) {
    isAnswerRevealed = false;
    pendingTransition = null;
    if (currentQuestionIndex >= questionArray.length) {
        pendingTransition = { action: nextPhaseName, title: 'Manche terminée', label: 'PASSER À LA SUITE' };
        renderView(`
            <h1>Manche suivante<br><span style="color:var(--accent-color); font-size:4.5rem;">${phaseTitle}</span></h1>
            <button class="btn-accent" style="margin-top:40px; font-size:1.5rem; padding: 20px 50px;" onclick="${nextPhaseName}()">Passer à la suite</button>
        `);
        
        // ➔ CORRECTION : Verrouiller les buzzers pendant la transition
        isQuestionActive = false;
        lockAllBuzzers();
        return;
    }

    const q = questionArray[currentQuestionIndex];
    const descHtml = q.d ? `<div class="answer-desc">${q.d}</div>` : '';
    
    let html = `
        <h2>${phaseTitle} <span style="opacity:0.5; font-size:1.2rem; font-family:'Josefin Sans'; margin-left:15px;">Question ${currentQuestionIndex + 1}/${questionArray.length} • <span style="color: var(--accent-color)">${q.pts} pt${q.pts > 1 ? 's' : ''}</span></span></h2>
        <div class="question-box glass-panel">
            <div>${q.q}</div>
            <div class="answer-box" id="answer">
                <div class="answer-main">${q.a}</div>
                ${descHtml}
            </div>
        </div>
        <div id="btn-reveal" class="btn-reveal-container">
            <button class="btn-accent" onclick="revealAnswer()">Révéler la réponse</button>
        </div>`;
        
    renderView(html);
    isQuestionActive = true;
    resetBuzzerBlocks();
    openBuzzers();
}

function handleGeneralAnswer(teamIndex, isCorrect, phaseTitle, event, points = 1) {
    if (isCorrect && event && teamIndex !== -1) {
        const btn = event.currentTarget;
        btn.classList.add('correct-flash');
        setTimeout(() => {
            addPoints(teamIndex, points);
            currentQuestionIndex++;
            renderGeneralPhase("Qualifications", QUESTIONS.phase1, 'startPhase2Categories');
        }, 400);
    } else {
        currentQuestionIndex++;
        renderGeneralPhase("Qualifications", QUESTIONS.phase1, 'startPhase2Categories');
    }
}

function startPhase2Categories() {
    currentPhase = 'p2_cat';
    isAnswerRevealed = false;
    pendingTransition = null; 
    
    if (phase2Order.length === 0 && teams.length > 0) {
        phase2Order = teams.map((t, i) => ({score: t.score, index: i}))
                            .sort((a, b) => b.score - a.score)
                            .map(t => t.index);
    }

    if (phase2Turn >= phase2Order.length) {
        pendingTransition = { action: 'startPhase3', title: 'À la carte terminé', label: 'PASSER AU JEU DÉCISIF' };
        renderView(`
            <h1>À la carte <span style="color:var(--accent-color)">terminé !</span></h1>
            <p style="font-size:1.8rem; color:#dcdcdc;">Chaque équipe a joué son thème.</p>
            <button class="btn-accent" style="margin-top: 50px; font-size:1.5rem; padding: 20px 50px;" onclick="startPhase3()">Passer au Jeu Décisif</button>
        `);
        
        // ➔ CORRECTION : Verrouiller à la fin de la phase 2
        isQuestionActive = false;
        lockAllBuzzers();
        return;
    }

    const currentTeamIndex = phase2Order[phase2Turn];
    const currentTeam = teams[currentTeamIndex];

    // ➔ CORRECTION : Verrouiller pendant que l'équipe réfléchit à son thème
    isQuestionActive = false;
    Object.values(connections).forEach(c => {
        c.send({ type: 'lock', winner: 'Choix du thème...' });
    });

    renderView(`
        <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height: 70vh;">
            <h2 style="margin-bottom: 20px; font-size: 2.5rem; opacity: 0.8;">C'est au tour de...</h2>
            <div class="team-announcement">${currentTeam.name}</div>
        </div>
    `);

    setTimeout(() => {
        let html = `
            <h1>À la carte</h1>
            <p style="font-size:1.8rem; margin-bottom:40px; color:var(--text-color);">
                À <strong style="color:var(--accent-color); font-size:2.4rem; font-family:'Chau Philomene One'; text-shadow: 0 0 15px rgba(247, 183, 49, 0.5); word-break: break-word; display: inline-block; max-width: 90vw; vertical-align: bottom;">${currentTeam.name}</strong> de choisir !
            </p>
            <div class="category-grid">
        `;

        Object.keys(QUESTIONS.phase2).forEach(cat => {
            const safeCat = cat.replace(/'/g, "\\'");
            const isDisabled = categoriesDone.includes(cat) ? 'disabled' : '';
            html += `<button class="category-btn glass-panel ${isDisabled}" ${isDisabled ? '' : `onclick="selectCategory('${safeCat}',${currentTeamIndex})"`}>${cat}</button>`;
        });

        html += `</div>`;
        renderView(html);
        syncMaster(); 
    }, 1200); 
}

function selectCategory(cat, teamIndex) {
    activeCategory = cat;
    activeTeamIndex = teamIndex;
    currentQuestionIndex = 0;
    renderPhase2Question(); 
}

function renderPhase2Question() {
    isAnswerRevealed = false;
    pendingTransition = null;
    currentPhase = 'p2_q';
    const questionArray = QUESTIONS.phase2[activeCategory];
    
    if (currentQuestionIndex >= questionArray.length) {
        categoriesDone.push(activeCategory);
        phase2Turn++; 
        pendingTransition = { action: 'startPhase2Categories', title: 'Thème terminé', label: 'CHOIX DU THÈME SUIVANT' };
        renderView(`<h1>Thème terminé !</h1>`);
        
        // ➔ CORRECTION : Verrouiller entre deux thèmes
        isQuestionActive = false;
        lockAllBuzzers();
        return;
    }

    // ... (Le reste de la fonction reste identique)
    const q = questionArray[currentQuestionIndex];
    const activeTeamName = teams[activeTeamIndex].name;
    const descHtml = q.d ? `<div class="answer-desc">${q.d}</div>` : '';
    
    let html = `
        <h2>${activeCategory} <span style="opacity:0.5; font-family:'Josefin Sans'; margin:0 15px;">|</span> Équipe : <span style="color: var(--accent-color); word-break: break-word;">${activeTeamName}</span></h2>
        <div class="question-box glass-panel">
            <div style="font-size:1.2rem; opacity:0.6; margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">Question ${currentQuestionIndex + 1}/${questionArray.length} • <span style="color: var(--accent-color)">${q.pts} pt${q.pts > 1 ? 's' : ''}</span></div>
            <div>${q.q}</div>
            <div class="answer-box" id="answer">
                <div class="answer-main">${q.a}</div>
                ${descHtml}
            </div>
        </div>
        <div id="btn-reveal" class="btn-reveal-container">
            <button class="btn-accent" onclick="revealAnswer()">Révéler la réponse</button>
        </div>
        <div id="active-team-controls" style="display:flex; justify-content:center; gap:20px; margin-top:20px;">
            <button class="btn-success glass-panel" style="font-size: 1.2rem; padding: 15px 30px;" onclick="handleActiveTeamAnswer(true)">✅ Bonne réponse</button>
            <button class="btn-danger glass-panel" style="font-size: 1.2rem; padding: 15px 30px;" onclick="handleActiveTeamAnswer(false)">❌ Mauvaise réponse (Ouvrir le vol)</button>
        </div>
    `;
    renderView(html);

    isQuestionActive = false; 
    resetBuzzerBlocks();
    
    Object.keys(connections).forEach(teamName => {
        if (teamName === activeTeamName) {
            connections[teamName].send({ type: 'lock', winner: activeTeamName });
        } else {
            connections[teamName].send({ type: 'lock', winner: 'Écoutez bien...' });
        }
    });
}

function handleActiveTeamAnswer(isCorrect) {
    // On cache les boutons de contrôle direct
    document.getElementById('active-team-controls').style.display = 'none';
    
    // On récupère le vrai NOM de l'équipe active
    let activeTeamName = teams[activeTeamIndex].name;
    
    if (isCorrect) {
        // 1. Ils ont bon : on donne les points (avec le NOM) et on passe à la suite
        addPoints(activeTeamName, getCurrentQuestionPoints());
        revealAnswer();
        lockAllBuzzers();
    } else {
        // 2. Ils ont faux : ON OUVRE LE VOL AUX AUTRES !
        getTeam(activeTeamName).blocked = true; // Bloque l'équipe active
        sendLockToPhone(activeTeamName);
        
        isQuestionActive = true; 
        currentBuzzedTeam = null;
        buzzQueue = [];
        openBuzzers(); // Débloque le bouton de toutes les autres équipes
    }
}

function handlePhase2Answer(isCorrect, event, points = 1) {
    if (isCorrect && event) {
        const btn = event.currentTarget;
        btn.classList.add('correct-flash');
        setTimeout(() => {
            addPoints(activeTeamIndex, points);
            currentQuestionIndex++;
            renderPhase2Question();
        }, 400);
    } else {
        currentQuestionIndex++;
        renderPhase2Question();
    }
}

function startPhase3() {
    currentPhase = 'p3_q';
    currentQuestionIndex = 0;
    isAnswerRevealed = false;
    pendingTransition = { action: 'renderPhase3Question', title: 'Le Jeu Décisif', label: 'COMMENCER L\'ÉPREUVE' }; 
    
    renderView(`
        <h1 style="font-size: 5rem; text-shadow: 0 0 30px rgba(247, 183, 49, 0.7); color: var(--accent-color);">Le Jeu Décisif</h1>
        <p style="font-size: 1.8rem; margin-bottom: 40px; opacity: 0.8;">C'est l'heure de l'ultime épreuve...</p>
        <button class="btn-accent" style="font-size: 1.5rem; padding: 20px 60px;" onclick="renderPhase3Question()">Commencer</button>
    `);
    
    // ➔ CORRECTION : Verrouiller avant le lancement de la 1ère question
    isQuestionActive = false;
    lockAllBuzzers();
}

function renderPhase3Question() {
    isAnswerRevealed = false;
    pendingTransition = null;
    currentPhase = 'p3_q';
    if (currentQuestionIndex >= QUESTIONS.phase3.length) {
        preparePodiumTransition(); // ➔ CORRECTION ICI : On lance le suspense
        return;
    }

    const q = QUESTIONS.phase3[currentQuestionIndex];
    const descHtml = q.d ? `<div class="answer-desc">${q.d}</div>` : '';
    
    p3FullText = q.q;
    p3CurrentIndex = 0;
    if(p3RevealInterval) {
        clearInterval(p3RevealInterval);
        p3RevealInterval = null;
    }
    
    let charSpans = '';
    let words = p3FullText.split(' ');
    let cIndex = 0;
    
    words.forEach((word, wIndex) => {
        charSpans += `<span style="display: inline-block; white-space: nowrap;">`;
        for (let i = 0; i < word.length; i++) {
            charSpans += `<span class="p3-letter" id="p3-l-${cIndex}">${word[i]}</span>`;
            cIndex++;
        }
        charSpans += `</span>`;
        
        if (wIndex < words.length - 1) {
            charSpans += `<span class="p3-letter" id="p3-l-${cIndex}"> </span>`;
            cIndex++;
        }
    });

    let html = `
        <h2>Le jeu décisif <span style="opacity:0.5; font-size:1.2rem; font-family:'Josefin Sans'; margin-left:15px;">Question ${currentQuestionIndex + 1}/${QUESTIONS.phase3.length} • <span style="color: var(--accent-color)">${q.pts} pt${q.pts > 1 ? 's' : ''}</span></span></h2>
        <div class="question-box glass-panel" style="padding-bottom: 30px;">
            <!-- <p style="font-size: 1.1rem; opacity: 0.5; margin-bottom: 25px; text-transform:uppercase; letter-spacing: 2px;">(Maintenez ESPACE pour dévoiler)</p> -->
            <div id="p3-question-text">
                ${charSpans}
            </div>
            <div class="answer-box" id="answer">
                <div class="answer-main">${q.a}</div>
                ${descHtml}
            </div>
        </div>
        <div id="btn-reveal" class="btn-reveal-container">
            <button class="btn-accent" onclick="revealAnswerPhase3()">Révéler la réponse</button>
        </div>`;
        
    renderView(html);
    // On débloque les buzzers pour la Phase 3
    isQuestionActive = true;
    resetBuzzerBlocks();
    openBuzzers();
}

// Écran de suspense avant le podium
function preparePodiumTransition() {
    currentPhase = 'pre_podium';
    isAnswerRevealed = false;
    pendingTransition = { action: 'showPodium', title: 'Fin de partie', label: 'RÉVÉLER LE PODIUM 🏆' };
    
    renderView(`
        <h1 style="font-size: 5rem; text-shadow: 0 0 30px rgba(247, 183, 49, 0.7); color: var(--accent-color);">Jeu terminé !</h1>
        <p style="font-size: 2.5rem; margin-bottom: 40px; opacity: 0.8;">Les résultats arrivent...</p>
    `);

    // On verrouille tous les buzzers avec un petit message
    Object.values(connections).forEach(c => {
        c.send({ type: 'lock', winner: 'Fin du jeu !' });
    });
}

function revealAnswerPhase3() {
    for(let i = p3CurrentIndex; i < p3FullText.length; i++) {
        const span = document.getElementById(`p3-l-${i}`);
        if(span) span.classList.add('revealed');
    }
    p3CurrentIndex = p3FullText.length;
    revealAnswer();
}

function handlePhase3Answer(teamIndex, isCorrect, event, points = 1) {
    if (isCorrect && event && teamIndex !== -1) {
        const btn = event.currentTarget;
        btn.classList.add('correct-flash');
        setTimeout(() => {
            addPoints(teamIndex, points);
            currentQuestionIndex++;
            renderPhase3Question();
        }, 400);
    } else {
        currentQuestionIndex++;
        renderPhase3Question();
    }
}

function showPodium() {
    isAnswerRevealed = false;
    pendingTransition = { action: 'exportResults', title: 'Fin de la partie', label: 'EXPORTER LES RÉSULTATS' };
    currentPhase = 'podium';
    
    let allRankedTeams = [...teams].sort((a, b) => b.score - a.score);
    let rank = 1;
    for(let i=0; i<allRankedTeams.length; i++) {
        if(i > 0 && allRankedTeams[i].score < allRankedTeams[i-1].score) {
            rank++; 
        }
        allRankedTeams[i].rank = rank;
    }

    let uniqueScores = [...new Set(teams.map(t => t.score))].sort((a, b) => b - a);
    Object.keys(connections).forEach(teamName => {
        let teamInfo = allRankedTeams.find(t => t.name === teamName);
        if (teamInfo) {
            connections[teamName].send({ type: 'podium_result', rank: teamInfo.rank, score: teamInfo.score });
        }
    });

    let podium1 = allRankedTeams.filter(t => t.score === uniqueScores[0]);
    let podium2 = uniqueScores.length > 1 ? allRankedTeams.filter(t => t.score === uniqueScores[1]) : [];
    let podium3 = uniqueScores.length > 2 ? allRankedTeams.filter(t => t.score === uniqueScores[2]) : [];

    const formatNames = (tms) => tms.map(t => `${t.emoji} ${t.name}`).join('<br>');

    let html = `<h1 style="margin-bottom: 10px;">Classement Final</h1>
                <div class="podium-container">`;

    if(podium2.length > 0) {
        let rank2 = podium2[0].rank;
        html += `
            <div class="podium-step p-2" id="pod-2">
                <span class="podium-rank">${rank2 === 1 ? '1er' : rank2 + 'ème'}</span>
                <div class="podium-names">${formatNames(podium2)}</div>
                <span class="podium-points">${podium2[0].score} pts</span>
            </div>`;
    }
    
    if(podium1.length > 0) {
        html += `
            <div class="podium-step p-1" id="pod-1">
                <span class="podium-rank">1er</span>
                <div class="podium-names">${formatNames(podium1)}</div>
                <span class="podium-points">${podium1[0].score} pts</span>
            </div>`;
    }
    
    if(podium3.length > 0) {
        let rank3 = podium3[0].rank;
        html += `
            <div class="podium-step p-3" id="pod-3">
                <span class="podium-rank">${rank3 === 1 ? '1er' : rank3 + 'ème'}</span>
                <div class="podium-names">${formatNames(podium3)}</div>
                <span class="podium-points">${podium3[0].score} pts</span>
            </div>`;
    }

    html += `</div>`;

    let podiumTeamsNames = [...podium1, ...podium2, ...podium3].map(t => t.name);
    let listTeams = allRankedTeams.filter(t => !podiumTeamsNames.includes(t.name));

    if(listTeams.length > 0) {
        html += `<div class="leaderboard-list glass-panel">`;
        listTeams.forEach(t => {
            html += `
                <div class="leaderboard-row glass-panel">
                    <div class="rank-badge">${t.rank}ème</div>
                    <div class="team-name-lb">${t.emoji} ${t.name}</div>
                    <div class="team-score-lb">${t.score} pts</div>
                </div>`;
        });
        html += `</div>`;
    }

    html += `
        <div class="export-container">
            <button class="btn-accent" onclick="exportResults()">Exporter les résultats</button>
        </div>
    `;

    renderView(html);

    setTimeout(() => {
        const p1 = document.getElementById('pod-1');
        const p2 = document.getElementById('pod-2');
        const p3 = document.getElementById('pod-3');
        if(p1) p1.style.height = '100%';
        if(p2) p2.style.height = '75%';
        if(p3) p3.style.height = '50%';
    }, 100); 

    setTimeout(() => {
        confetti({
            particleCount: 250,
            spread: 140,
            origin: { y: 0.6 },
            colors: ['#ffd700', '#e0e0e0', '#cd7f32', '#f7b731', '#00b894']
        });
    }, 500);
}

function getCurrentQuestionPoints() {
    if (currentPhase === 'p1') return QUESTIONS.phase1[currentQuestionIndex].pts;
    if (currentPhase === 'p2_q') return QUESTIONS.phase2[activeCategory][currentQuestionIndex].pts;
    if (currentPhase === 'p3_q') return QUESTIONS.phase3[currentQuestionIndex].pts;
    return 1;
}

function goToNextQuestion() {
    currentQuestionIndex++;
    if (currentPhase === 'p1') {
        renderGeneralPhase("Qualifications", QUESTIONS.phase1, 'startPhase2Categories');
    } else if (currentPhase === 'p2_q') {
        renderPhase2Question();
    } else if (currentPhase === 'p3_q') {
        renderPhase3Question();
    }
}

function sendLockToPhone(teamName) {
    // Utilisé pour bloquer uniquement l'équipe qui s'est trompée
    if (typeof connections !== 'undefined' && connections[teamName]) {
        connections[teamName].send({ type: 'lock', winner: 'Faux (Bloqué)' });
    }
}

function lockAllBuzzers() {
    if (typeof connections !== 'undefined') {
        Object.values(connections).forEach(c => {
            c.send({ type: 'lock', winner: 'Regardez l\'écran' });
        });
    }
}

function resolveBuzz(isCorrect) {
    document.getElementById('buzz-popup').style.display = 'none';
    
    if (isCorrect) {
        // BONNE RÉPONSE 
        addPoints(currentBuzzedTeam, getCurrentQuestionPoints()); 
        isQuestionActive = false;
        buzzQueue = []; 
        currentBuzzedTeam = null; 
        if (currentPhase === 'p3_q') {
            revealAnswerPhase3();
        } else {
            revealAnswer(); 
        }
        lockAllBuzzers(); 
    } else {
        // MAUVAISE RÉPONSE
        let failedTeam = currentBuzzedTeam; 
        getTeam(failedTeam).blocked = true; 
        sendLockToPhone(failedTeam); 
        
        currentBuzzedTeam = null; 

        if (currentPhase === 'p2_q') {
            // LOGIQUE PHASE 2 : VOL ÉCHOUÉ
            isQuestionActive = false;
            revealAnswer();
            lockAllBuzzers(); 
        } else {
            // LOGIQUE PHASES 1 & 3 : FILE D'ATTENTE
            if (buzzQueue.length > 0) {
                processNextInQueue(); 
            } else {
                openBuzzers(); 
                
                // NOUVEAU : On réaffiche le bouton "Révéler" car le jeu reprend !
                const btnReveal = document.getElementById('btn-reveal');
                if (btnReveal) btnReveal.style.display = 'flex';

                if (currentPhase === 'p3_q') {
                    pausePhase3Animation = false; 
                }
            }
        }
    }
}

function handleMasterCommand(data) {
    if (data.action === 'resolve') resolveBuzz(data.isCorrect);
    else if (data.action === 'p2_resolve') handleActiveTeamAnswer(data.isCorrect);
    else if (data.action === 'skip') skipQuestion();
    else if (data.action === 'reveal') {
        if (currentPhase === 'p3_q') revealAnswerPhase3();
        else revealAnswer();
    }
    else if (data.action === 'renderPhase3Question') renderPhase3Question();
    else if (data.action === 'p3_down') simulateSpace(true);
    else if (data.action === 'p3_up') simulateSpace(false);
    else if (data.action === 'selectCategory') selectCategory(data.category, data.teamIndex);
    else if (data.action === 'startGame') startGame();
    else if (data.action === 'showTeamSetup') showTeamSetup();
    else if (data.action === 'startPhase1') startPhase1();
    else if (data.action === 'startPhase2Categories') startPhase2Categories();
    else if (data.action === 'startPhase3') startPhase3();
    else if (data.action === 'showPodium') showPodium(); 
    else if (data.action === 'exportResults') exportResults();
    else if (data.action === 'updateScore') addPoints(data.teamName, data.delta); // ➔ AJOUTER ICI
    else if (data.action === 'updateScore') addPoints(data.teamName, data.delta);
    else if (data.action === 'updateSettings') {
        if(document.getElementById('cfg-p1')) document.getElementById('cfg-p1').value = data.p1;
        if(document.getElementById('cfg-p2')) document.getElementById('cfg-p2').value = data.p2;
        if(document.getElementById('cfg-p3')) document.getElementById('cfg-p3').value = data.p3;
    }
    syncMaster();
}

// Simulation de la barre Espace (Phase 3) depuis la télécommande
function simulateSpace(isDown) {
    if (isDown) {
        if (currentPhase === 'p3_q' && !currentBuzzedTeam) {
            if (!p3RevealInterval && p3CurrentIndex < p3FullText.length) {
                p3RevealInterval = setInterval(() => {
                    if (p3CurrentIndex < p3FullText.length) {
                        const spanLetter = document.getElementById(`p3-l-${p3CurrentIndex}`);
                        if(spanLetter) spanLetter.classList.add('revealed');
                        p3CurrentIndex++;
                    } else {
                        clearInterval(p3RevealInterval);
                        p3RevealInterval = null;
                    }
                }, 60);
            }
        }
    } else {
        if (p3RevealInterval) {
            clearInterval(p3RevealInterval);
            p3RevealInterval = null;
        }
    }
}

function syncMaster() {
    if (typeof masterConn !== 'undefined' && masterConn && masterConn.open) {
        let qText = "En attente..."; let aText = "..."; let descText = "";
        let p2Awaiting = false; let p2Cats = null; let currentChoosingTeam = null; let choosingTeamName = null;

        if (pendingTransition) {
            qText = "Prêt pour la suite ?"; aText = "Action requise";
        } else if (currentPhase === 'p1' && QUESTIONS.phase1[currentQuestionIndex]) {
            qText = QUESTIONS.phase1[currentQuestionIndex].q; aText = QUESTIONS.phase1[currentQuestionIndex].a; descText = QUESTIONS.phase1[currentQuestionIndex].d || "";
        } else if (currentPhase === 'pre_podium') { 
            qText = "Le jeu est terminé !";
            aText = "Prêts à annoncer les vainqueurs ?";
        } else if (currentPhase === 'p2_cat') {
            const tIndex = phase2Order[phase2Turn];
            if (tIndex !== undefined && teams[tIndex]) {
                choosingTeamName = teams[tIndex].name;
                qText = "Phase 2 : À la carte";
                aText = "Choix du thème...";
                currentChoosingTeam = tIndex;
            }
            p2Cats = Object.keys(QUESTIONS.phase2).map(c => ({ name: c, disabled: categoriesDone.includes(c) }));
        } else if (currentPhase === 'p2_q' && activeCategory && QUESTIONS.phase2[activeCategory][currentQuestionIndex]) {
            qText = QUESTIONS.phase2[activeCategory][currentQuestionIndex].q; aText = QUESTIONS.phase2[activeCategory][currentQuestionIndex].a; descText = QUESTIONS.phase2[activeCategory][currentQuestionIndex].d || "";
            if (!isQuestionActive && !currentBuzzedTeam && !isAnswerRevealed) p2Awaiting = true;
        } else if (currentPhase === 'p3_q' && QUESTIONS.phase3[currentQuestionIndex]) {
            qText = QUESTIONS.phase3[currentQuestionIndex].q; aText = QUESTIONS.phase3[currentQuestionIndex].a; descText = QUESTIONS.phase3[currentQuestionIndex].d || "";
        } 

        masterConn.send({
            type: 'sync', phase: currentPhase, question: qText, answer: aText, answerDescription: descText,
            answerRevealed: isAnswerRevealed, canSkip: isAnswerRevealed, buzzedTeam: currentBuzzedTeam,
            activeTeamName: (currentPhase === 'p2_q' && activeTeamIndex !== -1) ? teams[activeTeamIndex].name : null,
            isQuestionActive: isQuestionActive, p2AwaitingAnswer: p2Awaiting,
            transitionAction: pendingTransition ? pendingTransition.action : null, transitionTitle: pendingTransition ? pendingTransition.title : null, transitionLabel: pendingTransition ? pendingTransition.label : null,
            p2Cats: p2Cats, currentChoosingTeam: currentChoosingTeam, choosingTeamName: choosingTeamName,
            
            teamsList: teams,
            settings: {
                p1: document.getElementById('cfg-p1') ? document.getElementById('cfg-p1').value : 15,
                p2: document.getElementById('cfg-p2') ? document.getElementById('cfg-p2').value : 5,
                p3: document.getElementById('cfg-p3') ? document.getElementById('cfg-p3').value : 5
            }
        });
    }
}

function toggleSettings() {
    const popup = document.getElementById('settings-popup');
    popup.style.display = (popup.style.display === 'none' || popup.style.display === '') ? 'flex' : 'none';
}

// 4. On force la synchronisation à chaque changement d'écran
const originalRenderView = renderView;
renderView = function(html) {
    originalRenderView(html);
    setTimeout(syncMaster, 150); // Léger délai pour s'assurer que les variables sont à jour
};

function skipQuestion() {
    document.getElementById('btn-skip-question').style.display = 'none'; // Cache le bouton
    goToNextQuestion(); // Passe à la question suivante
}