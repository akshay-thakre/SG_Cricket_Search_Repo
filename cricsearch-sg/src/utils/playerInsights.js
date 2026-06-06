export function generatePlayerInsights(batting, bowling, leaguesContributed = []) {
  const battingProfile  = calculateBattingProfile(batting);
  const bowlingProfile  = calculateBowlingProfile(bowling);
  const scores          = calculateImpactScores(batting, bowling);
  const suggestedRole   = determineSuggestedRole(batting, bowling, scores.battingScore, scores.bowlingScore);
  const strengths       = identifyStrengths(batting, bowling);
  const improvements    = identifyImprovements(batting, bowling);
  const confidence      = calculateConfidence(batting, bowling, leaguesContributed);
  return {
    battingProfile, bowlingProfile, suggestedRole, strengths, improvements,
    battingScore: scores.battingScore, bowlingScore: scores.bowlingScore,
    overallScore: scores.overallScore, confidence, leaguesContributed,
    limitedSample: confidence.level === 'low',
  };
}

function calculateBattingProfile(batting) {
  if (!batting || !batting.innings) return null;
  const avg = batting.average || 0, sr = batting.strikeRate || 0;
  const runs = batting.runs || 0, balls = batting.balls || 0;
  const sixPct = balls > 0 && runs > 0 ? (((batting.sixes||0)*6)/runs*100).toFixed(1) : '0.0';
  let style;
  if      (avg >= 35 && sr >= 135) style = 'Aggressive Anchor';
  else if (avg >= 35 && sr <  100) style = 'Classical Accumulator';
  else if (avg >= 25 && sr >= 135) style = 'Power Hitter';
  else if (avg >= 20 && sr >= 110) style = 'Balanced Bat';
  else if (sr  >= 145)             style = 'Big Hitter';
  else if (avg >= 20)              style = 'Steady Bat';
  else                             style = 'Developing Bat';
  return { style, average: avg, strikeRate: sr, sixPct,
           fifties: batting.fifties||0, hundreds: batting.hundreds||0,
           highestScore: batting.highestScore };
}

function calculateBowlingProfile(bowling) {
  if (!bowling || !bowling.innings) return null;
  const econ = bowling.economy||0, avg = bowling.average, sr = bowling.strikeRate, wkts = bowling.wickets||0;
  let style;
  if      (avg && avg < 20 && econ < 6) style = 'Strike Bowler';
  else if (avg && avg < 25)              style = 'Wicket Taker';
  else if (econ < 6)                     style = 'Economy Bowler';
  else if (econ < 7.5)                   style = 'Support Bowler';
  else                                   style = 'Developing Bowler';
  return { style, wickets: wkts, economy: econ, average: avg, strikeRate: sr, bestBowling: bowling.bestBowling };
}

function calculateImpactScores(batting, bowling) {
  let battingScore = 0, bowlingScore = 0;
  if (batting && batting.innings) {
    const avg=batting.average||0, sr=batting.strikeRate||0, matches=batting.matches||0;
    const miles=(batting.fifties||0)+(batting.hundreds||0)*2;
    battingScore += Math.min(40,(avg/40)*40);
    battingScore += Math.min(30,(sr/150)*30);
    battingScore += Math.min(20,miles*3);
    battingScore += Math.min(10,(matches/20)*10);
    battingScore = Math.round(Math.min(100,battingScore));
  }
  if (bowling && bowling.innings) {
    const econ=bowling.economy??9, avg=bowling.average, wkts=bowling.wickets||0, matches=bowling.matches||0;
    bowlingScore += Math.max(0,Math.min(35,((9-econ)/5)*35));
    bowlingScore += avg ? Math.max(0,Math.min(35,((45-avg)/30)*35)) : 0;
    bowlingScore += Math.min(20,(wkts/30)*20);
    bowlingScore += Math.min(10,(matches/20)*10);
    bowlingScore = Math.round(Math.min(100,bowlingScore));
  }
  const overallScore = batting&&bowling&&batting.innings&&bowling.innings
    ? Math.round((battingScore+bowlingScore)/2) : battingScore||bowlingScore;
  return { battingScore, bowlingScore, overallScore };
}

function determineSuggestedRole(batting, bowling, battingScore, bowlingScore) {
  const hasBat=batting&&(batting.innings||0)>0, hasBwl=bowling&&(bowling.innings||0)>0;
  if (!hasBat&&!hasBwl) return 'Insufficient Data';
  if (!hasBwl||bowlingScore<15) return 'Specialist Batter';
  if (!hasBat||battingScore<15) return 'Specialist Bowler';
  if (battingScore>=55&&bowlingScore>=55) return 'True All-Rounder';
  if (battingScore>=bowlingScore+20) return 'Batting All-Rounder';
  if (bowlingScore>=battingScore+20) return 'Bowling All-Rounder';
  return 'All-Rounder';
}

function identifyStrengths(batting, bowling) {
  const s=[];
  if (batting&&batting.innings) {
    if ((batting.average||0)>=35) s.push(`High batting average (${batting.average.toFixed(1)})`);
    if ((batting.strikeRate||0)>=130) s.push(`Explosive strike rate (${batting.strikeRate.toFixed(1)})`);
    if ((batting.fifties||0)+(batting.hundreds||0)>=3) s.push('Match-winning innings maker');
    if ((batting.sixes||0)>=5) s.push(`Six-hitting power (${batting.sixes} sixes)`);
    if ((batting.hundreds||0)>=1) s.push(`Century maker (${batting.hundreds}×100)`);
  }
  if (bowling&&bowling.innings) {
    if ((bowling.economy||99)<=6) s.push(`Economical bowling (econ ${bowling.economy.toFixed(2)})`);
    if (bowling.strikeRate && bowling.strikeRate < 24) s.push(`Consistent wicket taker (SR ${bowling.strikeRate.toFixed(1)} balls/wkt)`);
    if (bowling.average&&bowling.average<20) s.push('Excellent bowling average');
    if (bowling.strikeRate&&bowling.strikeRate<15) s.push('Strikes every 15 balls');
  }
  if (s.length===0) s.push('Shows promise across phases of play');
  return s;
}

function identifyImprovements(batting, bowling) {
  const a=[];
  if (batting&&(batting.innings||0)>3) {
    if ((batting.average||0)<15) a.push(`Build bigger innings (avg ${batting.average?.toFixed(1)})`);
    if ((batting.strikeRate||0)<90) a.push(`Increase scoring rate (SR ${batting.strikeRate?.toFixed(1)})`);
    if ((batting.ducks||0)>=3) a.push(`Reduce early dismissals (${batting.ducks} ducks)`);
  }
  if (bowling&&(bowling.innings||0)>3) {
    if ((bowling.economy||0)>8) a.push(`Control economy (currently ${bowling.economy?.toFixed(2)})`);
    if (!bowling.wickets||bowling.wickets<3) a.push('Take more wickets');
  }
  if (a.length===0) a.push('Continue building consistent performances');
  return a;
}

function calculateConfidence(batting, bowling, leaguesContributed) {
  const totalMatches=batting?.matches||0, totalInnings=(batting?.innings||0)+(bowling?.innings||0);
  const leagueCount=(leaguesContributed||[]).length;
  if (totalMatches>=15&&leagueCount>=2) return {level:'high',label:'High',color:'#16a34a'};
  if (totalInnings>=6||leagueCount>=2)  return {level:'medium',label:'Medium',color:'#d97706'};
  return                                       {level:'low',label:'Low',color:'#dc2626'};
}
