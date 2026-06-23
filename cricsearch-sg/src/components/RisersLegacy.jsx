/*
 * PHOTO MANAGEMENT
 * ----------------
 * All images in this component are served from Cloudinary.
 * Cloud name is configured in src/config/cloudinary.js
 *
 * To add a player photo:
 *   1. Upload the photo to Cloudinary under home/cricksearch/players/
 *   2. Set photo: 'home/cricksearch/players/filename' in the player object below
 *   3. The component will automatically display it at 200x200 circular crop
 *
 * To add a new gallery moment:
 *   1. Upload to Cloudinary under home/cricksearch/moments/
 *   2. Add an entry to MEMORY_ITEMS with the Cloudinary public ID
 *   3. Thumbnail uses w_400, lightbox uses w_900 — both auto-formatted
 */
import React, { useState, useEffect, useRef } from 'react';
import { cloudinaryUrl } from '../config/cloudinary';

// ── Cloudinary image URLs ──────────────────────────────────────────────────────

// Lightbox (large) versions — w_900
const IMAGES = {
  trophyMoment2:      cloudinaryUrl('trophy_moment_2',              'w_900,f_auto,q_auto'),
  trophyMoment:       cloudinaryUrl('Trophy_Moment_1',              'w_900,f_auto,q_auto'),
  farewellMoment:     cloudinaryUrl('farewell_moment',              'w_900,f_auto,q_auto'),
  farewellAB:         cloudinaryUrl('Farewell_AB_eo35my',           'w_900,f_auto,q_auto'),
  matchDayMoment:     cloudinaryUrl('Match_Day_Moment_1',           'w_900,f_auto,q_auto'),
  dressingRoom:       cloudinaryUrl('dressing_room_1',              'w_900,f_auto,q_auto'),
  awardsNight2016:    cloudinaryUrl('Awards_night2016_jbwmi3',      'w_900,f_auto,q_auto'),
  randomCelebration:  cloudinaryUrl('RandomCelebration_lnyrms',     'w_900,f_auto,q_auto'),
  randomCelebration2: cloudinaryUrl('RandomCelebration2_lcupnb',    'w_900,f_auto,q_auto'),
  randomCelebration3: cloudinaryUrl('Randomcelebration3_jtwx11',    'w_900,f_auto,q_auto'),
  postTeamFamily:     cloudinaryUrl('PostTeamFamily_kfcpgv',        'w_900,f_auto,q_auto'),
  yearEndParty:       cloudinaryUrl('YearEndParty_qvtoww',          'w_900,f_auto,q_auto'),
  overseasRiser:      cloudinaryUrl('overseas_riser_1',             'w_900,f_auto,q_auto'),
  australiaMeetRisers:cloudinaryUrl('Australia_meetrisers_tmcivh',  'w_900,f_auto,q_auto'),
  memoryOld:          cloudinaryUrl('Memory_Old_zccldv',            'w_900,f_auto,q_auto'),
  memoryOld1:         cloudinaryUrl('Memory_Old1_wwinas',           'w_900,f_auto,q_auto'),
  memoryOld2:         cloudinaryUrl('Memory_Old2_gab4xk',           'w_900,f_auto,q_auto'),
  memoryOld3:         cloudinaryUrl('Memory_Old3_lpwvgv',           'w_900,f_auto,q_auto'),
  yplTeamFamily:      cloudinaryUrl('YPL_teamnfamily_o2euyw',        'w_900,f_auto,q_auto'),
};

// Thumbnail (grid card) versions — w_400
const THUMBS = {
  trophyMoment2:      cloudinaryUrl('trophy_moment_2',              'w_400,c_fill,f_auto,q_auto'),
  trophyMoment:       cloudinaryUrl('Trophy_Moment_1',              'w_400,c_fill,f_auto,q_auto'),
  farewellMoment:     cloudinaryUrl('farewell_moment',              'w_400,c_fill,f_auto,q_auto'),
  farewellAB:         cloudinaryUrl('Farewell_AB_eo35my',           'w_400,c_fill,f_auto,q_auto'),
  matchDayMoment:     cloudinaryUrl('Match_Day_Moment_1',           'w_400,c_fill,f_auto,q_auto'),
  dressingRoom:       cloudinaryUrl('dressing_room_1',              'w_400,c_fill,f_auto,q_auto'),
  awardsNight2016:    cloudinaryUrl('Awards_night2016_jbwmi3',      'w_400,c_fill,f_auto,q_auto'),
  randomCelebration:  cloudinaryUrl('RandomCelebration_lnyrms',     'w_400,c_fill,f_auto,q_auto'),
  randomCelebration2: cloudinaryUrl('RandomCelebration2_lcupnb',    'w_400,c_fill,f_auto,q_auto'),
  randomCelebration3: cloudinaryUrl('Randomcelebration3_jtwx11',    'w_400,c_fill,f_auto,q_auto'),
  postTeamFamily:     cloudinaryUrl('PostTeamFamily_kfcpgv',        'w_400,c_fill,f_auto,q_auto'),
  yearEndParty:       cloudinaryUrl('YearEndParty_qvtoww',          'w_400,c_fill,f_auto,q_auto'),
  overseasRiser:      cloudinaryUrl('overseas_riser_1',             'w_400,c_fill,f_auto,q_auto'),
  australiaMeetRisers:cloudinaryUrl('Australia_meetrisers_tmcivh',  'w_400,c_fill,f_auto,q_auto'),
  memoryOld:          cloudinaryUrl('Memory_Old_zccldv',            'w_400,c_fill,f_auto,q_auto'),
  memoryOld1:         cloudinaryUrl('Memory_Old1_wwinas',           'w_400,c_fill,f_auto,q_auto'),
  memoryOld2:         cloudinaryUrl('Memory_Old2_gab4xk',           'w_400,c_fill,f_auto,q_auto'),
  memoryOld3:         cloudinaryUrl('Memory_Old3_lpwvgv',           'w_400,c_fill,f_auto,q_auto'),
  yplTeamFamily:      cloudinaryUrl('YPL_teamnfamily_o2euyw',        'w_400,c_fill,f_auto,q_auto'),
};

// ── Data — update these arrays/objects to add real content later ──────────────

const TIMELINE_ITEMS = [
  { era: 'The Early Days',         icon: '🌱', color: '#16a34a', description: 'Around 2014, a shared passion for cricket in Singapore brought together a group of working colleagues who were eager to continue playing the sport they loved. With limited awareness of cricket facilities in a new country, the group started with tennis-ball cricket — and from that simple beginning, the team known as Changi Risers was born.' },
  { era: 'Building the Core',      icon: '🏗️', color: '#0066cc', description: 'The core of Changi Risers was built by many passionate contributors, and no list can ever fully capture everyone who shaped the early journey. Among the noticeable names were Shailesh Sir, fondly known as Chacha; Gajendra, or Gajju, who continues to play and keep the Risers energy high; Abhijeet, or Abhi, now enjoying life as a retired family man; Sheetanshu, known as Sheetu, now settled in Europe; and Ahsan, the team\'s rare left-arm fast bowler, now settled back in his homeland.' },
  { era: 'Growing Across Leagues', icon: '🏟️', color: '#7c3aed', description: 'From weekend tennis-ball cricket played for pure joy, Changi Risers gradually moved into Singapore\'s competitive leather-ball cricket leagues. With limited equipment, one shared cricket kit funded through player contributions, and plenty of belief, the Risers began a journey in professional cricket that the club proudly continues even today.' },
  { era: 'Memorable Seasons',      icon: '🏆', color: '#d97706', description: 'Changi Risers entered the professional league in 2015 with limited equipment, developing skills, and little awareness of the competitive setup — but with unmatched team spirit, belief, and the determination to never quit. In a short span, the Risers progressed from beginners in 2015, to a mid-table side in 2016, to strong competitors in 2017, and eventually division winners in 2018 under the leadership of Kapil, fondly known as Warne.' },
  { era: 'The Data Era',           icon: '📊', color: '#0891b2', description: 'After Changi Risers began establishing themselves in Singapore\'s cricketing circuit, the COVID period changed the rhythm of the game and saw many players represent different teams, including as foreign players. As cricket resumed and the club continued to evolve, the need for transparent selection discussions and consistent player data became more important. In an increasingly analytical cricketing world, this gave rise to the idea of creating a dedicated platform to preserve and present uniform statistics for players connected to the Risers journey.' },
  { era: 'The Future',             icon: '🚀', color: '#dc2626', description: 'The future may never be certain, but the purpose of Changi Risers remains clear — to build a team of like-minded individuals who value cricket, sportsmanship, friendship, and togetherness. As the club moves ahead, the goal is to grow as a family while staying competitive, committed, and proud on the cricket field.' },
];

// Single source of truth for all Legacy & Legends categories
const LEGACY_CATEGORIES = [
  {
    id:               'founding-contributors',
    cardTitle:        'Founding Contributor',
    title:            'Founding Contributors',
    contributionType: 'Club Foundation',
    icon:             '🏗️',
    accentColor:      '#0066cc',
    ctaLabel:         'View Founding Contributors',
    cardTribute:      'A tribute story will be added here to honour the role in establishing the Changi Risers identity and spirit from the very beginning.',
    detailDescription:'Honouring the early contributors who helped establish the Changi Risers identity, spirit, and foundation.',
    people: [
      { name: 'Shailesh Thakur',       role: 'Founding Contributor', photo: 'shailesh_fm' },
      { name: 'Gajendra Agarwal',      role: 'Founding Contributor', photo: 'Gajendra_fc_o4xaqe' },
      { name: 'Sheetanshu Srivastava', role: 'Founding Contributor', photo: 'sheetu_fc' },
      { name: 'Ahsan Nabi Dar',        role: 'Founding Contributor', photo: 'Ahsan_di1dec' },
      { name: 'Abhijeet Joshi',        role: 'Founding Contributor', photo: 'Abhijeetjoshi_ccwl8q' },
    ],
  },
  {
    id:               'former-captains',
    cardTitle:        'Former Captain',
    title:            'Former Captains',
    contributionType: 'Leadership & Team Culture',
    icon:             '🎯',
    accentColor:      '#7c3aed',
    ctaLabel:         'View Former Captains',
    cardTribute:      'A tribute story will be added here to honour leadership, commitment, and contribution to the Risers journey across seasons.',
    detailDescription:'Recognising the leaders who guided the team, shaped culture, and carried responsibility across seasons.',
    people: [
      { name: 'Gajendra Agarwal',      role: 'Former Captain',           photo: 'Gajendra_fc_o4xaqe' },
      { name: 'Sheetanshu Srivastava', role: 'Former Captain',           photo: 'sheetu_fc' },
      { name: 'Kapil Arora',           role: 'Former Captain',           photo: 'Kapil_FC' },
      { name: 'Gaurav Khandelwal',     role: 'Former Captain',           photo: 'Gaurav_Khandelwal_xqgfes' },
      { name: 'Kintul Mistry',         role: 'Former & Current Captain', photo: 'kintul_FC' },
    ],
  },
  {
    id:               'match-winners',
    cardTitle:        'Match Winner',
    title:            'Match Winners',
    contributionType: 'Clutch Performances',
    icon:             '🏆',
    accentColor:      '#d97706',
    ctaLabel:         'View Match Winners',
    cardTribute:      'A tribute story will be added here to honour the match-defining moments, innings, and spells that won games for the Risers.',
    detailDescription:'Celebrating the players who created defining moments with bat, ball, fielding, and pressure performances.',
    people: [
      { name: 'Vikram Singh Salaria',  role: 'Match Winner', photo: 'vicky_mw1_jtjrmz' },
      { name: 'Pradipta Mishra',       role: 'Match Winner', photo: null },
      { name: 'Kintul Mistry',         role: 'Match Winner', photo: 'kintul_FC' },
      { name: 'Kapil Arora',           role: 'Match Winner', photo: 'Kapil_FC' },
      { name: 'Sheetanshu Srivastava', role: 'Match Winner', photo: 'sheetu_fc' },
      { name: 'Ahsan Nabi Dar',        role: 'Match Winner', photo: 'Ahsan_di1dec' },
      { name: 'Santhosh Dommety',      role: 'Match Winner', photo: 'SanthoshDommety_mw1_qi2jdt' },
      { name: 'Gururaj Banakar',       role: 'Match Winner', photo: 'gururaj_banakar_fm4ylt' },
      { name: 'Akhil Kukreja',         role: 'Match Winner', photo: 'Akhil_Kukreja_daldps' },
      { name: 'Harsha Sharma',         role: 'Match Winner', photo: null },
      { name: 'Arvind Bajaj',          role: 'Match Winner', photo: 'arvindbajaj_mw1_cnsduv' },
      { name: 'Vipin Jha',             role: 'Match Winner', photo: 'vipin_mw1_mjpav5' },
    ],
  },
  {
    id:               'team-builders',
    cardTitle:        'Team Builder',
    title:            'Team Builders',
    contributionType: 'Culture & Bonding',
    icon:             '🤝',
    accentColor:      '#16a34a',
    ctaLabel:         'View Team Builders',
    cardTribute:      'A tribute story will be added here to honour the effort that went into building team culture, trust, and lasting friendships.',
    detailDescription:'Respecting those who strengthened bonding, culture, trust, and togetherness within the Risers family.',
    people: [
      { name: 'Gaurav Khandelwal',     role: 'Team Builder', photo: 'Gaurav_Khandelwal_xqgfes' },
      { name: 'Amol Babu',             role: 'Team Builder', photo: 'Amolbabu_ippt6f' },
      { name: 'Kintul Mistry',         role: 'Team Builder', photo: 'kintul_FC' },
      { name: 'Kapil Arora',           role: 'Team Builder', photo: 'Kapil_FC' },
      { name: 'Sheetanshu Srivastava', role: 'Team Builder', photo: 'sheetu_fc' },
      { name: 'Vivek Singh',           role: 'Team Builder', photo: 'viveksingh_cc_tfkeyj' },
    ],
  },
  {
    id:               'overseas-risers',
    cardTitle:        'Overseas Riser',
    title:            'Overseas Risers',
    contributionType: 'Global Riser Community',
    icon:             '✈️',
    accentColor:      '#0891b2',
    ctaLabel:         'View Overseas Risers',
    cardTribute:      'A tribute story will be added here for a Riser who moved overseas but remains part of the club spirit and legacy forever.',
    detailDescription:'Remembering Risers who moved abroad but remain part of the club\'s journey, memories, and legacy.',
    people: [
      { name: 'Santhosh Dommety',      role: 'Overseas Riser', photo: 'SanthoshDommety_mw1_qi2jdt' },
      { name: 'Gaurav Khandelwal',     role: 'Overseas Riser', photo: 'Gaurav_Khandelwal_xqgfes' },
      { name: 'Sheetanshu Srivastava', role: 'Overseas Riser', photo: 'sheetu_fc' },
      { name: 'Vivek Bhat',            role: 'Overseas Riser', photo: 'vivekbhat_OR_sitksv' },
      { name: 'Akhil Kukreja',         role: 'Overseas Riser', photo: 'Akhil_Kukreja_daldps' },
      { name: 'Zubin Patel',           role: 'Overseas Riser', photo: null },
      { name: 'Harsha Sharma',         role: 'Overseas Riser', photo: null },
    ],
  },
  {
    id:               'complete-squad',
    cardTitle:        'Complete Squad',
    title:            'Complete Squad',
    contributionType: 'Every Riser, Ever',
    icon:             '🏏',
    accentColor:      '#0891b2',
    ctaLabel:         'View Complete Squad',
    cardTribute:      'Every Riser who has worn the colours, contributed to the journey, or been part of the Changi Risers family.',
    detailDescription:'Every player who has been part of the Changi Risers journey — past, present, and those who made it all possible.',
    people: [
      { name: 'Shailesh Thakur',       role: 'Changi Riser', photo: 'shailesh_fm' },
      { name: 'Gajendra Agarwal',      role: 'Changi Riser', photo: 'Gajendra_fc_o4xaqe' },
      { name: 'Sheetanshu Srivastava', role: 'Changi Riser', photo: 'sheetu_fc' },
      { name: 'Ahsan Nabi Dar',        role: 'Changi Riser', photo: 'Ahsan_di1dec' },
      { name: 'Abhijeet Joshi',        role: 'Changi Riser', photo: 'Abhijeetjoshi_ccwl8q' },
      { name: 'Kapil Arora',           role: 'Changi Riser', photo: 'Kapil_FC' },
      { name: 'Kintul Mistry',         role: 'Changi Riser', photo: 'kintul_FC' },
      { name: 'Vikram Singh Salaria',  role: 'Changi Riser', photo: 'vicky_mw1_jtjrmz' },
      { name: 'Pradipta Mishra',       role: 'Changi Riser', photo: null },
      { name: 'Santhosh Dommety',      role: 'Changi Riser', photo: 'SanthoshDommety_mw1_qi2jdt' },
      { name: 'Gururaj Banakar',       role: 'Changi Riser', photo: 'gururaj_banakar_fm4ylt' },
      { name: 'Akhil Kukreja',         role: 'Changi Riser', photo: 'Akhil_Kukreja_daldps' },
      { name: 'Harsha Sharma',         role: 'Changi Riser', photo: null },
      { name: 'Arvind Bajaj',          role: 'Changi Riser', photo: 'arvindbajaj_mw1_cnsduv' },
      { name: 'Vipin Jha',             role: 'Changi Riser', photo: 'vipin_mw1_mjpav5' },
      { name: 'Gaurav Khandelwal',     role: 'Changi Riser', photo: 'Gaurav_Khandelwal_xqgfes' },
      { name: 'Amol Babu',             role: 'Changi Riser', photo: 'Amolbabu_ippt6f' },
      { name: 'Vivek Singh',           role: 'Changi Riser', photo: 'viveksingh_cc_tfkeyj' },
      { name: 'Vivek Bhat',            role: 'Changi Riser', photo: 'vivekbhat_OR_sitksv' },
      { name: 'Zubin Patel',           role: 'Changi Riser', photo: null },
      { name: 'Samveg Jain',           role: 'Changi Riser', photo: null },
      { name: 'Pramod Gururaj',        role: 'Changi Riser', photo: 'Pramod_Gururaj_qbmjtg' },
      { name: 'Akshay Thakre',         role: 'Changi Riser', photo: null },
      { name: 'Mithun Ruikar',         role: 'Changi Riser', photo: 'Mithun_Ruikar_fxzdyi' },
      { name: 'Deepak Waghmare',       role: 'Changi Riser', photo: null },
      { name: 'Pramod Rane',           role: 'Changi Riser', photo: null },
      { name: 'Bharat Bhatta',         role: 'Changi Riser', photo: 'BharatBHatta_ifmfqa' },
      { name: 'Kiran Salke',           role: 'Changi Riser', photo: 'Kiran_Salke_djzq7b' },
      { name: 'Kshitij Godbole',       role: 'Changi Riser', photo: 'KshitijGodbole_gguyds' },
      { name: 'Rishit Mehta',          role: 'Changi Riser', photo: null },
      { name: 'Vineet Kulkarni',       role: 'Changi Riser', photo: null },
      { name: 'Ramyajit Brahma',       role: 'Changi Riser', photo: null },
      { name: 'Shrikanth Bhoyar',      role: 'Changi Riser', photo: 'Shrikanth_Bhoyar_fxanvy' },
      { name: 'Abdul',                 role: 'Changi Riser', photo: null },
      { name: 'Rohan Rangarajan',      role: 'Changi Riser', photo: null },
      { name: 'Yogesh Kulkarni',       role: 'Changi Riser', photo: null },
      { name: 'Rob Hrvatin',           role: 'Changi Riser', photo: null },
      { name: 'Irfan Makadia',         role: 'Changi Riser', photo: null },
      { name: 'Sreejith Vakkyl',       role: 'Changi Riser', photo: null },
      { name: 'Amit Aneja',            role: 'Changi Riser', photo: null },
      { name: 'Shobit Sharma',         role: 'Changi Riser', photo: null },
      { name: 'Logan',                 role: 'Changi Riser', photo: 'Logan_j80xc0' },
      { name: 'Abhinav Gupta',         role: 'Changi Riser', photo: null },
      { name: 'Amit Dubey',            role: 'Changi Riser', photo: null },
      { name: 'Pavan Joshi',           role: 'Changi Riser', photo: null },
      { name: 'Arvind Pednekar',       role: 'Changi Riser', photo: null },
      { name: 'Priyanshu Rawat',       role: 'Changi Riser', photo: null },
      { name: 'Sagar Waghunde',        role: 'Changi Riser', photo: null },
      { name: 'Srini Donabanu',        role: 'Changi Riser', photo: null },
      { name: 'Shrikant Krishnan',     role: 'Changi Riser', photo: null },
      { name: 'Kiran',                 role: 'Changi Riser', photo: null },
      { name: 'Napo',                  role: 'Changi Riser', photo: null },
      { name: 'Suresha',               role: 'Changi Riser', photo: 'Suresha_zvmy4b' },
      { name: 'Ayush Damani',          role: 'Changi Riser', photo: null },
      { name: 'Vinay Rohira',          role: 'Changi Riser', photo: null },
      { name: 'Shrikant Akkina',       role: 'Changi Riser', photo: null },
      { name: 'Bharat Khurana',        role: 'Changi Riser', photo: null },
      { name: 'Uday Bhaskar',          role: 'Changi Riser', photo: null },
      { name: 'Vaidy',                 role: 'Changi Riser', photo: null },
      { name: 'Abhishek Sharma',       role: 'Changi Riser', photo: null },
      { name: 'Prashray',              role: 'Changi Riser', photo: null },
      { name: 'Aditya Bhanushali',     role: 'Changi Riser', photo: null },
      { name: 'Sachin Jawale',         role: 'Changi Riser', photo: null },
      { name: 'Rajeev Shetty',         role: 'Changi Riser', photo: null },
      { name: 'Sunil Rao',             role: 'Changi Riser', photo: null },
      { name: 'Abhijit Kulkarni',      role: 'Changi Riser', photo: null },
      { name: 'Surya',                 role: 'Changi Riser', photo: null },
      { name: 'Dharmesh Rawal',        role: 'Changi Riser', photo: null },
      { name: 'Jayaraman Sagadevan',   role: 'Changi Riser', photo: 'ayaraman_sagadevan_fhnrfg' },
      { name: 'Shoaib',                role: 'Changi Riser', photo: null },
      { name: 'Raghuveer Singh',       role: 'Changi Riser', photo: null },
    ],
  },
  {
    id:               'silent-contributors',
    cardTitle:        'Silent Contributor',
    title:            'Silent Contributors',
    contributionType: 'Off-Field Dedication',
    icon:             '💪',
    accentColor:      '#475569',
    ctaLabel:         'View Silent Contributors',
    cardTribute:      'A tribute story will be added here for someone who contributed behind the scenes — organising, supporting, and making things happen.',
    detailDescription:'Recognising those who contributed behind the scenes — organising, supporting, helping, and making things happen.',
    people: [
      { name: 'Amol Babu',            role: 'Silent Contributor', photo: 'Amolbabu_ippt6f' },
      { name: 'Samveg Jain',          role: 'Silent Contributor', photo: null },
      { name: 'Vikram Singh Salaria', role: 'Silent Contributor', photo: 'vicky_mw1_jtjrmz' },
      { name: 'Pramod Gururaj',       role: 'Silent Contributor', photo: 'Pramod_Gururaj_qbmjtg' },
      { name: 'Vipin Jha',            role: 'Silent Contributor', photo: 'vipin_mw1_mjpav5' },
      { name: 'List to be added', role: '', tribute: '', photo: null, isPlaceholder: true },
    ],
  },
  {
    id:               'current-core-players',
    cardTitle:        'Current Core Player',
    title:            'Current Core Players',
    contributionType: 'Present-Day Riser',
    icon:             '⭐',
    accentColor:      '#dc2626',
    ctaLabel:         'View Current Core Players',
    cardTribute:      'A tribute story will be added here to celebrate an active contributor carrying the Changi Risers identity forward today.',
    detailDescription:'Celebrating the present-day Risers who continue to carry the club identity forward on and off the field.',
    people: [
      { name: 'Kintul Mistry',        role: 'Current Core Player', photo: 'kintul_FC' },
      { name: 'Vikram Singh Salaria', role: 'Current Core Player', photo: 'vicky_mw1_jtjrmz' },
      { name: 'Pradipta Mishra',      role: 'Current Core Player', photo: null },
      { name: 'Gajendra Agrawal',     role: 'Current Core Player', photo: 'Gajendra_fc_o4xaqe' },
      { name: 'Vivek Singh',          role: 'Current Core Player', photo: 'viveksingh_cc_tfkeyj' },
      { name: 'Akshay Thakre',        role: 'Current Core Player', photo: null },
    ],
  },
];

const MEMORY_ITEMS = [
  {
    id: 'trophy-moment',      title: 'Trophy Moment',
    icon: '🏆',               status: 'available',
    image:     IMAGES.trophyMoment2,
    thumbnail: THUMBS.trophyMoment2,
    alt:  'Changi Risers team celebrating with a trophy',
    caption: 'Lifting the trophy — a moment that defines what Risers play for.',
  },
  {
    id: 'team-photos',        title: 'Team Photos',
    icon: '👥',               status: 'available',
    photos: [
      { image: IMAGES.trophyMoment,  thumbnail: THUMBS.trophyMoment,  alt: 'Changi Risers squad in white cricket kit',  caption: 'Risers in whites — a day to remember on the field.',     title: 'Team Photo' },
      { image: IMAGES.memoryOld,     thumbnail: THUMBS.memoryOld,     alt: 'Changi Risers team photo',                  caption: 'A Risers team memory from the early days.',              title: 'Team Photo' },
      { image: IMAGES.memoryOld1,    thumbnail: THUMBS.memoryOld1,    alt: 'Changi Risers team photo',                  caption: 'A Risers team memory from the early days.',              title: 'Team Photo' },
      { image: IMAGES.memoryOld2,    thumbnail: THUMBS.memoryOld2,    alt: 'Changi Risers team photo',                  caption: 'A Risers team memory from the early days.',              title: 'Team Photo' },
      { image: IMAGES.memoryOld3,    thumbnail: THUMBS.memoryOld3,    alt: 'Changi Risers team photo',                  caption: 'A Risers team memory from the early days.',              title: 'Team Photo' },
    ],
  },
  {
    id: 'farewell-memories',  title: 'Farewell Memories',
    icon: '✈️',               status: 'available',
    photos: [
      { image: IMAGES.farewellMoment, thumbnail: THUMBS.farewellMoment, alt: 'Farewell moment with Changi Risers', caption: 'Saying goodbye is never easy — but a Suresha always remains a Riser.', title: 'Farewell Memory' },
      { image: IMAGES.farewellAB,     thumbnail: THUMBS.farewellAB,     alt: 'Farewell moment with Changi Risers', caption: 'Another farewell memory — a Riser always remains a Riser.',            title: 'Farewell Memory' },
    ],
  },
  {
    id: 'match-day-moment',   title: 'Match-Day Moment',
    icon: '🏏',               status: 'available',
    image:     IMAGES.matchDayMoment,
    thumbnail: THUMBS.matchDayMoment,
    alt:  'Changi Risers in navy and gold jerseys after a match',
    caption: 'One of the best fights by Risers to defend against power hitters.',
  },
  {
    id: 'dressing-room-story', title: 'Dressing-Room Story',
    icon: '🧢',                status: 'available',
    photos: [
      { image: IMAGES.dressingRoom,       thumbnail: THUMBS.dressingRoom,       alt: 'Changi Risers dressing room moment',    caption: 'A dressing-room memory from the Risers.',           title: 'Dressing-Room Story' },
      { image: IMAGES.awardsNight2016,    thumbnail: THUMBS.awardsNight2016,    alt: 'Changi Risers Awards Night 2016',       caption: 'Awards Night 2016 — celebrating the Risers way.',   title: 'Awards Night 2016' },
      { image: IMAGES.randomCelebration,  thumbnail: THUMBS.randomCelebration,  alt: 'Changi Risers celebration moment',      caption: 'A celebration moment — Risers never miss a chance to enjoy together.', title: 'Celebration' },
      { image: IMAGES.randomCelebration2, thumbnail: THUMBS.randomCelebration2, alt: 'Changi Risers celebration moment',      caption: 'Good times, great memories.',                        title: 'Celebration' },
      { image: IMAGES.randomCelebration3, thumbnail: THUMBS.randomCelebration3, alt: 'Changi Risers celebration moment',      caption: 'Risers celebrate — on and off the field.',           title: 'Celebration' },
      { image: IMAGES.postTeamFamily,     thumbnail: THUMBS.postTeamFamily,     alt: 'Changi Risers post-match team family',  caption: 'Post-match family time — the Risers bond beyond cricket.', title: 'Team Family' },
      { image: IMAGES.yearEndParty,       thumbnail: THUMBS.yearEndParty,       alt: 'Changi Risers year-end party',          caption: 'Year-end party — toasting another great season together.', title: 'Year-End Party' },
      { image: IMAGES.yplTeamFamily,      thumbnail: THUMBS.yplTeamFamily,      alt: 'YPL team and family moment',            caption: 'YPL — where cricket meets family.',                   title: 'YPL Team & Family' },
    ],
  },
  {
    id: 'overseas-riser-memory', title: 'Overseas Riser Memory',
    icon: '🌏',                  status: 'available',
    photos: [
      { image: IMAGES.overseasRiser,       thumbnail: THUMBS.overseasRiser,       alt: 'Overseas Riser memory',                       caption: 'A memory from an overseas Riser.',                       title: 'Overseas Riser Memory' },
      { image: IMAGES.australiaMeetRisers, thumbnail: THUMBS.australiaMeetRisers, alt: 'Changi Risers meet-up in Australia',           caption: 'Risers in Australia — the bond travels across borders.', title: 'Australia Meet' },
    ],
  },
];

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Section({ children, bg = '#f4f7fb', style = {} }) {
  return (
    <section style={{ padding: 'clamp(2.5rem, 6vw, 4rem) 1.5rem', backgroundColor: bg, ...style }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>{children}</div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, body, light = false }) {
  return (
    <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
      {eyebrow && (
        <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.18em', textTransform: 'uppercase', color: light ? '#93c5fd' : '#0066cc', marginBottom: '0.5rem' }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: '800', color: light ? '#f1f5f9' : '#1e293b', margin: '0 0 0.75rem 0', lineHeight: '1.25', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      {body && (
        <p style={{ fontSize: '15px', color: light ? '#cbd5e1' : '#64748b', maxWidth: '620px', margin: '0 auto', lineHeight: '1.75' }}>
          {body}
        </p>
      )}
    </div>
  );
}

// ── Category Detail View ───────────────────────────────────────────────────────

function CategoryDetailView({ category, onBack }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);

  const lightboxPhotos = category.people
    .filter(p => p.photo)
    .map(p => ({
      id:        p.name,
      title:     p.name,
      alt:       p.name,
      caption:   p.role,
      image:     cloudinaryUrl(p.photo, 'w_900,f_auto,q_auto'),
      thumbnail: cloudinaryUrl(p.photo, 'w_200,h_200,c_fill,f_auto,q_auto'),
    }));

  const openLightbox = (person) => {
    const idx = lightboxPhotos.findIndex(p => p.id === person.name);
    if (idx !== -1) setLightboxIdx(idx);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '80vh', color: '#fff' }}>
      {lightboxIdx !== null && (
        <LightboxModal
          photos={lightboxPhotos}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* Back bar */}
      <div style={{ backgroundColor: '#0a1120', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0.9rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '7px', padding: '0.45rem 1rem',
              color: '#94a3b8', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            ← Back to The Riser Wall
          </button>
        </div>
      </div>

      {/* Category hero */}
      <div style={{ padding: 'clamp(2.5rem, 6vw, 4rem) 1.5rem', borderBottom: `1px solid ${category.accentColor}20`, textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ fontSize: '52px', marginBottom: '1.1rem' }}>{category.icon}</div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: category.accentColor, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {category.contributionType}
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '900', color: '#f1f5f9', margin: '0 0 1rem 0', lineHeight: '1.15' }}>
            {category.title}
          </h1>
          <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '540px', margin: '0 auto', lineHeight: '1.85' }}>
            {category.detailDescription}
          </p>
          {category.id === 'complete-squad' && (() => {
            const count = category.people.filter(p => !p.isPlaceholder).length;
            return (
              <div style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', backgroundColor: `${category.accentColor}18`, border: `1px solid ${category.accentColor}40`, borderRadius: '999px', padding: '0.45rem 1.25rem' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: category.accentColor }}>Risers So Far</span>
                <span style={{ width: '1px', height: '14px', backgroundColor: `${category.accentColor}40` }} />
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#f1f5f9' }}>{count}</span>
                <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>Work in Progress</span>
              </div>
            );
          })()}
          <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: '32px', height: '2px', backgroundColor: category.accentColor, borderRadius: '1px' }} />
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: category.accentColor }} />
            <div style={{ width: '32px', height: '2px', backgroundColor: category.accentColor, borderRadius: '1px' }} />
          </div>
        </div>
      </div>

      {/* Person cards grid */}
      <div style={{ padding: 'clamp(2rem, 5vw, 3.5rem) 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {category.people.map((person, i) => {
              if (person.isPlaceholder) {
                return (
                  <div key={i} style={{
                    backgroundColor: 'transparent', borderRadius: '14px',
                    border: `1px dashed ${category.accentColor}25`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '2rem 1.25rem', gap: '0.6rem',
                    minHeight: '180px',
                  }}>
                    <div style={{ fontSize: '22px', opacity: 0.3 }}>＋</div>
                    <div style={{ fontSize: '12px', color: '#334155', fontStyle: 'italic', textAlign: 'center', lineHeight: '1.6' }}>
                      More names will be added here over time.
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} style={{
                  backgroundColor: '#1e293b', borderRadius: '14px',
                  border: `1px solid ${category.accentColor}28`,
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px ${category.accentColor}10`,
                }}>
                  {/* Photo area — shows Cloudinary image when available, initial avatar when not */}
                  <div style={{ height: '150px', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderBottom: `1px solid ${category.accentColor}18` }}>
                    {person.photo ? (
                      <button
                        onClick={() => openLightbox(person)}
                        aria-label={`View photo of ${person.name}`}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
                      >
                        <img
                          src={cloudinaryUrl(person.photo, 'w_200,h_200,c_fill,f_auto,q_auto')}
                          alt={person.name}
                          loading="lazy"
                          style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${category.accentColor}50`, display: 'block', transition: 'transform 0.15s', }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        />
                      </button>
                    ) : (
                      <>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: category.accentColor + '15', border: `2px dashed ${category.accentColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '700', color: category.accentColor }}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#334155', fontStyle: 'italic' }}>Photo coming soon</div>
                      </>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#f1f5f9', marginBottom: '0.3rem' }}>{person.name}</div>
                    <div style={{ fontSize: '10px', color: category.accentColor, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.65rem' }}>{person.role}</div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.75', margin: '0 0 1rem 0', flex: 1 }}>{person.tribute}</p>
                    <div style={{ fontSize: '10px', color: '#334155', fontStyle: 'italic' }}>Story coming soon</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic' }}>
              Real names, photos, and tribute stories will be updated here. This list is not exhaustive — more names will be added over time.
            </p>
          </div>

          {/* Bottom back button */}
          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <button
              onClick={onBack}
              style={{
                backgroundColor: category.accentColor, color: '#fff', border: 'none',
                borderRadius: '8px', padding: '0.8rem 2rem',
                fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                boxShadow: `0 4px 14px ${category.accentColor}40`,
              }}
            >
              ← Back to The Riser Wall
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page sections ──────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 55%, #0f172a 100%)',
      padding: 'clamp(3rem, 9vw, 6rem) 1.5rem',
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', backgroundColor: 'rgba(99,179,237,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', backgroundColor: 'rgba(245,158,11,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', maxWidth: '780px', margin: '0 auto' }}>
        <div style={{ fontSize: '56px', marginBottom: '1.25rem', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>🏏</div>
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#93c5fd', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
          Changi Risers Cricket
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: '900', color: '#f1f5f9', margin: '0 0 1.25rem 0', lineHeight: '1.1', letterSpacing: '-0.02em' }}>
          Risers Legacy
        </h1>
        <div style={{ fontSize: 'clamp(15px, 2.5vw, 19px)', color: '#f59e0b', fontWeight: '700', fontStyle: 'italic', marginBottom: '1.5rem', lineHeight: '1.4' }}>
          "Built by Players. Remembered as Riser."
        </div>
        <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '580px', margin: '0 auto 2.5rem', lineHeight: '1.85' }}>
          Honouring the people, memories, milestones, and numbers that shaped Changi Risers Cricket — from the early days to the future ahead.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '40px', height: '2px', backgroundColor: '#f59e0b', borderRadius: '1px' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <div style={{ width: '40px', height: '2px', backgroundColor: '#f59e0b', borderRadius: '1px' }} />
        </div>
      </div>
    </div>
  );
}

function WhyThisExists() {
  return (
    <Section bg="#0a1628">
      <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '1.25rem' }}>❤️</div>
        <SectionHeading eyebrow="Our Purpose" title="Why This Page Exists" light />
        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: '1.9', marginBottom: '1.25rem' }}>
          Changi Risers Cricket is more than a team name. It is a journey built by players, captains, organisers, supporters, mentors, and friends who contributed across seasons.
        </p>
        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: '1.9', marginBottom: '1.25rem' }}>
          Some continue to play. Some have moved overseas. Some may no longer be active — but their role in shaping the club deserves to be remembered with respect.
        </p>
        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: '1.9' }}>
          This page exists to honour <strong style={{ color: '#e2e8f0' }}>everyone who meaningfully contributed to Changi Risers</strong> — not only top performers, but every player, volunteer, and supporter who helped build this club into what it is today.
        </p>
        <div style={{ marginTop: '2.25rem', padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 1.75rem)', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: '12px', borderLeft: '4px solid #3b82f6', textAlign: 'left' }}>
          <p style={{ fontSize: '15px', color: '#93c5fd', fontStyle: 'italic', margin: 0, lineHeight: '1.8', fontWeight: '500' }}>
            "A club's legacy is not written by wins alone. It is written by the people who showed up, believed in each other, and made every match worth playing."
          </p>
        </div>
      </div>
    </Section>
  );
}

function JourneySoFar() {
  return (
    <Section bg="#0a1628">
      <SectionHeading
        eyebrow="Club History"
        title="The Journey So Far"
        body="From the very first match to the platform you are reading right now — the Changi Risers story has been built one season at a time."
        light
      />
      <div style={{ maxWidth: '660px', margin: '0 auto', position: 'relative', paddingLeft: 'clamp(1.75rem, 5vw, 2.5rem)' }}>
        <div style={{ position: 'absolute', left: '0.6rem', top: '0.8rem', bottom: '0.8rem', width: '2px', background: 'linear-gradient(to bottom, #3b82f6 0%, rgba(59,130,246,0.1) 100%)' }} />
        {TIMELINE_ITEMS.map((item, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: i < TIMELINE_ITEMS.length - 1 ? '2rem' : 0 }}>
            <div style={{ position: 'absolute', left: '-2.05rem', top: '0.3rem', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: item.color, border: '3px solid #0a1628', boxShadow: `0 0 0 2px ${item.color}` }} />
            <div style={{ backgroundColor: '#111e35', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#e2e8f0' }}>{item.era}</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.7' }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LegendsWall({ onSelectCategory }) {
  return (
    <Section bg="#0f172a">
      <SectionHeading
        eyebrow="The Riser Wall"
        title="The Riser Wall"
        body="Risers are remembered not only for performances, but for contribution, leadership, loyalty, culture, and the moments they created on and off the field."
        light
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))', gap: '1.25rem' }}>
        {LEGACY_CATEGORIES.map((cat) => (
          <div key={cat.id} style={{ backgroundColor: '#1e293b', borderRadius: '14px', border: `1px solid ${cat.accentColor}30`, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
            <div style={{ height: '140px', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderBottom: `1px solid ${cat.accentColor}20` }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: cat.accentColor + '18', border: `2px dashed ${cat.accentColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>
                {cat.icon}
              </div>
              <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>Photo coming soon</div>
            </div>
            <div style={{ padding: '1.1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: cat.accentColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>{cat.contributionType}</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#f1f5f9', marginBottom: '0.6rem' }}>{cat.cardTitle}</div>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.7', margin: '0 0 1rem 0', flex: 1 }}>{cat.cardTribute}</p>
              <button
                onClick={() => onSelectCategory(cat.id)}
                style={{
                  fontSize: '11px', color: cat.accentColor,
                  border: `1px solid ${cat.accentColor}45`,
                  borderRadius: '5px', padding: '0.4rem 0.8rem',
                  fontWeight: '700', cursor: 'pointer',
                  backgroundColor: cat.accentColor + '12',
                  alignSelf: 'flex-start', letterSpacing: '0.02em',
                  transition: 'background-color 0.15s',
                }}
              >
                {cat.ctaLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>
          Real names, photos, and tribute stories will be added as the Legacy Wall grows. Each card honours a meaningful contribution to Changi Risers.
        </p>
      </div>
    </Section>
  );
}

// ── Lightbox modal ─────────────────────────────────────────────────────────────

function LightboxModal({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const closeRef = useRef(null);
  const photo   = photos[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < photos.length - 1;

  useEffect(() => { closeRef.current?.focus(); }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape')     { onClose(); }
      if (e.key === 'ArrowLeft')  { setIdx(i => Math.max(0, i - 1)); }
      if (e.key === 'ArrowRight') { setIdx(i => Math.min(photos.length - 1, i + 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [photos.length, onClose]);

  const navBtn = (disabled) => ({
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '50%',
    width: '48px', height: '48px', minWidth: '48px',
    color: disabled ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
    fontSize: '28px', fontWeight: '300', lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing: ${photo.title}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(4,10,24,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '920px', width: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '0.9rem',
          maxHeight: 'calc(100vh - 2rem)',
        }}
      >
        {/* Top bar: counter + close */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600', letterSpacing: '0.06em' }}>
            {photos.length > 1 ? `${idx + 1} / ${photos.length}` : ''}
          </span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close photo viewer"
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '50%', width: '44px', height: '44px',
              color: '#e2e8f0', fontSize: '22px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Image with overlaid prev/next arrows */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={{
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
            backgroundColor: '#040a18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={photo.image}
              alt={photo.alt || photo.title}
              loading="lazy"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: 'calc(100vh - 160px)',
                objectFit: 'contain',
              }}
            />
          </div>
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setIdx(i => Math.max(0, i - 1))}
                disabled={!hasPrev}
                aria-label="Previous photo"
                style={{
                  ...navBtn(!hasPrev),
                  position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                }}
              >‹</button>
              <button
                onClick={() => setIdx(i => Math.min(photos.length - 1, i + 1))}
                disabled={!hasNext}
                aria-label="Next photo"
                style={{
                  ...navBtn(!hasNext),
                  position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                }}
              >›</button>
            </>
          )}
        </div>

        {/* Title + caption */}
        <div style={{ textAlign: 'center', padding: '0 0.5rem', maxWidth: '640px' }}>
          <div style={{ fontWeight: '700', color: '#f1f5f9', fontSize: '15px', marginBottom: '0.3rem' }}>{photo.title}</div>
          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.7', margin: 0 }}>{photo.caption}</p>
        </div>
      </div>
    </div>
  );
}

// ── Memories section ───────────────────────────────────────────────────────────

function MemoriesSection() {
  const [lightbox, setLightbox] = useState(null); // { photos, startIndex }

  const openLightbox = (item) => {
    if (item.photos) {
      setLightbox({ photos: item.photos, startIndex: 0 });
    } else {
      setLightbox({ photos: [{ image: item.image, thumbnail: item.thumbnail, alt: item.alt, caption: item.caption, title: item.title }], startIndex: 0 });
    }
  };

  const watermarkUrl = cloudinaryUrl('Background_watermark_o4gudo', 'w_1200,f_auto,q_auto');

  return (
    <Section bg="#f4f7fb" style={{
      position: 'relative',
      backgroundImage: `url(${watermarkUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center center',
      backgroundSize: 'cover',
    }}>
      {/* Watermark overlay — keeps background very subtle */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.88)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      {lightbox && (
        <LightboxModal
          photos={lightbox.photos}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
      )}
      <SectionHeading
        eyebrow="Club Memories"
        title="Memories Down the Lane"
        body="A gallery of team photos, match moments, farewells, and shared memories that define the Changi Risers journey. Tap any photo to view it."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.1rem' }}>
        {MEMORY_ITEMS.map((item) => {
          const isAvailable = item.status === 'available';
          const thumbnail = item.photos ? item.photos[0].thumbnail : item.thumbnail;
          const altText   = item.photos ? item.photos[0].alt : (item.alt || item.title);
          const count     = item.photos ? item.photos.length : null;
          return (
            <div
              key={item.id}
              style={{
                borderRadius: '12px', overflow: 'hidden',
                border: `1px solid ${isAvailable ? '#d0dae8' : '#e2e8f0'}`,
                backgroundColor: '#f8fafd',
                boxShadow: isAvailable ? '0 2px 10px rgba(6,28,84,0.1)' : '0 2px 8px rgba(6,28,84,0.04)',
              }}
            >
              {isAvailable ? (
                <button
                  onClick={() => openLightbox(item)}
                  aria-label={`View ${item.title}`}
                  style={{ display: 'block', width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ position: 'relative', paddingBottom: '62.5%', backgroundColor: '#dde6f0', overflow: 'hidden' }}>
                    <img
                      src={thumbnail}
                      alt={altText}
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {count && count > 1 && (
                      <div style={{ position: 'absolute', top: '0.45rem', left: '0.5rem', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px 7px', fontSize: '10px', color: '#fff', fontWeight: '600', letterSpacing: '0.03em' }}>
                        {count} photos
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: '0.45rem', right: '0.5rem', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: '4px', padding: '2px 7px', fontSize: '10px', color: '#fff', fontWeight: '600', letterSpacing: '0.03em' }}>
                      View ↗
                    </div>
                  </div>
                </button>
              ) : (
                <div style={{ position: 'relative', paddingBottom: '62.5%', backgroundColor: '#dde6f0' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '30px', opacity: 0.4 }}>{item.icon}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>Photo coming soon</span>
                  </div>
                </div>
              )}
              <div style={{ padding: '0.8rem 0.9rem' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '0.2rem' }}>{item.title}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>{item.photos ? item.photos[0].caption : item.caption}</div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </Section>
  );
}

function StatsWithRespect() {
  return (
    <Section bg="#edf2f8">
      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '1.25rem' }}>📊</div>
        <SectionHeading eyebrow="Stats & Story" title="Stats With Respect" body="Numbers are a part of the story — not the whole story." />
        <div style={{ backgroundColor: '#f8fafd', borderRadius: '14px', padding: 'clamp(1.25rem, 4vw, 2rem) clamp(1rem, 4vw, 2.25rem)', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(6,28,84,0.06)', textAlign: 'left' }}>
          <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9', marginBottom: '1.1rem' }}>
            The numbers on this site are not meant to reduce a player to statistics. They exist to <strong>preserve effort, contribution, and memories</strong>.
          </p>
          <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9', marginBottom: '1.1rem' }}>
            Every run, wicket, catch, match, and season is part of the Changi Risers story.
          </p>
          <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9' }}>
            Behind every number is a player who showed up, gave their best, and added a page to the Changi Risers chapter.
          </p>
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e9eef5', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '1rem', textAlign: 'center' }}>
            {[
              { icon: '🏏', label: 'Every run matters' },
              { icon: '🎯', label: 'Every wicket counts' },
              { icon: '🤝', label: 'Every match remembered' },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: '24px', marginBottom: '0.3rem' }}>{item.icon}</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function PastPresentFuture() {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1a3a6e 0%, #0f172a 100%)', padding: 'clamp(3.5rem, 8vw, 6rem) 1.5rem', textAlign: 'center', color: '#fff' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ fontSize: '40px', marginBottom: '1.25rem' }}>🚀</div>
        <div style={{ fontSize: '10px', fontWeight: '800', color: '#93c5fd', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Looking Ahead</div>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: '800', margin: '0 0 1.5rem 0', lineHeight: '1.2', color: '#f1f5f9' }}>
          Past, Present &amp; Future
        </h2>
        <p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.9', marginBottom: '1.25rem' }}>
          Risers Legacy is intended to evolve over time — with player stories, photos, milestones, match memories, and data-backed insights.
        </p>
        <p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.9', marginBottom: '2rem' }}>
          The goal is to preserve the club's journey, respect those who built it, celebrate those who carry it today, and inspire those who will wear the colours tomorrow.
        </p>
        <div style={{ fontSize: 'clamp(15px, 2.5vw, 20px)', fontWeight: '700', color: '#f59e0b', fontStyle: 'italic', padding: 'clamp(1rem, 3vw, 1.25rem) clamp(1rem, 3vw, 1.75rem)', backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.22)', lineHeight: '1.4', marginBottom: '2rem' }}>
          "Past. Present. Future. One Riser Legacy."
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
          {[
            { icon: '📜', label: 'Past',    desc: 'Honour those who built the foundation' },
            { icon: '🏏', label: 'Present', desc: 'Celebrate those carrying the identity today' },
            { icon: '⭐', label: 'Future',  desc: 'Inspire those who will wear the colours tomorrow' },
          ].map((p, i) => (
            <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem 0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '26px', marginBottom: '0.5rem' }}>{p.icon}</div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#e2e8f0', marginBottom: '0.35rem' }}>{p.label}</div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Risers Jerseys section ─────────────────────────────────────────────────────

const RISERS_JERSEYS = [
  { publicId: '1_Jersey_dotvwu',  label: 'Jersey 1', caption: 'Risers colours through the years' },
  { publicId: '2_jersey_ymsmq0',  label: 'Jersey 2', caption: 'Risers colours through the years' },
  { publicId: '3_jersey_et4daj',  label: 'Jersey 3', caption: 'Risers colours through the years' },
  { publicId: '4_jersey_gtpozf',  label: 'Jersey 4', caption: 'Risers colours through the years' },
  { publicId: '5_jersey_piisuo',  label: 'Jersey 5', caption: 'Risers colours through the years' },
  { publicId: '6_jersey_kxikki',  label: 'Jersey 6', caption: 'Risers colours through the years' },
];

function JerseyNavBtn({ direction, onClick, disabled }) {
  const isUp = direction === 'up';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={isUp ? 'Previous jersey' : 'Next jersey'}
      className={disabled ? '' : 'jersey-nav-pulse'}
      style={{
        width: '52px', height: '52px', borderRadius: '50%',
        border: `1.5px solid ${disabled ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.5)'}`,
        backgroundColor: disabled ? 'transparent' : 'rgba(245,158,11,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        {isUp
          ? <path d="M9 14V4M4 9l5-5 5 5" stroke={disabled ? 'rgba(245,158,11,0.2)' : '#f59e0b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M9 4v10M4 9l5 5 5-5" stroke={disabled ? 'rgba(245,158,11,0.2)' : '#f59e0b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        }
      </svg>
    </button>
  );
}

function JerseySection() {
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [animKey, setAnimKey]         = useState(0);
  const [direction, setDirection]     = useState('down'); // 'down' = forward, 'up' = backward
  const [exiting, setExiting]         = useState(false);
  const [lightbox, setLightbox]       = useState(null);

  const total  = RISERS_JERSEYS.length;
  const jersey = RISERS_JERSEYS[currentIdx];

  const photos = RISERS_JERSEYS.map((j) => ({
    image:     cloudinaryUrl(j.publicId, 'f_auto,q_auto,w_1200'),
    thumbnail: cloudinaryUrl(j.publicId, 'f_auto,q_auto,w_400'),
    alt:       j.label,
    title:     j.label,
    caption:   j.caption,
  }));

  const navigate = (newIdx, dir) => {
    if (exiting) return;
    setDirection(dir);
    setExiting(true);
    setTimeout(() => {
      setCurrentIdx(newIdx);
      setAnimKey(k => k + 1);
      setExiting(false);
    }, 260);
  };

  const goNext = () => { if (currentIdx < total - 1) navigate(currentIdx + 1, 'down'); };
  const goPrev = () => { if (currentIdx > 0)         navigate(currentIdx - 1, 'up'); };

  // CSS animation class for the entering card
  const enterClass = direction === 'down' ? 'jersey-enter-up' : 'jersey-enter-down';
  // CSS animation class for the exiting card
  const exitClass  = direction === 'down' ? 'jersey-exit-up'  : 'jersey-exit-down';

  return (
    <div style={{ backgroundColor: '#040a18', minHeight: '100%' }}>
      <div style={{
        maxWidth: '640px', margin: '0 auto',
        padding: 'clamp(2rem, 5vw, 3rem) 1.5rem clamp(2rem, 5vw, 3.5rem)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '0.6rem' }}>👕</div>
          <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: '800', color: '#f1f5f9', margin: '0 0 0.4rem', letterSpacing: '-0.01em' }}>
            Risers Colours Through the Years
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
            Every jersey tells a chapter of the Changi Risers story.
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          {RISERS_JERSEYS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIdx ? '20px' : '7px',
                height: '7px',
                borderRadius: '4px',
                backgroundColor: i === currentIdx ? '#f59e0b' : 'rgba(245,158,11,0.2)',
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Up arrow */}
        <JerseyNavBtn direction="up" onClick={goPrev} disabled={currentIdx === 0} />

        {/* Jersey card — key changes on each navigation to trigger CSS animation */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div
            key={animKey}
            className={exiting ? exitClass : enterClass}
            style={{ width: '100%' }}
          >
            {/* Chapter label */}
            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
              <span style={{
                fontSize: '10px', fontWeight: '800', letterSpacing: '0.22em',
                textTransform: 'uppercase', color: '#f59e0b',
              }}>
                {jersey.label}
              </span>
              <span style={{ color: 'rgba(245,158,11,0.35)', fontSize: '10px', marginLeft: '0.5rem', letterSpacing: '0.1em' }}>
                {currentIdx + 1} / {total}
              </span>
            </div>

            {/* Image */}
            <div
              onClick={() => setLightbox({ photos, startIndex: currentIdx })}
              style={{
                cursor: 'pointer',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: '#0f172a',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 14px 56px rgba(0,0,0,0.75)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)'; }}
            >
              <img
                src={cloudinaryUrl(jersey.publicId, 'f_auto,q_auto,w_800')}
                alt={jersey.label}
                style={{ width: '100%', display: 'block', objectFit: 'cover' }}
              />
              <div style={{
                padding: '0.55rem 1rem',
                display: 'flex', justifyContent: 'flex-end',
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.07em', fontWeight: '600' }}>
                  TAP TO EXPAND ↗
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Down arrow */}
        <JerseyNavBtn direction="down" onClick={goNext} disabled={currentIdx === total - 1} />

      </div>

      {lightbox && (
        <LightboxModal
          photos={lightbox.photos}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

const LEGACY_TABS = [
  { id: 'legacy',   label: 'Legacy' },
  { id: 'journey',  label: 'Journey' },
  { id: 'jerseys',  label: 'Jerseys' },
  { id: 'wall',     label: 'Setup' },
  { id: 'memories', label: 'Memories' },
];

export function RisersLegacy() {
  const [activeTab, setActiveTab]                   = useState('legacy');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [legacyTabAtEnd, setLegacyTabAtEnd]         = useState(false);
  const legacyTabScrollRef = useRef(null);

  const handleLegacyTabScroll = () => {
    const el = legacyTabScrollRef.current;
    if (!el) return;
    setLegacyTabAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 6);
  };

  // Category detail view replaces the whole page (back returns to 'wall' tab)
  if (selectedCategoryId) {
    const category = LEGACY_CATEGORIES.find(c => c.id === selectedCategoryId);
    return (
      <CategoryDetailView
        category={category}
        onBack={() => setSelectedCategoryId(null)}
      />
    );
  }

  return (
    <div>
      {/* Internal tab navigation */}
      <div style={{ backgroundColor: '#111e35', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
        <div
          ref={legacyTabScrollRef}
          onScroll={handleLegacyTabScroll}
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ maxWidth: '1100px', margin: '0 auto', paddingLeft: '0.5rem', paddingRight: '1.5rem', display: 'flex', minWidth: 'max-content' }}>
            {LEGACY_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.9rem 1.1rem',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab.id ? '#60a5fa' : 'transparent'}`,
                  marginBottom: '-1px',
                  backgroundColor: 'transparent',
                  color: activeTab === tab.id ? '#60a5fa' : '#94a3b8',
                  fontWeight: activeTab === tab.id ? '700' : '500',
                  fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {/* Right-edge fade — hidden once scrolled to end */}
        {!legacyTabAtEnd && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '56px',
            background: 'linear-gradient(to right, transparent, #111e35)',
            pointerEvents: 'none', zIndex: 2,
          }} />
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'legacy' && (
        <div>
          <HeroSection />
          <WhyThisExists />
          <PastPresentFuture />
        </div>
      )}
      {activeTab === 'journey'  && <JourneySoFar />}
      {activeTab === 'jerseys'  && <JerseySection />}
      {activeTab === 'wall'     && <LegendsWall onSelectCategory={(id) => { setSelectedCategoryId(id); setActiveTab('wall'); }} />}
      {activeTab === 'memories' && <MemoriesSection />}
    </div>
  );
}
