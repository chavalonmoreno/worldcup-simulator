let data;

document.addEventListener("DOMContentLoaded", async () => {

    await loadData();

    renderGroups();

    document
        .getElementById("simulateBtn")
        .addEventListener("click", simulate);

});

async function loadData() {

    const response = await fetch("data.json");

    data = await response.json();

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

        card.querySelector(".home-name").textContent =
            data.teams[match.home].name;

        card.querySelector(".away-name").textContent =
            data.teams[match.away].name;

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

    const home =
        document.getElementById(`home-${match.id}`).value;

    const away =
        document.getElementById(`away-${match.id}`).value;

    return {

        home: home === "" ? null : Number(home),
        away: away === "" ? null : Number(away)

    };

}

function simulate(){

    savePredictions();

    const standingsByGroup = {};

    groups.forEach(group => {

        standingsByGroup[group] =
            calculateGroupTable(group);

    });

    const rankedThirds =
        rankThirdPlaces(
            standingsByGroup
        );

    const round32 =
        generateRound32(
            standingsByGroup,
            rankedThirds
        );

    const round16 =
        generateRound16(
            round32
        );

    const quarterFinals =
        generateQuarterFinals(
            round16
        );

    const semiFinals =
        generateSemiFinals(
            quarterFinals
        );

    const finals =
        generateFinal(
            semiFinals
        );

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

        }
        else if (score.home < score.away) {

            away.points += 3;
            away.wins++;

            home.losses++;

        }
        else {

            home.points++;
            away.points++;

            home.draws++;
            away.draws++;

        }

        home.fairPlay += calculateFairPlay(
            match.fairPlay?.[match.home]
        );

        away.fairPlay += calculateFairPlay(
            match.fairPlay?.[match.away]
        );

    });

    Object.values(table)
        .forEach(team => {

            team.gd = team.gf - team.ga;

        });

    return applyTieBreakers(
        Object.values(table),
        matches
    );

}

function calculateFairPlay(fp) {

    if (!fp) return 0;

    return (

        fp.Y * -1 +
        fp.YR * -3 +
        fp.IR * -4 

    );

}

function applyTieBreakers(teams, matches) {

    return teams.sort((a, b) => {

        if (b.points !== a.points)
            return b.points - a.points;

        if (b.gd !== a.gd)
            return b.gd - a.gd;

        if (b.gf !== a.gf)
            return b.gf - a.gf;

        const headToHead =
            compareHeadToHead(
                a.code,
                b.code,
                matches
            );

        if (headToHead !== 0)
            return headToHead;

        if (a.fairPlay !== b.fairPlay)
            return b.fairPlay - a.fairPlay;

        return a.fifaRanking - b.fifaRanking;

    });

}

function compareHeadToHead(team1, team2, matches) {

    const match = matches.find(m =>
        (m.home === team1 && m.away === team2) ||
        (m.home === team2 && m.away === team1)
    );

    if (!match)
        return 0;

    const score = getMatchScore(match);

    let t1;
    let t2;

    if (match.home === team1) {

        t1 = score.home;
        t2 = score.away;

    } else {

        t1 = score.away;
        t2 = score.home;

    }

    if (t1 > t2)
        return -1;

    if (t1 < t2)
        return 1;

    return 0;

}

function rankThirdPlaces(standingsByGroup) {

    let thirds = [];

    Object.values(standingsByGroup)
        .forEach(group => {

            thirds.push(group[2]);

        });

    return thirds.sort((a, b) => {

        if (b.points !== a.points)
            return b.points - a.points;

        if (b.gd !== a.gd)
            return b.gd - a.gd;

        if (b.gf !== a.gf)
            return b.gf - a.gf;

        if (a.fairPlay !== b.fairPlay)
            return b.fairPlay - a.fairPlay;

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
                    document.getElementById(
                        `home-${match.id}`
                    )?.value,

                awayScore:
                    document.getElementById(
                        `away-${match.id}`
                    )?.value

            };

        });

    localStorage.setItem(
        "worldcup_predictions",
        JSON.stringify(predictions)
    );

}


function resetPredictions() {

    localStorage.removeItem(
        "worldcup_predictions"
    );

    location.reload();

}

function loadPredictions() {

    const predictions = JSON.parse(
        localStorage.getItem(
            "worldcup_predictions"
        )
    );

    if (!predictions)
        return;

    Object.entries(predictions)
        .forEach(([id, prediction]) => {

            const home =
                document.getElementById(
                    `home-${id}`
                );

            const away =
                document.getElementById(
                    `away-${id}`
                );

            if (home)
                home.value =
                    prediction.homeScore;

            if (away)
                away.value =
                    prediction.awayScore;

        });

}

const firsts = [];
const seconds = [];
const thirds = [];

function generateRound32(
    standingsByGroup,
    rankedThirds
) {

    const firsts = [];
    const seconds = [];

    Object.values(standingsByGroup)
        .forEach(group => {

            firsts.push(group[0]);

            seconds.push(group[1]);

        });

    const qualifiedThirds =
        rankedThirds.slice(0, 8);

    return [

        {
            home: firsts[0],
            away: qualifiedThirds[7]
        },

        {
            home: seconds[0],
            away: seconds[11]
        }

        // continuar con las 16 llaves
    ];

}

function winner(match){

    if(match.homeScore > match.awayScore)
        return match.home;

    return match.away;

}

function generateRound16(round32){

    return [

        {
            home:
                winner(round32[0]),

            away:
                winner(round32[1])

        },

        {
            home:
                winner(round32[2]),

            away:
                winner(round32[3])

        }

    ];

}

function generateQuarterFinals(round16){

    return [

        {
            home:
                winner(round16[0]),

            away:
                winner(round16[1])

        },

        {
            home:
                winner(round16[2]),

            away:
                winner(round16[3])

        },

        {
            home:
                winner(round16[4]),

            away:
                winner(round16[5])

        },

        {
            home:
                winner(round16[6]),

            away:
                winner(round16[7])

        }

    ];

}

function generateSemiFinals(quarters){

    return [

        {

            home:
                winner(quarters[0]),

            away:
                winner(quarters[1])

        },

        {

            home:
                winner(quarters[2]),

            away:
                winner(quarters[3])

        }

    ];

}

function generateFinal(semis){

    return {

        final: [

            {

                home:
                    winner(semis[0]),

                away:
                    winner(semis[1])

            }

        ],

        thirdPlace: [

            {

                home:
                    loser(semis[0]),

                away:
                    loser(semis[1])

            }

        ]

    };

}

function loser(match){

    if(match.homeScore > match.awayScore)
        return match.away;

    return match.home;

}

