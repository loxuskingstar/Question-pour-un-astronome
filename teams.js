// teams.js
const SPACE_EMOJIS = ['🚀', '🛸', '🪐', '☄️', '🛰️', '🔭', '👽', '🌠', '🌕', '🌌', '👩‍🚀', '☄️'];
let availableEmojis = [...SPACE_EMOJIS];
let teams = [];

function addTeam(name) {
    // Évite les doublons
    if (teams.find(t => t.name.toLowerCase() === name.toLowerCase())) return;
    
    const emoji = availableEmojis.length > 0 
        ? availableEmojis.splice(Math.floor(Math.random() * availableEmojis.length), 1)[0] 
        : '⭐';
        
    teams.push({ 
        name: name, 
        score: 0, 
        emoji: emoji,
        blocked: false // Devient true si l'équipe buzze et se trompe
    });
    
    renderTeamList(); // Met à jour l'écran d'accueil
    updateScoreboard(); // Met à jour le bandeau haut
}

function getTeam(name) {
    return teams.find(t => t.name === name);
}

function addPoints(teamName, points) {
    const team = getTeam(teamName);
    if (team) {
        team.score += points;
        updateScoreboard();
    }
}

function blockTeam(teamName) {
    const team = getTeam(teamName);
    if (team) team.blocked = true;
}