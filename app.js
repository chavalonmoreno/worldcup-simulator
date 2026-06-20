const FLAG_MAP = {
    MEX: 'mx',  RSA: 'za',  KOR: 'kr',  CZE: 'cz',
    CAN: 'ca',  BIH: 'ba',  QAT: 'qa',  SUI: 'ch',
    BRA: 'br',  MAR: 'ma',  HAI: 'ht',  SCO: 'gb-sct',
    USA: 'us',  PAR: 'py',  AUS: 'au',  TUR: 'tr',
    GER: 'de',  CUW: 'cw',  CIV: 'ci',  ECU: 'ec',
    NED: 'nl',  JPN: 'jp',  SWE: 'se',  TUN: 'tn',
    IRN: 'ir',  NZL: 'nz',  BEL: 'be',  EGY: 'eg',
    ESP: 'es',  CPV: 'cv',  KSA: 'sa',  URU: 'uy',
    FRA: 'fr',  SEN: 'sn',  IRQ: 'iq',  NOR: 'no',
    ARG: 'ar',  ALG: 'dz',  AUT: 'at',  JOR: 'jo',
    POR: 'pt',  COD: 'cd',  UZB: 'uz',  COL: 'co',
    ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
};

function flagHTML(code) {
    const iso = FLAG_MAP[code];
    return iso ? `<span class="fi fi-${iso}"></span>` : '';
}

function setTeamEl(el, team) {
    if (team?.name) {
        el.innerHTML = `${flagHTML(team.code)}${team.name}`;
    } else {
        el.textContent = team || 'TBD';
        if (!team) el.classList.add('tbd');
    }
}

let data;

// ES module deferred by default — DOM is ready, no DOMContentLoaded needed
await loadData();

renderGroups();
loadPredictions();

document
    .getElementById("simulateBtn")
    .addEventListener("click", simulate);

document
    .getElementById("resetBtn")
    .addEventListener("click", resetPredictions);

async function loadData() {

    try {

        const response = await fetch("data.json");

        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);

        data = await response.json();

    } catch (err) {

        document.querySelector("main").innerHTML =
            `<p style="color:red;padding:20px">
                Error cargando datos: ${err.message}
             </p>`;

        throw err;

    }

}

function renderGroups() {

    const container = document.getElementById("groups-container");

    container.innerHTML = "";

    const groups = [...new Set(
        Object.values(data.teams)
            .map(team => team.group)
    )].sort();

    groups.forEach(group => {

        const template = document
            .getElementById("groupTemplate")
            .content
            .cloneNode(true);

        const card = template.querySelector(".group-card");
        card.dataset.group = group;

        template.querySelector(".group-name").textContent =
            `Grupo ${group}`;

        const matchesContainer =
            template.querySelector(".matches-container");

        renderMatches(group, matchesContainer);

        container.appendChild(template);

    });

}

function renderMatches(group, container) {

    const matches = data.matches.filter(
        m => m.group === group
    );

    matches.forEach(match => {

        const card = document
            .getElementById("matchTemplate")
            .content
            .cloneNode(true);

        card.querySelector(".match-id").textContent =
            match.id;

        card.querySelector(".home-name").innerHTML =
            flagHTML(match.home) + data.teams[match.home].name;

        card.querySelector(".away-name").innerHTML =
            flagHTML(match.away) + data.teams[match.away].name;

        const homeInput =
            card.querySelector(".home-score");

        const awayInput =
            card.querySelector(".away-score");

        homeInput.id = `home-${match.id}`;
        awayInput.id = `away-${match.id}`;

        if (match.isReal) {

            homeInput.value = match.homeScore;
            awayInput.value = match.awayScore;

            homeInput.disabled = true;
            awayInput.disabled = true;

        }

        container.appendChild(card);

    });

}

function getMatchScore(match) {

    if (match.isReal) {

        return {
            home: match.homeScore,
            away: match.awayScore
        };

    }

    const homeEl = document.getElementById(`home-${match.id}`);
    const awayEl  = document.getElementById(`away-${match.id}`);

    const home = homeEl?.value;
    const away = awayEl?.value;

    return {
        home: home === "" || home == null ? null : Number(home),
        away: away === "" || away == null ? null : Number(away)
    };

}

function simulate() {

    savePredictions();

    const groups = [...new Set(
        Object.values(data.teams).map(t => t.group)
    )].sort();

    const standingsByGroup = {};

    groups.forEach(group => {
        standingsByGroup[group] = calculateGroupTable(group);
    });

    renderStandings(standingsByGroup);

    const rankedThirds = rankThirdPlaces(standingsByGroup);

    const resolvedMatches = {};

    const round32 = generateRound32(standingsByGroup, rankedThirds);
    round32.forEach(m => resolvedMatches[m.id] = m);
    renderKnockoutRound("round32", round32);

    const stageMap = [
        { stage: "round16",      containerId: "round16"       },
        { stage: "quarterfinal", containerId: "quarterfinals" },
        { stage: "semifinal",    containerId: "semifinals"    },
        { stage: "third_place",  containerId: "thirdPlace"    },
        { stage: "final",        containerId: "final"         }
    ];

    stageMap.forEach(({ stage, containerId }) => {
        const matches = resolveKnockoutFromData(stage, resolvedMatches);
        matches.forEach(m => resolvedMatches[m.id] = m);
        renderKnockoutRound(containerId, matches);
    });

}

function renderStandings(standingsByGroup) {

    Object.entries(standingsByGroup).forEach(([group, teams]) => {

        const tbody = document.querySelector(
            `[data-group="${group}"] .group-table-body`
        );

        if (!tbody) return;

        tbody.innerHTML = "";

        teams.forEach((team, index) => {

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="text-align:left">${flagHTML(team.code)}${team.name}</td>
                <td>${team.points}</td>
                <td>${team.gd >= 0 ? "+" : ""}${team.gd}</td>
                <td>${team.gf}</td>
                <td>${team.ga}</td>
            `;

            tbody.appendChild(tr);

        });

    });

}

function renderKnockoutRound(containerId, matches) {

    const container = document.getElementById(containerId);

    if (!container) return;

    container.innerHTML = "";

    matches.forEach(match => {

        const card = document
            .getElementById("knockoutMatchTemplate")
            .content
            .cloneNode(true);

        const homeEl = card.querySelector(".knockout-home");
        const awayEl = card.querySelector(".knockout-away");

        setTeamEl(homeEl, match.home);
        setTeamEl(awayEl, match.away);

        container.appendChild(card);

    });

}

function calculateGroupTable(group) {

    let table = {};

    Object.entries(data.teams)
        .filter(([_, t]) => t.group === group)
        .forEach(([code, team]) => {

            table[code] = {

                code,
                name: team.name,
                fifaRanking: team.fifaRanking,
                group: team.group,

                points: 0,
                gf: 0,
                ga: 0,
                gd: 0,

                wins: 0,
                draws: 0,
                losses: 0,

                fairPlay: 0

            };

        });

    const matches =
        data.matches.filter(m => m.group === group);

    matches.forEach(match => {

        const score = getMatchScore(match);

        if (
            score.home === null ||
            score.away === null
        ) return;

        const home = table[match.home];
        const away = table[match.away];

        home.gf += score.home;
        home.ga += score.away;

        away.gf += score.away;
        away.ga += score.home;

        if (score.home > score.away) {

            home.points += 3;
            home.wins++;

            away.losses++;

        } else if (score.home < score.away) {

            away.points += 3;
            away.wins++;

            home.losses++;

        } else {

            home.points++;
            away.points++;

            home.draws++;
            away.draws++;

        }

        home.fairPlay += calculateFairPlay(match.fairPlay?.[match.home]);
        away.fairPlay += calculateFairPlay(match.fairPlay?.[match.away]);

    });

    Object.values(table).forEach(team => {
        team.gd = team.gf - team.ga;
    });

    return applyTieBreakers(Object.values(table), matches);

}

function calculateFairPlay(fp) {

    if (!fp) return 0;

    return (fp.Y ?? 0) * -1 + (fp.R ?? 0) * -3;

}

function applyTieBreakers(teams, matches) {

    // Step 1: sort by global stats
    const presorted = [...teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd     !== a.gd)     return b.gd     - a.gd;
        if (b.gf     !== a.gf)     return b.gf     - a.gf;
        return 0;
    });

    // Step 2: within each group of teams tied on Pts+GD+GF, apply H2H mini-table
    const result = [];
    let i = 0;

    while (i < presorted.length) {

        let j = i + 1;

        while (
            j < presorted.length &&
            presorted[j].points === presorted[i].points &&
            presorted[j].gd     === presorted[i].gd     &&
            presorted[j].gf     === presorted[i].gf
        ) j++;

        const tiedGroup = presorted.slice(i, j);
        result.push(...sortTiedGroup(tiedGroup, matches));
        i = j;

    }

    return result;

}

function sortTiedGroup(teams, matches) {

    if (teams.length === 1) return teams;

    const codes = teams.map(t => t.code);
    const mini  = buildMiniTable(codes, matches);

    return [...teams].sort((a, b) => {

        const ma = mini[a.code];
        const mb = mini[b.code];

        if (mb.pts !== ma.pts) return mb.pts - ma.pts;
        if (mb.gd  !== ma.gd)  return mb.gd  - ma.gd;
        if (mb.gf  !== ma.gf)  return mb.gf  - ma.gf;

        if (a.fairPlay !== b.fairPlay) return b.fairPlay - a.fairPlay;

        return a.fifaRanking - b.fifaRanking;

    });

}

function buildMiniTable(codes, matches) {

    const table = {};
    codes.forEach(c => table[c] = { pts: 0, gd: 0, gf: 0 });

    matches.forEach(m => {

        if (!codes.includes(m.home) || !codes.includes(m.away)) return;

        const score = getMatchScore(m);
        if (score.home === null || score.away === null) return;

        table[m.home].gf += score.home;
        table[m.home].gd += score.home - score.away;
        table[m.away].gf += score.away;
        table[m.away].gd += score.away - score.home;

        if (score.home > score.away) {
            table[m.home].pts += 3;
        } else if (score.home < score.away) {
            table[m.away].pts += 3;
        } else {
            table[m.home].pts += 1;
            table[m.away].pts += 1;
        }

    });

    return table;

}

function rankThirdPlaces(standingsByGroup) {

    const thirds = [];

    Object.values(standingsByGroup).forEach(group => {
        if (group[2]) thirds.push(group[2]);
    });

    return thirds.sort((a, b) => {

        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd)         return b.gd - a.gd;
        if (b.gf !== a.gf)         return b.gf - a.gf;
        if (a.fairPlay !== b.fairPlay) return b.fairPlay - a.fairPlay;

        return a.fifaRanking - b.fifaRanking;

    });

}

function savePredictions() {

    let predictions = {};

    data.matches
        .filter(match => !match.isReal)
        .forEach(match => {

            predictions[match.id] = {

                homeScore:
                    document.getElementById(`home-${match.id}`)?.value,

                awayScore:
                    document.getElementById(`away-${match.id}`)?.value

            };

        });

    localStorage.setItem(
        "worldcup_predictions",
        JSON.stringify(predictions)
    );

}

function resetPredictions() {

    localStorage.removeItem("worldcup_predictions");

    location.reload();

}

function loadPredictions() {

    const predictions = JSON.parse(
        localStorage.getItem("worldcup_predictions")
    );

    if (!predictions) return;

    Object.entries(predictions).forEach(([id, prediction]) => {

        const home = document.getElementById(`home-${id}`);
        const away = document.getElementById(`away-${id}`);

        if (home) home.value = prediction.homeScore;
        if (away) away.value = prediction.awayScore;

    });

}

function generateRound32(standingsByGroup, rankedThirds) {

    const qualifiedThirds = rankedThirds.slice(0, 8);
    const assignedThirds  = new Set();

    function resolveSlot(placeholder) {

        const m = placeholder.match(/^(\d)([A-L]+)$/);
        if (!m) return null;

        const pos      = parseInt(m[1]) - 1;
        const groupStr = m[2];

        if (groupStr.length === 1) {
            return standingsByGroup[groupStr]?.[pos] || null;
        }

        const letters   = groupStr.split("");
        const candidate = qualifiedThirds.find(
            t => letters.includes(t.group) && !assignedThirds.has(t.code)
        );

        if (candidate) assignedThirds.add(candidate.code);
        return candidate || null;

    }

    return data.matches
        .filter(m => m.stage === "round32")
        .map(spec => ({
            id:        spec.id,
            home:      resolveSlot(spec.home),
            away:      resolveSlot(spec.away),
            homeScore: spec.homeScore,
            awayScore: spec.awayScore,
            isReal:    spec.isReal
        }));

}

function resolveKnockoutFromData(stage, resolvedMatches) {

    return data.matches
        .filter(m => m.stage === stage)
        .map(spec => {

            const home = resolveKnockoutSlot(spec.home, resolvedMatches);
            const away = resolveKnockoutSlot(spec.away, resolvedMatches);

            const resolved = {
                id:        spec.id,
                home,
                away,
                homeScore: spec.homeScore,
                awayScore: spec.awayScore,
                isReal:    spec.isReal
            };

            return resolved;

        });

}

function resolveKnockoutSlot(placeholder, resolvedMatches) {

    if (!placeholder) return null;

    const winnerMatch = placeholder.match(/^W-(.+)$/);
    const loserMatch  = placeholder.match(/^L-(.+)$/);

    if (winnerMatch) {
        const match = resolvedMatches[winnerMatch[1]];
        return match ? winner(match) : null;
    }

    if (loserMatch) {
        const match = resolvedMatches[loserMatch[1]];
        return match ? loser(match) : null;
    }

    return null;

}

function winner(match) {

    if (!match) return null;
    if (match.homeScore == null || match.awayScore == null)
        return match.home || null;

    if (match.homeScore > match.awayScore) return match.home;

    return match.away;

}

function loser(match) {

    if (!match) return null;
    if (match.homeScore == null || match.awayScore == null)
        return match.away || null;

    if (match.homeScore > match.awayScore) return match.away;

    return match.home;

}
