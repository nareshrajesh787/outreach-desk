// Hard rules confirmed by Naresh. Every draft is checked against these.
export const FACT_SHEET = `
Naresh Rajesh, senior at West Forsyth High School (Cumming, GA), graduating May 2027. U.S. citizen, 18+ by June 1, 2027.
GPA 4.0 unweighted / 4.623 weighted, rank 1/657, SAT 1580.
Dual enrollment: Georgia Tech CS 1301, Linear Algebra, Multivariable Calculus (Spring 2027).
Software Engineering Intern at iVue Robotics (Feb 2026 to present, unpaid): ships user-facing features (profile editing, image uploads) for the Develop Air drone ground-control platform in Vue.js/Nuxt; builds AWS backend services (S3, Lambda, API routes); builds route optimization for flight paths.
Georgia Tech STEP summer intern (Guggenheim School of Aerospace Engineering, Jun-Jul 2025): prototype rover for a simulated Enceladus mission, 6-person team, owned electrical design, systems integration and Arduino controls, presented at symposium.
Co-founder, InnovateATL (Georgia's largest high school startup pitch competition): 200+ competitors, 70+ teams, raised $2,000+ in sponsorships.
Co-founder, LearnAI: student-led team building free AI tools for Georgia nonprofits; tools used by 110+ staff at 4 nonprofits. Workshops are PLANNED, none held.
Built a grounded info chatbot for MentorMe North Georgia through LearnAI (may be described as his work).
Projects (no live users): SpeechScore (AssemblyAI transcription into Gemini rubric scoring, deployed on Railway), Clarity (React Native teen mental-health resources app).
Awards: Wharton Global Youth Investment Challenge Global Finalist; National Merit Semifinalist; FBLA National 3rd Data Analysis; TSA State 1st Cybersecurity.
Leadership: FBLA Chapter Co-President, Georgia FBLA Region 11 Officer.
Links: github.com/nareshrajesh787, linkedin.com/in/naresh-rajesh
`.trim();

// Deterministic red lines. A draft containing any of these never gets queued.
export const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /edgar/i, why: "mentions edgar-facts-mcp (not built)" },
  { re: /spotify/i, why: "mentions Spotify taste model (not built)" },
  { re: /\b\d[\d,]*\+?\s*(active\s+)?(users|downloads)\b/i, why: "claims user counts" },
  { re: /(held|hosted|ran|taught|conducted)\s+(\w+\s+){0,3}workshops?/i, why: "claims LearnAI workshops were held" },
  { re: /life-?ops/i, why: "Life-Ops is private; do not link or detail it" },
];

export const STYLE = `Short, polite, plain. Sound like a thoughtful high school student, not a marketer. No hype, no flattery, no buzzwords. State up front that he is a high school senior. 90-140 words. One specific reason for contacting this person. One concrete ask (a short call or a pointer to the right person). Sign off "Thank you," then "Naresh Rajesh". Never attach a resume; link only GitHub/LinkedIn if useful.`;
