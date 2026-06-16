import React, { useState, useEffect } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Generate n placeholder person entries — replace with real data when ready
function mkPeople(n = 3) {
  return Array.from({ length: n }, () => ({
    name:    'Name to be added',
    role:    'Contribution details coming soon',
    tribute: 'A tribute story will be added here to honour this person\'s contribution to Changi Risers.',
    photo:   null,
  }));
}

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
      { name: 'Shailesh Thakur',       role: 'Founding Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Gajendra Agarwal',      role: 'Founding Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Sheetanshu Srivastava', role: 'Founding Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Ahsan Nabi Dar',        role: 'Founding Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Abhijeet Joshi',        role: 'Founding Contributor', tribute: 'A tribute story will be added here.', photo: null },
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
      { name: 'Gajendra Agarwal',      role: 'Former Captain',           tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Sheetanshu Srivastava', role: 'Former Captain',           tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Kapil Arora',           role: 'Former Captain',           tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Kintul Mistry',         role: 'Former & Current Captain', tribute: 'A tribute story will be added here.', photo: null },
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
      { name: 'Vikram Singh Salaria',  role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Pradipta Mishra',       role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Kintul Mistry',         role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Kapil Arora',           role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Sheetanshu Srivastava', role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Ahsan Nabi Dar',        role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Santhosh Dommety',      role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Gururaj Banakar',       role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Akhil Kukreja',         role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Harsha Sarma',          role: 'Match Winner', tribute: 'A tribute story will be added here.', photo: null },
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
      { name: 'Gaurav Khandelwal',     role: 'Team Builder', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Amol Babu',             role: 'Team Builder', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Kintul Mistry',         role: 'Team Builder', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Kapil Arora',           role: 'Team Builder', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Sheetanshu Srivastava', role: 'Team Builder', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Vivek Singh',           role: 'Team Builder', tribute: 'A tribute story will be added here.', photo: null },
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
      { name: 'Santosh Dommety',       role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Gaurav Khandelwal',     role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Sheetanshu Srivastava', role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Vivek Bhat',            role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Akhil Kukreja',         role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Zubin Patel',           role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Harsha Sharma',         role: 'Overseas Riser', tribute: 'A tribute story will be added here.', photo: null },
    ],
  },
  {
    id:               'mentor-senior',
    cardTitle:        'Mentor / Senior Player',
    title:            'Mentor / Senior Risers',
    contributionType: 'Guidance & Experience',
    icon:             '🧠',
    accentColor:      '#6d28d9',
    ctaLabel:         'View Mentor / Senior Risers',
    cardTribute:      'A tribute story will be added here to honour the guidance, experience, and mentorship that shaped younger Risers.',
    detailDescription:'Honouring senior players and mentors whose guidance, experience, and support helped shape younger Risers.',
    people: [
      { name: 'Chacha', role: 'Mentor / Senior Riser', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Vivek',  role: 'Mentor / Senior Riser', tribute: 'A tribute story will be added here.', photo: null },
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
      { name: 'Amol Babu',            role: 'Silent Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Samveg Jain',          role: 'Silent Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Vikram Singh Salaria', role: 'Silent Contributor', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Pramod Gururaj',       role: 'Silent Contributor', tribute: 'A tribute story will be added here.', photo: null },
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
      { name: 'Kintul Mistry',        role: 'Current Core Player', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Vikram Singh Salaria', role: 'Current Core Player', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Pradipta Mishra',      role: 'Current Core Player', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Gajendra Agrawal',     role: 'Current Core Player', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Vivek Singh',          role: 'Current Core Player', tribute: 'A tribute story will be added here.', photo: null },
      { name: 'Akshay Thakre',        role: 'Current Core Player', tribute: 'A tribute story will be added here.', photo: null },
    ],
  },
];

const MEMORY_TILES = [
  { title: 'Team Photo',            icon: '👥', caption: 'A squad memory to be added here.' },
  { title: 'Trophy Moment',         icon: '🏆', caption: 'A winning moment to be added here.' },
  { title: 'Farewell Memory',       icon: '✈️', caption: 'A farewell story to be added here.' },
  { title: 'Match-Day Moment',      icon: '🏏', caption: 'A match-day snapshot to be added here.' },
  { title: 'Dressing-Room Story',   icon: '🧢', caption: 'A dressing-room memory to be added here.' },
  { title: 'Overseas Riser Memory', icon: '🌏', caption: 'A memory from an overseas Riser to be added here.' },
];

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Section({ children, bg = '#fff', style = {} }) {
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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '80vh', color: '#fff' }}>

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
            ← Back to Risers Legacy
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
                  {/* Photo placeholder */}
                  <div style={{ height: '150px', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderBottom: `1px solid ${category.accentColor}18` }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: category.accentColor + '15', border: `2px dashed ${category.accentColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                      👤
                    </div>
                    <div style={{ fontSize: '10px', color: '#334155', fontStyle: 'italic' }}>Photo coming soon</div>
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
              ← Back to Risers Legacy
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
    <Section bg="#fff">
      <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '1.25rem' }}>❤️</div>
        <SectionHeading eyebrow="Our Purpose" title="Why This Page Exists" />
        <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9', marginBottom: '1.25rem' }}>
          Changi Risers Cricket is more than a team name. It is a journey built by players, captains, organisers, supporters, mentors, and friends who contributed across seasons.
        </p>
        <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9', marginBottom: '1.25rem' }}>
          Some continue to play. Some have moved overseas. Some may no longer be active — but their role in shaping the club deserves to be remembered with respect.
        </p>
        <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9' }}>
          This page exists to honour <strong>everyone who meaningfully contributed to Changi Risers</strong> — not only top performers, but every player, volunteer, and supporter who helped build this club into what it is today.
        </p>
        <div style={{ marginTop: '2.25rem', padding: '1.5rem 1.75rem', backgroundColor: '#f0f7ff', borderRadius: '12px', borderLeft: '4px solid #0066cc', textAlign: 'left' }}>
          <p style={{ fontSize: '15px', color: '#1e40af', fontStyle: 'italic', margin: 0, lineHeight: '1.8', fontWeight: '500' }}>
            "A club's legacy is not written by wins alone. It is written by the people who showed up, believed in each other, and made every match worth playing."
          </p>
        </div>
      </div>
    </Section>
  );
}

function JourneySoFar() {
  return (
    <Section bg="#f5f8fc">
      <SectionHeading
        eyebrow="Club History"
        title="The Journey So Far"
        body="From the very first match to the platform you are reading right now — the Changi Risers story has been built one season at a time."
      />
      <div style={{ maxWidth: '660px', margin: '0 auto', position: 'relative', paddingLeft: '2.5rem' }}>
        <div style={{ position: 'absolute', left: '0.6rem', top: '0.8rem', bottom: '0.8rem', width: '2px', background: 'linear-gradient(to bottom, #0066cc 0%, #d0dae8 100%)' }} />
        {TIMELINE_ITEMS.map((item, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: i < TIMELINE_ITEMS.length - 1 ? '2rem' : 0 }}>
            <div style={{ position: 'absolute', left: '-2.05rem', top: '0.3rem', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: item.color, border: '3px solid #f5f8fc', boxShadow: `0 0 0 2px ${item.color}` }} />
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(6,28,84,0.05)', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{item.era}</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.7' }}>{item.description}</p>
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
        eyebrow="The Legends Wall"
        title="Legacy &amp; Legends"
        body="Legends are not only top performers. Anyone who meaningfully contributed to Changi Risers — on or off the field — belongs here."
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

function MemoriesSection() {
  return (
    <Section bg="#fff">
      <SectionHeading
        eyebrow="Club Memories"
        title="Memories Down the Lane"
        body="A future gallery of team photos, match moments, farewells, and shared memories that define the Changi Risers journey."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.1rem' }}>
        {MEMORY_TILES.map((tile, i) => (
          <div key={i} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', boxShadow: '0 2px 8px rgba(6,28,84,0.05)' }}>
            <div style={{ position: 'relative', paddingBottom: '62.5%', backgroundColor: '#e8eef6' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '30px', opacity: 0.45 }}>{tile.icon}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>Photo coming soon</span>
              </div>
            </div>
            <div style={{ padding: '0.8rem 0.9rem' }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '0.2rem' }}>{tile.title}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>{tile.caption}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '1.75rem', padding: '1.1rem 1.5rem', backgroundColor: '#f0f7ff', borderRadius: '10px', border: '1px dashed #93c5fd', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#0066cc', fontWeight: '600' }}>
          📷 &nbsp;Real photos and stories will be added here as the gallery grows. Reach out to share your Risers memories.
        </p>
      </div>
    </Section>
  );
}

function StatsWithRespect() {
  return (
    <Section bg="#f5f8fc">
      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '1.25rem' }}>📊</div>
        <SectionHeading eyebrow="Stats & Story" title="Stats With Respect" body="Numbers are a part of the story — not the whole story." />
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '2rem 2.25rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(6,28,84,0.06)', textAlign: 'left' }}>
          <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9', marginBottom: '1.1rem' }}>
            The numbers on this site are not meant to reduce a player to statistics. They exist to <strong>preserve effort, contribution, and memories</strong>.
          </p>
          <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9', marginBottom: '1.1rem' }}>
            Every run, wicket, catch, match, and season is part of the Changi Risers story.
          </p>
          <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.9' }}>
            Behind every number is a player who showed up, gave their best, and added a page to the Changi Risers chapter.
          </p>
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e9eef5', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
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
        <p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.9', marginBottom: '3rem' }}>
          The goal is to preserve the club's journey, respect those who built it, celebrate those who carry it today, and inspire those who will wear the colours tomorrow.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '3rem' }}>
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
        <div style={{ fontSize: 'clamp(15px, 2.5vw, 20px)', fontWeight: '700', color: '#f59e0b', fontStyle: 'italic', padding: '1.5rem 1.75rem', backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.22)', lineHeight: '1.4' }}>
          "Past. Present. Future. One Riser Legacy."
        </div>
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export function RisersLegacy() {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const selectedCategory = selectedCategoryId
    ? LEGACY_CATEGORIES.find(c => c.id === selectedCategoryId)
    : null;

  if (selectedCategory) {
    return (
      <CategoryDetailView
        category={selectedCategory}
        onBack={() => setSelectedCategoryId(null)}
      />
    );
  }

  return (
    <div>
      <HeroSection />
      <WhyThisExists />
      <JourneySoFar />
      <LegendsWall onSelectCategory={setSelectedCategoryId} />
      <MemoriesSection />
      <StatsWithRespect />
      <PastPresentFuture />
    </div>
  );
}
