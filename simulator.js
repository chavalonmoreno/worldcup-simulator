class WorldCupSimulator {
    constructor(data) {
      this.teams = data.teams;
      this.matches = data.matches;
    }
  
    buildTables() {
      const tables = {};
      
      Object.keys(this.teams).forEach(code => {
        const group = this.teams[code].group;
        if (!tables[group]) tables[group] = {};
        tables[group][code] = {
          code, ...this.teams[code],
          P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0
        };
      });
  
      this.matches.forEach(m => {
        if (m.stage !== 'group' || m.homeScore === null || m.awayScore === null) return;
  
        const tH = tables[m.group][m.home];
        const tA = tables[m.group][m.away];
  
        if (!tH || !tA) return;
  
        tH.P++; tA.P++;
        tH.GF += m.homeScore; tH.GA += m.awayScore;
        tA.GF += m.awayScore; tA.GA += m.homeScore;
  
        if (m.homeScore > m.awayScore) {
          tH.W++; tH.Pts += 3; tA.L++;
        } else if (m.homeScore < m.awayScore) {
          tA.W++; tA.Pts += 3; tH.L++;
        } else {
          tH.D++; tA.D++; tH.Pts += 1; tA.Pts += 1;
        }
      });
  
      Object.keys(tables).forEach(g => {
        Object.keys(tables[g]).forEach(c => {
          tables[g][c].GD = tables[g][c].GF - tables[g][c].GA;
        });
      });
  
      return tables;
    }
  
    sortGroup(groupTeams) {
      return [...groupTeams].sort((a, b) => {
        if (b.Pts !== a.Pts) return b.Pts - a.Pts;
  
        // Criterio de duelo directo (Head-to-Head) si hay empate en puntos
        const tiedTeams = groupTeams.filter(t => t.Pts === a.Pts).map(t => t.code);
        if (tiedTeams.length > 1) {
          const h2h = this.getMiniTableStats(tiedTeams);
          if (h2h[b.code].Pts !== h2h[a.code].Pts) return h2h[b.code].Pts - h2h[a.code].Pts;
          if (h2h[b.code].GD !== h2h[a.code].GD) return h2h[b.code].GD - h2h[a.code].GD;
          if (h2h[b.code].GF !== h2h[a.code].GF) return h2h[b.code].GF - h2h[a.code].GF;
        }
  
        // Desempates Globales
        if (b.GD !== a.GD) return b.GD - a.GD;
        if (b.GF !== a.GF) return b.GF - a.GF;
        
        // Último criterio: Mejor Ranking FIFA (Número más bajo es mejor)
        return a.fifaRanking - b.fifaRanking;
      });
    }
  
    getMiniTableStats(tiedTeamCodes) {
      const miniTable = {};
      tiedTeamCodes.forEach(code => miniTable[code] = { Pts: 0, GF: 0, GA: 0, GD: 0 });
  
      this.matches.forEach(m => {
        if (m.stage === 'group' && tiedTeamCodes.includes(m.home) && tiedTeamCodes.includes(m.away)) {
          if (m.homeScore === null || m.awayScore === null) return;
          miniTable[m.home].GF += m.homeScore; miniTable[m.home].GA += m.awayScore;
          miniTable[m.away].GF += m.awayScore; miniTable[m.away].GA += m.homeScore;
  
          if (m.homeScore > m.awayScore) miniTable[m.home].Pts += 3;
          else if (m.homeScore < m.awayScore) miniTable[m.away].Pts += 3;
          else { miniTable[m.home].Pts += 1; miniTable[m.away].Pts += 1; }
        }
      });
  
      Object.keys(miniTable).forEach(c => miniTable[c].GD = miniTable[c].GF - miniTable[c].GA);
      return miniTable;
    }
  
    getBestThirdPlaces(allGroupsSorted) {
      const thirdPlaces = [];
      Object.keys(allGroupsSorted).forEach(g => {
        if (allGroupsSorted[g] && allGroupsSorted[g][2]) {
          thirdPlaces.push(allGroupsSorted[g][2]);
        }
      });
  
      return thirdPlaces.sort((a, b) => {
        if (b.Pts !== a.Pts) return b.Pts - a.Pts;
        if (b.GD !== a.GD) return b.GD - a.GD;
        if (b.GF !== a.GF) return b.GF - a.GF;
        return a.fifaRanking - b.fifaRanking;
      });
    }
  
    getRoundOf32Matches(allGroupsSorted, bestThirds) {
      // Matriz simplificada de emparejamientos para el árbol de eliminación directa
      // Estructura estándar del formato de 48 equipos de la FIFA
      return [
        { id: "M1", title: "Partido 1", home: allGroupsSorted['A']?.[0], away: bestThirds[0] || null },
        { id: "M2", title: "Partido 2", home: allGroupsSorted['B']?.[0], away: allGroupsSorted['C']?.[1] },
        { id: "M3", title: "Partido 3", home: allGroupsSorted['C']?.[0], away: bestThirds[1] || null },
        { id: "M4", title: "Partido 4", home: allGroupsSorted['D']?.[0], away: allGroupsSorted['A']?.[1] }
        // Nota: Al completar los 12 grupos de tu JSON, extiendes esta lista hasta los 16 partidos del árbol.
      ];
    }
  }