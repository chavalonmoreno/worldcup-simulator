let tournamentData = {};
let simulator = null;

async function initApplication() {
  try {
    const response = await fetch('./data.json');
    tournamentData = await response.json();
    
    // Cargar predicciones previas guardadas en el navegador del usuario
    loadLocalStoragePredictions();

    simulator = new WorldCupSimulator(tournamentData);
    
    renderGroupsUI();
    renderEverything();
    setupEventListeners();
  } catch (error) {
    console.error("Error cargando los datos del simulador:", error);
  }
}

function loadLocalStoragePredictions() {
  const saved = localStorage.getItem('wc_2026_sim_cache');
  if (saved) {
    const cachedScores = JSON.parse(saved);
    tournamentData.matches.forEach(m => {
      // Solo restaurar si el partido NO es un resultado real oficializado
      if (!m.isReal && cachedScores[m.id]) {
        m.homeScore = cachedScores[m.id].homeScore;
        m.awayScore = cachedScores[m.id].awayScore;
      }
    });
  }
}

function savePredictionsToStorage() {
  const dataToSave = {};
  tournamentData.matches.forEach(m => {
    if (!m.isReal) {
      dataToSave[m.id] = { homeScore: m.homeScore, awayScore: m.awayScore };
    }
  });
  localStorage.setItem('wc_2026_sim_cache', JSON.stringify(dataToSave));
}

function renderGroupsUI() {
  const container = document.getElementById('groups-grid');
  container.innerHTML = '';

  // Agrupar partidos por su letra de grupo
  const matchesByGroup = {};
  tournamentData.matches.forEach(m => {
    if (!matchesByGroup[m.group]) matchesByGroup[m.group] = [];
    matchesByGroup[m.group].push(m);
  });

  Object.keys(matchesByGroup).forEach(groupLetter => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <h3>Grupo ${groupLetter}</h3>
      <div class="matches-list" id="matches-list-${groupLetter}"></div>
      <table class="group-table">
        <thead>
          <tr><th>Pos</th><th>Equipo</th><th>Pts</th><th>DG</th></tr>
        </thead>
        <tbody id="table-body-${groupLetter}"></tbody>
      </table>
    `;
    container.appendChild(card);

    const matchesList = document.getElementById(`matches-list-${groupLetter}`);
    matchesByGroup[groupLetter].forEach(m => {
      const homeTeam = tournamentData.teams[m.home];
      const awayTeam = tournamentData.teams[m.away];

      const matchRow = document.createElement('div');
      matchRow.className = `match-row ${m.isReal ? 'real' : ''}`;
      matchRow.dataset.matchId = m.id;
      matchRow.innerHTML = `
        <span class="team-label home">${homeTeam.name}</span>
        <input type="number" class="score-input" data-team="${m.home}" 
               value="${m.homeScore !== null ? m.homeScore : ''}" ${m.isReal ? 'disabled' : ''} min="0">
        <span class="vs-separator">-</span>
        <input type="number" class="score-input" data-team="${m.away}" 
               value="${m.awayScore !== null ? m.awayScore : ''}" ${m.isReal ? 'disabled' : ''} min="0">
        <span class="team-label away">${awayTeam.name}</span>
      `;
      matchesList.appendChild(matchRow);
    });
  });
}

function setupEventListeners() {
  document.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const row = e.target.closest('.match-row');
      const matchId = row.dataset.matchId;
      const teamCode = e.target.dataset.team;
      const val = e.target.value === "" ? null : parseInt(e.target.value);

      const match = tournamentData.matches.find(m => m.id === matchId);
      if (match) {
        if (match.home === teamCode) match.homeScore = val;
        if (match.away === teamCode) match.awayScore = val;
      }

      savePredictionsToStorage();
      renderEverything();
    });
  });
}

function renderEverything() {
  const tables = simulator.buildTables();
  const sortedGroups = {};

  Object.keys(tables).forEach(groupLetter => {
    const teamsArray = Object.values(tables[groupLetter]);
    sortedGroups[groupLetter] = simulator.sortGroup(teamsArray);
    
    // Renderizar los cambios de posición en caliente
    const tbody = document.getElementById(`table-body-${groupLetter}`);
    if (tbody) {
      tbody.innerHTML = sortedGroups[groupLetter].map((team, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${team.name}</strong></td>
          <td>${team.Pts}</td>
          <td>${team.GD >= 0 ? '+' + team.GD : team.GD}</td>
        </tr>
      `).join('');
    }
  });

  const bestThirds = simulator.getBestThirdPlaces(sortedGroups);
  const bracketMatches = simulator.getRoundOf32Matches(sortedGroups, bestThirds);
  
  // Renderizar las llaves finales
  const bracketContainer = document.getElementById('round-of-32');
  if (bracketContainer) {
    bracketContainer.innerHTML = bracketMatches.map(m => `
      <div class="match-slot">
        <div class="match-slot-title">${m.title}</div>
        <div class="bracket-team">
          <span>${m.home ? m.home.name : 'Por definir'}</span>
        </div>
        <div class="bracket-team">
          <span>${m.away ? m.away.name : 'Por definir'}</span>
        </div>
      </div>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', initApplication);