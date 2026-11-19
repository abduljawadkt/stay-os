// Generates the StayOS demo dataset into /data as typed JSON.
// Deterministic: the same seed always produces the same hostel.
// Run: npm run data
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "data");
const NOW = "2026-11-27T10:24:00+05:30";
const TODAY = "2026-11-27";
const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

// ---------- seeded random ----------
let seed = 20261127;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
};
const round10 = (n) => Math.round(n / 10) * 10;
const round100 = (n) => Math.round(n / 100) * 100;

// ---------- dates (IST) ----------
const pad = (n) => String(n).padStart(2, "0");
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fmtDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDate(d);
};
const daysInMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const monthEnd = (ym) => `${ym}-${pad(daysInMonth(ym))}`;
const nextMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
};
const dt = (date, h, m = 0) => `${date}T${pad(h)}:${pad(m)}:00+05:30`;
const minutesBefore = (iso, mins) => {
  const d = new Date(new Date(iso).getTime() - mins * 60000);
  // re-express in IST
  const ist = new Date(d.getTime() + 330 * 60000);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:00+05:30`;
};
const diffDays = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);
const weekday = (s) => toDate(s).getUTCDay(); // 0 Sun

// ---------- hostel structure ----------
const LAYOUT = [
  ["01", "single"], ["02", "single"],
  ["03", "double"], ["04", "double"], ["05", "double"], ["06", "double"],
  ["07", "triple"], ["08", "triple"], ["09", "triple"],
  ["10", "six"],
];
const CAP = { single: 1, double: 2, triple: 3, six: 6 };
const RENT = { single: 9000, double: 7000, triple: 6000, six: 4500 };
const MESS_FEE = 3000;
const BLOCKS = [
  { id: "A", name: "Block A", gender: "M", floors: 4 },
  { id: "B", name: "Block B", gender: "M", floors: 4 },
  { id: "C", name: "Block C", gender: "F", floors: 4 },
];

const rooms = [];
const beds = [];
for (const b of BLOCKS) {
  for (let f = 1; f <= 4; f++) {
    for (const [n, type] of LAYOUT) {
      const id = `${b.id}-${f}${n}`;
      rooms.push({ id, block: b.id, floor: f, number: `${f}${n}`, type, rent: RENT[type], capacity: CAP[type], bath: type === "six" ? "common" : "attached" });
      for (let i = 1; i <= CAP[type]; i++) beds.push({ id: `${id}-${i}`, roomId: id, block: b.id, floor: f, label: String(i), status: "vacant" });
    }
  }
}
const bedById = Object.fromEntries(beds.map((b) => [b.id, b]));
const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));

const MAINT = {
  "B-205-1": "Bathroom retiling · back on 2 Dec",
  "B-205-2": "Bathroom retiling · back on 2 Dec",
  "A-402-1": "Ceiling leak repair · back on 30 Nov",
  "C-401-1": "Cot and wardrobe replacement · back on 29 Nov",
};
const FORCED_VACANT = new Set(["B-203-2", "B-208-3", "B-210-4", "B-210-6", "C-305-2"]);
const PERSONA_BEDS = new Set(["C-207-1", "C-207-2", "C-207-3", "B-108-1"]);
for (const [id, note] of Object.entries(MAINT)) Object.assign(bedById[id], { status: "maintenance", maintenanceNote: note });

// ---------- names ----------
const N = {
  hinduM: ["Arjun", "Abhijith", "Akhil", "Anandu", "Aswin", "Vishnu", "Rahul", "Sreerag", "Nikhil", "Adarsh", "Gokul", "Harikrishnan", "Jishnu", "Sanjay", "Sarath", "Vivek", "Amal", "Midhun", "Nithin", "Rohan", "Anirudh", "Govind", "Karthik", "Sidharth", "Abhinav", "Aravind", "Deepak", "Manu", "Pranav", "Sooraj", "Vaishakh", "Yadhu", "Adwaith", "Alok", "Aadithyan", "Ananthu", "Sreehari", "Vignesh", "Jithu", "Hrishikesh"],
  hinduF: ["Anjali", "Aparna", "Athira", "Gopika", "Keerthana", "Lakshmi", "Meera", "Nandana", "Parvathy", "Revathy", "Sreelakshmi", "Devika", "Krishnapriya", "Anagha", "Aiswarya", "Arya", "Amrutha", "Haritha", "Kavya", "Malavika", "Sandra", "Swathi", "Vismaya", "Devananda", "Gayathri", "Niranjana", "Anusree", "Sreya", "Theertha", "Aswathy"],
  hinduSur: ["Nair", "Menon", "Pillai", "Kurup", "Nambiar", "Warrier", "Varma", "Das", "Krishnan", "Mohan", "Panicker", "Unnithan", "Namboothiri", "Raj", "Suresh"],
  initials: ["K.", "P.", "M.", "T.K.", "C.P.", "K.P.", "V.", "E.", "P.V.", "M.K."],
  muslimM: ["Muhammed Sinan", "Muhammed Shibil", "Nihal", "Rizwan", "Shahid", "Afsal", "Jasim", "Irfan", "Faris", "Hashim", "Ameen", "Adil", "Shamil", "Fahad", "Anas", "Junaid", "Rashid", "Zubair", "Muhammed Ajmal", "Muhammed Fasil", "Hisham", "Sahal", "Nabeel", "Swalih", "Muhsin", "Jaseem", "Shafeeq", "Ashiq", "Rinshad", "Mishal"],
  muslimF: ["Fathima Hiba", "Fathima Nasrin", "Ayisha", "Shahana", "Hiba", "Nashwa", "Rinsha", "Nihala", "Sana", "Hanna", "Diya", "Afra", "Minha", "Jumana", "Rifa", "Shifa", "Nafla", "Lubna", "Najiya", "Sahla", "Fathima Rinsha", "Asna", "Dilna", "Ameena", "Fida", "Nehla"],
  muslimSur: ["K.", "P.", "K.P.", "C.K.", "V.P.", "P.K.", "M.T.", "Koya", "Basheer", "Rahman", "T.", "A.K."],
  christM: ["Alan", "Ebin", "Jithin", "Jobin", "Kevin", "Albin", "Joel", "Abel", "Sebin", "Tony", "Jeffin", "Aby", "Basil", "Jerin", "Melvin", "Roshan", "Justin", "Nevin", "Edwin", "Akash"],
  christF: ["Ann Maria", "Anu", "Sneha", "Riya", "Merin", "Teena", "Neethu", "Jincy", "Rose", "Liya", "Christeena", "Eva", "Elizabeth", "Ancy", "Delna", "Aleena", "Treesa", "Sona", "Irene", "Maria"],
  christSur: ["Joseph", "Thomas", "Mathew", "George", "Varghese", "Kurian", "Jose", "Antony", "Jacob", "Chacko", "Philip", "Sebastian", "Abraham", "Paul", "John"],
  otherM: [["Karthik", "Subramanian"], ["Aditya", "Rao"], ["Vikram", "Singh"], ["Sandeep", "Reddy"], ["Rohit", "Verma"], ["Arun", "Kumar"], ["Prakash", "Shetty"], ["Manish", "Yadav"], ["Harsh", "Patel"], ["Naveen", "Gowda"]],
  otherF: [["Priya", "Iyer"], ["Neha", "Gupta"], ["Divya", "Shenoy"], ["Kavitha", "Raman"], ["Shruti", "Rao"], ["Ananya", "Bhat"], ["Pallavi", "Hegde"], ["Sowmya", "Murthy"]],
  fatherH: ["Rajesh", "Suresh", "Prakash", "Sunil", "Anil", "Mohanan", "Krishnan", "Gopalakrishnan", "Ramesh", "Sasidharan", "Vijayan", "Balakrishnan", "Sudheer", "Manoj", "Santhosh", "Unnikrishnan", "Sreekumar", "Dinesh"],
  fatherM: ["Abdul Rahman", "Abdul Kareem", "Muhammed Ali", "Basheer", "Moideen", "Abdul Majeed", "Hamza", "Ummer", "Kunhi Mohammed", "Ashraf", "Abdul Latheef", "Usman", "Abdul Gafoor", "Mujeeb", "Abdul Salam"],
  fatherC: ["Thomas", "Joseph", "Mathew", "George", "Jose", "Varghese", "Baby", "Saji", "Biju", "Shaji", "Johnson", "Benny", "Jacob", "Sunny"],
  motherH: ["Sreeja", "Bindu", "Latha", "Suja", "Sajitha", "Deepa", "Rema", "Sheeba", "Prasanna"],
  motherM: ["Nasira", "Ramla", "Saleena", "Sabira", "Jameela", "Haseena", "Shareefa"],
  motherC: ["Shiny", "Mini", "Jessy", "Leena", "Mercy", "Elsy", "Sherly"],
};
const TOWNS = [
  ["Tirur, Malappuram", 4], ["Manjeri, Malappuram", 4], ["Perinthalmanna, Malappuram", 3], ["Kottakkal, Malappuram", 3],
  ["Thalassery, Kannur", 4], ["Payyanur, Kannur", 3], ["Taliparamba, Kannur", 3],
  ["Kalpetta, Wayanad", 3], ["Sulthan Bathery, Wayanad", 3], ["Mananthavady, Wayanad", 3],
  ["Thrissur", 3], ["Guruvayur, Thrissur", 2], ["Irinjalakuda, Thrissur", 2],
  ["Kanhangad, Kasaragod", 3], ["Kasaragod", 2], ["Ottapalam, Palakkad", 3], ["Palakkad", 2],
  ["Vadakara, Kozhikode", 3], ["Koyilandy, Kozhikode", 3], ["Perambra, Kozhikode", 2], ["Thamarassery, Kozhikode", 2],
  ["Aluva, Ernakulam", 2], ["Kochi", 2], ["Pala, Kottayam", 2], ["Changanassery, Kottayam", 2],
  ["Neyyattinkara, Thiruvananthapuram", 1], ["Karunagappally, Kollam", 1], ["Cherthala, Alappuzha", 1], ["Thodupuzha, Idukki", 1], ["Thiruvalla, Pathanamthitta", 1],
];
const OUTSIDE = ["Coimbatore, Tamil Nadu", "Bengaluru, Karnataka", "Mangaluru, Karnataka", "Chennai, Tamil Nadu", "Hyderabad, Telangana", "Mysuru, Karnataka"];

const STUDY = {
  both: [
    ["B.Tech Computer Science · NIT Calicut", 5], ["B.Tech Electronics · NIT Calicut", 3], ["M.Tech Structural Engg. · NIT Calicut", 2],
    ["MBBS · Govt. Medical College Kozhikode", 4], ["B.Sc Nursing · Govt. College of Nursing, Kozhikode", 3], ["BDS · Govt. Dental College Kozhikode", 2],
    ["B.Tech Mechanical · Govt. Engineering College Kozhikode", 3], ["B.Tech Electronics · Govt. Engineering College Kozhikode", 3],
    ["B.Com · Malabar Christian College", 3], ["BA Economics · Malabar Christian College", 2], ["B.Sc Chemistry · Farook College", 2], ["MA English · Farook College", 2],
    ["BBA · St. Joseph's College, Devagiri", 3], ["BCA · St. Joseph's College, Devagiri", 3], ["B.Com · Zamorin's Guruvayurappan College", 2],
    ["MBBS · KMCT Medical College", 2], ["B.Pharm · KMCT College of Pharmacy", 2], ["Kerala PSC coaching · Calicut", 3], ["CA Intermediate · coaching, Calicut", 2], ["NEET repeat · coaching, Calicut", 2],
  ],
  womenOnly: [["B.Com · Providence Women's College", 3], ["BA English · Providence Women's College", 3], ["B.Sc Botany · Providence Women's College", 2]],
};
const WORK = [
  ["Software Engineer · UL Technology Solutions, UL Cyberpark", 5], ["QA Engineer · UL Cyberpark", 3], ["Associate Developer · Govt. Cyberpark, Kozhikode", 3],
  ["Staff Nurse · Aster MIMS Calicut", 4], ["Staff Nurse · Baby Memorial Hospital", 3], ["Lab Technician · MVR Cancer Centre", 2], ["Pharmacist · Meitra Hospital", 2],
  ["Sales Executive · Malabar Gold & Diamonds", 3], ["Accounts Assistant · HiLITE Group", 2], ["Retail Associate · LuLu Mall Kozhikode", 2],
  ["Probationary Officer · Federal Bank", 2], ["Clerk · Canara Bank", 2], ["Assistant Engineer · KSEB", 2], ["Teacher · Silver Hills Public School", 2], ["Graphic Designer · Calicut", 1],
];

const usedNames = new Set();
function makePerson(gender) {
  for (let tries = 0; tries < 50; tries++) {
    const community = weighted([["H", 50], ["M", 32], ["C", 13], ["O", 5]]);
    let first, sur, father, mother, hometown;
    if (community === "H") {
      first = pick(gender === "M" ? N.hinduM : N.hinduF);
      sur = chance(0.55) ? pick(N.hinduSur) : pick(N.initials);
      father = `${pick(N.fatherH)} ${sur}`;
      mother = `${pick(N.motherH)} ${sur}`;
    } else if (community === "M") {
      first = pick(gender === "M" ? N.muslimM : N.muslimF);
      sur = pick(N.muslimSur);
      father = `${pick(N.fatherM)} ${sur}`;
      mother = `${pick(N.motherM)} ${sur}`;
    } else if (community === "C") {
      first = pick(gender === "M" ? N.christM : N.christF);
      sur = pick(N.christSur);
      father = `${pick(N.fatherC)} ${sur}`;
      mother = `${pick(N.motherC)} ${sur}`;
    } else {
      const [f, s] = pick(gender === "M" ? N.otherM : N.otherF);
      first = f; sur = s;
      father = `${pick(["Ramesh", "Suresh", "Venkatesh", "Mahesh", "Rajendra", "Srinivas"])} ${s}`;
      mother = `${pick(["Lakshmi", "Sunita", "Geetha", "Radha", "Usha"])} ${s}`;
      hometown = pick(OUTSIDE);
    }
    const name = `${first} ${sur}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    return { name, community, father, mother, hometown: hometown ?? weighted(TOWNS) };
  }
  throw new Error("name space exhausted");
}
const usedPhones = new Set();
function phone() {
  for (;;) {
    const p = `${pick(["9", "9", "9", "8", "7", "6"])}${ri(100000000, 999999999)}`.slice(0, 10);
    if (usedPhones.has(p)) continue;
    usedPhones.add(p);
    return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  }
}
const BLOOD = [["O+", 37], ["B+", 32], ["A+", 22], ["AB+", 6], ["O-", 1], ["B-", 1], ["A-", 1]];

function makeResident(id, gender, overrides = {}) {
  const p = makePerson(gender);
  const isStudent = chance(0.62);
  const occ = isStudent
    ? weighted(gender === "F" ? [...STUDY.both, ...STUDY.womenOnly] : STUDY.both)
    : weighted(WORK);
  const relation = weighted([["Father", 75], ["Mother", 20], ["Guardian", 5]]);
  const parentName = relation === "Father" ? p.father : relation === "Mother" ? p.mother : `${pick(["Prakashan", "Abdul Kader", "Joy", "Sasi"])} (uncle)`;
  const age = isStudent ? ri(18, 24) : ri(22, 31);
  const dob = `${2026 - age}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`;
  return {
    id,
    name: p.name,
    gender,
    phone: phone(),
    dob,
    bloodGroup: weighted(BLOOD),
    hometown: p.hometown,
    occupation: isStudent ? "student" : "professional",
    institution: occ,
    parent: { name: parentName, relation, phone: phone() },
    bedId: null,
    checkInDate: null,
    checkOutDate: null,
    status: "active",
    kyc: { status: "verified", method: "digilocker", aadhaarLast4: String(ri(1000, 9999)), verifiedOn: null },
    police: { status: "submitted", refNo: null, submittedOn: null },
    messPlan: isStudent ? true : chance(0.8),
    deposit: 10000,
    payer: weighted([["prompt", 62], ["normal", 28], ["late", 10]]),
    ...overrides,
  };
}

// ---------- assign beds ----------
const reservedPool = shuffle(beds.filter((b) => b.status === "vacant" && !FORCED_VACANT.has(b.id) && !PERSONA_BEDS.has(b.id)));
const RES_PLAN = { A: 3, B: 3, C: 2 };
const RES_NAMES = { M: ["Adithya Prasad", "Mohammed Rafi T.", "Nevin Jose"], F: ["Fathima Nasrin P.", "Aleena Mariam"] };
const RES_DATES = ["2026-11-29", "2026-12-01", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-05", "2026-11-30", "2026-12-07"];
let resIdx = 0;
for (const blk of ["A", "B", "C"]) {
  const g = blk === "C" ? "F" : "M";
  const picks = reservedPool.filter((b) => b.block === blk).slice(0, RES_PLAN[blk]);
  picks.forEach((b, i) => {
    b.status = "reserved";
    b.reservation = { name: RES_NAMES[g][i % RES_NAMES[g].length], from: RES_DATES[resIdx++], advance: 2000, phone: phone() };
  });
}
const OCC_PLAN = { A: 88, B: 86, C: 86 };
const occupiedBeds = [];
for (const blk of ["A", "B", "C"]) {
  const avail = beds.filter((b) => b.block === blk && b.status === "vacant" && !FORCED_VACANT.has(b.id));
  const forced = avail.filter((b) => PERSONA_BEDS.has(b.id));
  const rest = shuffle(avail.filter((b) => !PERSONA_BEDS.has(b.id))).slice(0, OCC_PLAN[blk] - forced.length);
  for (const b of [...forced, ...rest]) {
    b.status = "occupied";
    occupiedBeds.push(b);
  }
}

// ---------- current residents ----------
// join month plan for the 260 current residents
const joinPlan = shuffle([
  ...Array(106).fill("pre"), ...Array(40).fill("2026-06"), ...Array(60).fill("2026-07"), ...Array(30).fill("2026-08"),
  ...Array(10).fill("2026-09"), ...Array(6).fill("2026-10"), ...Array(8).fill("2026-11"),
]);
const NOV_JOIN_DAYS = [2, 5, 9, 12, 14, 16, 18, 20];
let novJoinIdx = 0;
const residents = [];
let nextId = 1001;
const PERSONA_IDS = { "C-207-2": "R-1042", "B-108-1": "R-1107", "C-207-1": "R-1043", "C-207-3": "R-1044" };
const reservedIds = new Set(Object.values(PERSONA_IDS));
const newId = () => {
  while (reservedIds.has(`R-${nextId}`)) nextId++;
  return `R-${nextId++}`;
};

const sortedOcc = [...occupiedBeds].sort((a, b) => a.id.localeCompare(b.id));
sortedOcc.forEach((bed, i) => {
  const gender = bed.block === "C" ? "F" : "M";
  const id = PERSONA_IDS[bed.id] ?? newId();
  let r = makeResident(id, gender);
  let jm = joinPlan[i];
  if (PERSONA_IDS[bed.id]) jm = "pre";
  if (jm === "2026-11" && novJoinIdx >= NOV_JOIN_DAYS.length) jm = "2026-10";
  let checkIn;
  if (jm === "pre") {
    const d = new Date(Date.UTC(2024, 5, 1) + rand() * (Date.UTC(2026, 4, 25) - Date.UTC(2024, 5, 1)));
    checkIn = fmtDate(d);
  } else if (jm === "2026-11") {
    checkIn = `2026-11-${pad(NOV_JOIN_DAYS[novJoinIdx++])}`;
  } else if (["2026-06", "2026-07", "2026-08"].includes(jm)) {
    checkIn = `${jm}-${pad(chance(0.7) ? ri(1, 10) : ri(11, 24))}`;
  } else {
    checkIn = `${jm}-${pad(ri(1, 24))}`;
  }
  r.bedId = bed.id;
  r.checkInDate = checkIn;
  r.kyc.verifiedOn = checkIn;
  r.police.submittedOn = addDays(checkIn, ri(1, 6));
  r.police.refNo = `KP/KKD/TV/${checkIn.slice(0, 4)}/${ri(10000, 99999)}`;
  bed.residentId = r.id;
  residents.push(r);
});

// persona overrides
const byId = () => Object.fromEntries(residents.map((r) => [r.id, r]));
function override(id, data) {
  const r = residents.find((x) => x.id === id);
  usedNames.add(data.name);
  Object.assign(r, data);
}
override("R-1042", {
  name: "Anjali Menon", phone: "+91 94470 31862", dob: "2006-03-14", bloodGroup: "B+", hometown: "Thrissur",
  occupation: "student", institution: "B.Com · Providence Women's College", messPlan: true, payer: "normal",
  parent: { name: "Rajesh Menon", relation: "Father", phone: "+91 98461 20754" }, checkInDate: "2025-06-14",
});
override("R-1043", {
  name: "Fathima Hiba K.", occupation: "student", institution: "MBBS · Govt. Medical College Kozhikode", hometown: "Manjeri, Malappuram", messPlan: true, payer: "prompt",
  parent: { name: "Abdul Kareem K.", relation: "Father", phone: "+91 97456 22018" }, checkInDate: "2025-08-02",
});
override("R-1044", {
  name: "Sneha Thomas", occupation: "professional", institution: "Staff Nurse · Aster MIMS Calicut", hometown: "Pala, Kottayam", messPlan: true, payer: "prompt",
  parent: { name: "Thomas Mathew", relation: "Father", phone: "+91 94953 11470" }, checkInDate: "2026-02-10",
});
override("R-1107", {
  name: "Arjun Das", phone: "+91 90372 64105", occupation: "student", institution: "B.Tech Electronics · Govt. Engineering College Kozhikode", hometown: "Thalassery, Kannur", messPlan: true, payer: "prompt",
  parent: { name: "Sunil Das", relation: "Father", phone: "+91 98950 41736" }, checkInDate: "2025-07-08",
});
for (const id of ["R-1042", "R-1043", "R-1044", "R-1107"]) {
  const r = residents.find((x) => x.id === id);
  r.kyc.verifiedOn = r.checkInDate;
  r.police.submittedOn = addDays(r.checkInDate, 2);
}

// KYC and police exceptions: recent joiners pending
const recent = residents.filter((r) => r.checkInDate >= "2026-10-15");
recent.forEach((r, i) => {
  if (i % 2 === 0) { r.kyc = { ...r.kyc, status: "pending", verifiedOn: null }; }
  r.police = { status: "pending", refNo: null, submittedOn: null };
});
shuffle(residents.filter((r) => r.checkInDate < "2025-01-01")).slice(0, 3).forEach((r) => {
  r.kyc = { ...r.kyc, status: "manual", method: "offline" };
});
// police approved for older residents
residents.forEach((r) => {
  if (r.police.status === "submitted" && r.checkInDate < "2026-08-01") r.police.status = "approved";
});
// a few residents serving notice
shuffle(residents.filter((r) => r.occupation === "professional" && !reservedIds.has(r.id))).slice(0, 5).forEach((r, i) => {
  r.status = "notice";
  r.checkOutDate = ["2026-11-30", "2026-12-05", "2026-12-10", "2026-12-15", "2026-12-31"][i];
});

// ---------- former residents ----------
const LEAVERS = { "2026-06": 42, "2026-07": 18, "2026-08": 7, "2026-09": 9, "2026-10": 12 };
const former = [];
for (const [ym, count] of Object.entries(LEAVERS)) {
  for (let i = 0; i < count; i++) {
    const blk = weighted([["A", 1], ["B", 1], ["C", 1]]);
    const gender = blk === "C" ? "F" : "M";
    const r = makeResident(newId(), gender);
    const bed = pick(beds.filter((b) => b.block === blk && b.status !== "maintenance"));
    const d = new Date(Date.UTC(2023, 5, 1) + rand() * (Date.UTC(2026, 3, 30) - Date.UTC(2023, 5, 1)));
    r.bedId = bed.id;
    r.checkInDate = fmtDate(d);
    r.checkOutDate = monthEnd(ym);
    r.status = "checked_out";
    r.kyc.verifiedOn = r.checkInDate;
    r.police = { status: "approved", refNo: `KP/KKD/TV/${r.checkInDate.slice(0, 4)}/${ri(10000, 99999)}`, submittedOn: addDays(r.checkInDate, 2) };
    former.push(r);
  }
}
const allResidents = [...residents, ...former];

// ---------- invoices ----------
const invoices = [];
const invSeq = {};
const nextInvId = (ym) => {
  invSeq[ym] = (invSeq[ym] ?? 0) + 1;
  return `INV-${ym.slice(2, 4)}${ym.slice(5, 7)}-${String(invSeq[ym]).padStart(4, "0")}`;
};
const utr = () => `${ri(3000, 6999)}${ri(10000000, 99999999)}`;
const method = () => weighted([["upi", 82], ["bank", 10], ["cash", 8]]);
const upiVia = () => weighted([["whatsapp_link", 55], ["app", 30], ["qr", 15]]);

function rentFor(r) {
  return roomById[bedById[r.bedId].roomId].rent;
}
for (const ym of MONTHS) {
  const dim = daysInMonth(ym);
  for (const r of allResidents) {
    const start = r.checkInDate;
    if (start > monthEnd(ym)) continue;
    if (r.checkOutDate && r.status === "checked_out" && r.checkOutDate < `${ym}-01`) continue;
    const rent = rentFor(r);
    const joinedThisMonth = start.slice(0, 7) === ym && start.slice(8) !== "01";
    const lines = [];
    let issuedOn = `${ym}-01`;
    let dueOn = `${ym}-07`;
    const roomType = roomById[bedById[r.bedId].roomId].type;
    if (joinedThisMonth) {
      const days = dim - Number(start.slice(8)) + 1;
      issuedOn = start;
      dueOn = addDays(start, 7);
      lines.push({ kind: "rent", label: `Rent · ${days} of ${dim} days`, amount: round10((rent * days) / dim) });
      if (r.messPlan) lines.push({ kind: "mess", label: `Mess · ${days} of ${dim} days`, amount: round10((MESS_FEE * days) / dim) });
      lines.push({ kind: "deposit", label: "Security deposit (refundable)", amount: 10000 });
    } else {
      lines.push({ kind: "rent", label: `Rent · ${roomType}`, amount: rent });
      if (r.messPlan) lines.push({ kind: "mess", label: "Mess", amount: MESS_FEE });
      if (r.messPlan && chance(0.1) && ym !== "2026-06") {
        const d = ri(3, 6);
        lines.push({ kind: "rebate", label: `Mess rebate · ${d} days away last month`, amount: -70 * d });
      }
    }
    const total = lines.reduce((s, l) => s + l.amount, 0);
    invoices.push({
      id: nextInvId(ym), residentId: r.id, month: ym, issuedOn, dueOn, lines, total,
      status: "unpaid", paidOn: null, method: null, utr: null, paidVia: null, remindersSent: 0, _payer: r.payer,
    });
  }
}

// collection calibration for past months
const TARGET = { "2026-06": 0.93, "2026-07": 0.9, "2026-08": 0.95, "2026-09": 0.92, "2026-10": 0.94 };
const STILL_UNPAID = { "2026-09": 1, "2026-10": 3 };
const chronic = [];
function payOn(inv, date, hour) {
  inv.status = "paid";
  inv.paidOn = dt(date, hour ?? ri(7, 22), ri(0, 59));
  inv.method = method();
  if (inv.method === "upi") { inv.utr = utr(); inv.paidVia = upiVia(); }
  else if (inv.method === "bank") { inv.utr = `FDRLH${ri(10000000, 99999999)}`; }
}
for (const [ym, target] of Object.entries(TARGET)) {
  const list = invoices.filter((i) => i.month === ym);
  const billed = list.reduce((s, i) => s + i.total, 0);
  const order = shuffle(list).sort((a, b) => {
    const w = { late: 0, normal: 1, prompt: 2 };
    return w[a._payer] - w[b._payer];
  });
  let late = 0;
  const lateSet = new Set();
  for (const inv of order) {
    if (late / billed >= 1 - target) break;
    lateSet.add(inv.id);
    late += inv.total;
  }
  let unpaidLeft = STILL_UNPAID[ym] ?? 0;
  for (const inv of list) {
    if (lateSet.has(inv.id)) {
      const r = allResidents.find((x) => x.id === inv.residentId);
      if (unpaidLeft > 0 && r.status !== "checked_out" && inv._payer !== "prompt" && !reservedIds.has(r.id)) {
        unpaidLeft--;
        inv.remindersSent = ri(3, 5);
        chronic.push(r.id);
        continue;
      }
      payOn(inv, `${nextMonth(ym)}-${pad(ri(2, 18))}`);
      inv.remindersSent = ri(1, 3);
    } else {
      const base = inv.issuedOn;
      const offset = inv._payer === "prompt" ? ri(0, 6) : inv._payer === "normal" ? ri(3, 13) : ri(6, 20);
      let d = addDays(base, offset);
      if (d > monthEnd(ym)) d = monthEnd(ym);
      payOn(inv, d);
      if (d > inv.dueOn) inv.remindersSent = 1;
    }
  }
}
// November (current month, as of 27 Nov 10:24)
{
  const list = invoices.filter((i) => i.month === "2026-11");
  const regular = list.filter((i) => i.issuedOn === "2026-11-01");
  const joiners = list.filter((i) => i.issuedOn !== "2026-11-01").sort((a, b) => a.issuedOn.localeCompare(b.issuedOn));
  const unpaid = new Set();
  unpaid.add(list.find((i) => i.residentId === "R-1042").id);
  for (const id of chronic) {
    const inv = list.find((i) => i.residentId === id);
    if (inv) unpaid.add(inv.id);
  }
  const candidates = shuffle(regular.filter((i) => !unpaid.has(i.id) && !["R-1043", "R-1044", "R-1107"].includes(i.residentId)))
    .sort((a, b) => ({ late: 0, normal: 1, prompt: 2 }[a._payer] - { late: 0, normal: 1, prompt: 2 }[b._payer]));
  for (const inv of candidates) {
    if (unpaid.size >= 26) break;
    unpaid.add(inv.id);
  }
  // latest three joiners have not paid yet
  joiners.slice(-3).forEach((i) => unpaid.add(i.id));
  const todayPayers = [];
  for (const inv of list) {
    if (unpaid.has(inv.id)) {
      const overdue = diffDays(TODAY, inv.dueOn);
      inv.remindersSent = overdue >= 15 ? 3 : overdue >= 3 ? 2 : overdue >= 0 ? 1 : 0;
      continue;
    }
    const offset = inv._payer === "prompt" ? ri(0, 6) : inv._payer === "normal" ? ri(3, 14) : ri(7, 22);
    let d = addDays(inv.issuedOn, offset);
    if (d >= TODAY) {
      d = TODAY;
      todayPayers.push(inv);
      payOn(inv, d, ri(7, 9));
    } else payOn(inv, d);
    if (d > inv.dueOn) inv.remindersSent = 1;
  }
  // make sure a few payments landed this morning (for the live feed)
  shuffle(list.filter((i) => i.status === "paid" && i.issuedOn === "2026-11-01" && i.paidOn > "2026-11-10" && !["R-1043", "R-1044", "R-1107"].includes(i.residentId))).slice(0, 4).forEach((inv, k) => {
    inv.paidOn = dt(TODAY, [7, 8, 9, 10][k], [12, 41, 26, 3][k]);
    inv.method = "upi";
    inv.utr = utr();
    inv.paidVia = "whatsapp_link";
  });
}
invoices.forEach((i) => delete i._payer);
allResidents.forEach((r) => delete r.payer);

// ---------- expenses ----------
const occ = { "2026-06": 0.78, "2026-07": 0.84, "2026-08": 0.88, "2026-09": 0.89, "2026-10": 0.88, "2026-11": 0.87 };
const expenses = [];
let expSeq = 1;
const addExp = (date, category, vendor, description, amount, extra = {}) => {
  expenses.push({
    id: `EXP-${String(expSeq++).padStart(4, "0")}`, date, category, vendor, description, amount: round10(amount),
    mode: extra.mode ?? weighted([["bank", 55], ["upi", 35], ["cash", 10]]),
    receipt: extra.noReceipt ? null : { fileName: extra.file ?? `${vendor.split(/[ ·,]/)[0]}_${date}.pdf`.replace(/[^A-Za-z0-9_.-]/g, ""), pages: 1 },
    status: extra.status ?? "paid",
  });
};
const STAFF = [
  { id: "S-01", name: "Mohammed Ashraf P.", role: "warden", title: "Chief warden · Blocks A, B", salary: 26000, shift: "09:00–21:00", phone: "+91 98472 55310", joinedOn: "2019-04-01" },
  { id: "S-02", name: "Lissy Joseph", role: "warden", title: "Lady warden · Block C", salary: 24000, shift: "09:00–21:00", phone: "+91 94461 70382", joinedOn: "2020-06-15" },
  { id: "S-03", name: "Nisha Balan", role: "office", title: "Front office & accounts", salary: 18000, shift: "09:30–18:00", phone: "+91 97445 08126", joinedOn: "2022-01-10" },
  { id: "S-04", name: "Kunhimoideen P.", role: "cook", title: "Head cook", salary: 25000, shift: "05:00–14:00", phone: "+91 98950 77214", joinedOn: "2018-08-01" },
  { id: "S-05", name: "Saidalavi T.", role: "cook", title: "Cook", salary: 18000, shift: "05:00–14:00", phone: "+91 96334 81907", joinedOn: "2021-03-01" },
  { id: "S-06", name: "Prakashan K.", role: "cook", title: "Cook · dinner", salary: 17000, shift: "12:00–21:00", phone: "+91 94952 63018", joinedOn: "2022-07-18" },
  { id: "S-07", name: "Ramla Beevi", role: "cook", title: "Cook · breakfast", salary: 17000, shift: "04:30–12:30", phone: "+91 97470 21593", joinedOn: "2023-02-01" },
  { id: "S-08", name: "Sulochana M.", role: "cook", title: "Kitchen helper", salary: 13000, shift: "06:00–15:00", phone: "+91 90610 44872", joinedOn: "2023-06-12" },
  { id: "S-09", name: "Bindu Sasi", role: "cook", title: "Kitchen helper", salary: 13000, shift: "12:00–21:00", phone: "+91 95443 19260", joinedOn: "2024-01-08" },
  { id: "S-10", name: "Shobha Rajan", role: "cleaner", title: "Housekeeping · Block A", salary: 12500, shift: "07:00–15:00", phone: "+91 96458 30174", joinedOn: "2021-11-01" },
  { id: "S-11", name: "Leela Krishnan", role: "cleaner", title: "Housekeeping · Block B", salary: 12500, shift: "07:00–15:00", phone: "+91 94003 62851", joinedOn: "2020-09-14" },
  { id: "S-12", name: "Sumathi K.", role: "cleaner", title: "Housekeeping · Block C", salary: 12500, shift: "07:00–15:00", phone: "+91 97441 58302", joinedOn: "2022-04-04" },
  { id: "S-13", name: "Ammini Varghese", role: "cleaner", title: "Housekeeping · Block C", salary: 12500, shift: "07:00–15:00", phone: "+91 95264 70913", joinedOn: "2023-08-21" },
  { id: "S-14", name: "Rajan P.", role: "cleaner", title: "Housekeeping · common areas", salary: 12500, shift: "06:00–14:00", phone: "+91 98466 27015", joinedOn: "2019-12-02" },
  { id: "S-15", name: "Kamala Devi", role: "cleaner", title: "Laundry & linen", salary: 12000, shift: "08:00–16:00", phone: "+91 90486 13529", joinedOn: "2024-03-11" },
  { id: "S-16", name: "Unnikrishnan Nair", role: "security", title: "Security · day (ex-serviceman)", salary: 16000, shift: "07:00–19:00", phone: "+91 94470 86231", joinedOn: "2018-08-01" },
  { id: "S-17", name: "Abdul Gafoor C.", role: "security", title: "Security · night", salary: 15000, shift: "19:00–07:00", phone: "+91 97473 50418", joinedOn: "2020-02-17" },
  { id: "S-18", name: "Jayan V.", role: "security", title: "Security · day", salary: 15000, shift: "07:00–19:00", phone: "+91 95390 62147", joinedOn: "2022-10-03" },
  { id: "S-19", name: "Babu Thomas", role: "security", title: "Security · night", salary: 15000, shift: "19:00–07:00", phone: "+91 98951 03362", joinedOn: "2023-05-29" },
  { id: "S-20", name: "Biju Narayanan", role: "maintenance", title: "Electrician & plumber", salary: 20000, shift: "08:00–17:00", phone: "+91 94954 71820", joinedOn: "2019-06-10" },
];
const wkStarts = (ym) => [1, 8, 15, 22, 29].filter((d) => d <= daysInMonth(ym)).map((d) => `${ym}-${pad(d)}`);
for (const ym of MONTHS) {
  const f = occ[ym];
  const isNov = ym === "2026-11";
  const upto = (d) => !isNov || d <= TODAY;
  // food
  addExp(`${ym}-02`, "food", "Malabar Rice & Provisions, Valiyangadi", "Rice (matta, raw, biryani), dal, oil, spices · monthly", 182000 * f / 0.87 + ri(-6000, 6000));
  wkStarts(ym).forEach((d) => upto(d) && addExp(d, "food", "Palayam Vegetable Market · Kader & Sons", "Vegetables · weekly", ri(42000, 52000) * f / 0.87));
  wkStarts(ym).forEach((d) => upto(addDays(d, 2)) && addExp(addDays(d, 2), "food", "Puthiyappa Fish Landing · Shameer", "Fish (mathi, ayala, ney meen)", ri(13000, 18000) * f / 0.87, { mode: "upi" }));
  wkStarts(ym).forEach((d) => upto(addDays(d, 4)) && addExp(addDays(d, 4), "food", "Al Baraka Poultry, Palayam", "Chicken · Friday and Sunday specials", ri(17000, 23000) * f / 0.87, { mode: "upi" }));
  if (upto(`${ym}-05`)) addExp(`${ym}-05`, "food", "Milma Malabar Dairy · route supply", "Milk and curd · monthly", 44000 * f / 0.87 + ri(-2000, 2000));
  if (upto(`${ym}-06`)) addExp(`${ym}-06`, "food", "Indane LPG · Malabar Gas Agency", "Commercial LPG, 19 kg × 22", 38500 + ri(-800, 800));
  if (upto(`${ym}-20`)) addExp(`${ym}-20`, "food", "Indane LPG · Malabar Gas Agency", "Commercial LPG, 19 kg × 20", 35000 + ri(-800, 800));
  if (upto(`${ym}-10`)) addExp(`${ym}-10`, "food", "Namakkal Egg Traders", "Eggs, 6,000", 39000 * f / 0.87, { noReceipt: chance(0.3) });
  // electricity
  const season = { "2026-06": 0.92, "2026-07": 0.9, "2026-08": 0.93, "2026-09": 0.97, "2026-10": 1.02, "2026-11": 1.05 }[ym];
  if (upto(`${ym}-12`)) {
    for (const blk of ["A", "B", "C"]) addExp(`${ym}-12`, "electricity", "KSEB · Kozhikode Town section", `Electricity · Block ${blk}`, ri(40000, 46000) * season * (f / 0.87), { mode: "upi", file: `KSEB_${ym}_Block${blk}.pdf` });
    addExp(`${ym}-12`, "electricity", "KSEB · Kozhikode Town section", "Electricity · kitchen, laundry and common areas", ri(19000, 23000) * season, { mode: "upi", file: `KSEB_${ym}_Common.pdf` });
  }
  // water
  if (upto(`${ym}-15`)) addExp(`${ym}-15`, "water", "Kerala Water Authority", "Water charges · non-domestic", ri(19000, 23000) * f / 0.87, { mode: "bank" });
  if (["2026-10", "2026-11", "2026-06"].includes(ym) && upto(`${ym}-18`)) addExp(`${ym}-18`, "water", "Pantheerankavu Water Tankers", "Tanker water, 6 loads", ri(9000, 13000), { mode: "cash", noReceipt: chance(0.5) });
  // internet
  if (upto(`${ym}-03`)) {
    addExp(`${ym}-03`, "internet", "BSNL FTTH Business", "Fibre 300 Mbps × 3 (Blocks A, B, C)", 11800, { mode: "bank" });
    addExp(`${ym}-03`, "internet", "Kerala Vision Broadband", "Backup line + mess and office", 4400, { mode: "upi" });
    addExp(`${ym}-03`, "internet", "Hostel Wi-Fi AMC · NetCare Calicut", "Access points and support", 3500, { mode: "upi" });
  }
  // maintenance
  const maint = shuffle([
    ["Rafeeq & Sons Plumbing", "Leak repairs and tap replacements", 6000, 14000],
    ["Sree Electricals, Mavoor Road", "Fans, tubelights and switches", 5000, 12000],
    ["Hicare Pest Control", "Quarterly pest control", 8500, 8500],
    ["Tank Clean Kerala", "Overhead tank cleaning", 6500, 6500],
    ["Peps Mattress dealer", "Mattress replacement × 6", 21000, 24000],
    ["Calicut Paint House", "Corridor repainting", 14000, 26000],
    ["Hikvision dealer · SecureTech", "CCTV AMC", 4500, 4500],
    ["Joseph Carpentry Works", "Cupboard locks and cot repairs", 3500, 9000],
  ]).slice(0, ri(4, 6));
  maint.forEach(([v, d, a, b], k) => {
    const date = `${ym}-${pad(4 + k * 4)}`;
    if (upto(date)) addExp(date, "maintenance", v, d, ri(a, b), { noReceipt: chance(0.15) });
  });
  // salaries
  const salDate = monthEnd(ym);
  STAFF.forEach((s) => addExp(salDate, "salaries", s.name, `Salary · ${s.title}`, s.salary, { mode: "bank", noReceipt: true, status: isNov ? "scheduled" : "paid" }));
}
expenses.sort((a, b) => a.date.localeCompare(b.date));

// ---------- staff attendance ----------
const staff = STAFF.map((s) => {
  const attendance = {};
  for (let d = 1; d <= 27; d++) {
    const date = `2026-11-${pad(d)}`;
    const r = rand();
    attendance[date] = r < 0.035 ? "A" : r < 0.07 ? "L" : r < 0.1 ? "late" : r < 0.11 ? "H" : "P";
  }
  return { ...s, attendance, advance: s.id === "S-08" ? 3000 : s.id === "S-17" ? 2000 : 0 };
});
staff.find((s) => s.id === "S-14").attendance[TODAY] = "L";
staff.find((s) => s.id === "S-18").attendance[TODAY] = "late";
staff.find((s) => s.id === "S-01").attendance[TODAY] = "P";
staff.find((s) => s.id === "S-20").attendance[TODAY] = "P";

// ---------- complaints ----------
const C_TEMPL = {
  electrical: { sla: 4, items: [["Fan not working", "Fan stopped since morning, regulator also hot."], ["Tubelight flickering", "Tubelight near the study table keeps flickering."], ["Water heater not heating", "Geyser not heating, only cold water."], ["Switch board sparking", "Small spark when switching on the plug point."], ["Socket loose near bed", "Charger keeps falling out of the socket."]] },
  plumbing: { sla: 6, items: [["Tap leaking in bathroom", "Tap keeps dripping all night."], ["Flush not working", "Flush handle broken."], ["Drain blocked", "Bathroom floor drain blocked, water standing."], ["Low water pressure", "Very low water pressure in the shower."], ["Shower head broken", "Shower head cracked."]] },
  wifi: { sla: 3, items: [["Wi-Fi very slow", "Wi-Fi below 1 Mbps after 9 PM."], ["Can't connect to Wi-Fi", "Phone says connected, no internet."], ["Wi-Fi drops at night", "Disconnects every 10 minutes after 11 PM."]] },
  housekeeping: { sla: 8, items: [["Room not cleaned today", "Room was skipped in today's cleaning."], ["Dustbin overflowing in corridor", "Corridor dustbin not cleared since yesterday."], ["Bathroom needs cleaning", "Common bathroom needs deep cleaning."]] },
  mess: { sla: 12, items: [["Rice undercooked at lunch", "Rice was hard today at lunch."], ["Breakfast ran out by 8:45", "No puttu left for late breakfast."], ["More veg options at dinner", "Only one veg curry on non-veg days."]] },
  furniture: { sla: 48, items: [["Cupboard lock broken", "Key turns but the lock does not open."], ["Chair leg broken", "Study chair leg cracked."], ["Mattress torn", "Mattress cover torn at the corner."]] },
  other: { sla: 24, items: [["Washing machine not working", "Laundry room machine 2 shows error E21."], ["Need a duplicate key", "Lost my room key, need a duplicate."], ["Noise late at night", "Loud music from the next room after midnight."]] },
};
const ASSIGNEE = { electrical: "S-20", plumbing: "S-20", wifi: "S-03", housekeeping: "S-10", mess: "S-04", furniture: "S-20", other: "S-01" };
const complaints = [];
let cmpSeq = 1001;
const activeRes = residents.filter((r) => r.status !== "checked_out" && !reservedIds.has(r.id));
function makeComplaint({ category, status, createdAt, residentId, channel, idx, resolvedAfterH }) {
  const t = C_TEMPL[category];
  const [title, desc] = t.items[idx ?? ri(0, t.items.length - 1)];
  const r = residents.find((x) => x.id === residentId) ?? pick(activeRes);
  const room = bedById[r.bedId].roomId;
  const ch = channel ?? weighted([["whatsapp", 40], ["app", 45], ["walk_in", 15]]);
  const c = {
    id: `CMP-${cmpSeq++}`, residentId: r.id, roomId: room, category, title, description: desc, channel: ch, status,
    priority: ["electrical", "plumbing", "wifi"].includes(category) ? (chance(0.4) ? "high" : "medium") : chance(0.2) ? "medium" : "low",
    createdAt, slaHours: t.sla, assignedTo: status === "new" ? null : ASSIGNEE[category], resolvedAt: null, rating: null,
    updates: [{ at: createdAt, kind: "created", by: ch }],
  };
  if (status !== "new") c.updates.push({ at: minutesBefore(createdAt, -ri(5, 25)), kind: "assigned", by: ASSIGNEE[category] });
  if (status === "resolved") {
    const hours = resolvedAfterH ?? Math.max(0.5, t.sla * (0.25 + rand() * 0.8));
    c.resolvedAt = minutesBefore(createdAt, -Math.round(hours * 60));
    c.updates.push({ at: c.resolvedAt, kind: "resolved", by: ASSIGNEE[category] });
    c.rating = chance(0.7) ? weighted([[5, 60], [4, 30], [3, 10]]) : null;
  }
  complaints.push(c);
  return c;
}
// resolved this month
for (let i = 0; i < 31; i++) {
  const day = ri(1, 26);
  const cat = weighted([["electrical", 22], ["plumbing", 22], ["wifi", 18], ["housekeeping", 12], ["mess", 8], ["furniture", 10], ["other", 8]]);
  makeComplaint({ category: cat, status: "resolved", createdAt: dt(`2026-11-${pad(day)}`, ri(7, 21), ri(0, 59)) });
}
// Arjun's resolved Wi-Fi complaint last week
makeComplaint({ category: "wifi", status: "resolved", createdAt: dt("2026-11-20", 22, 14), residentId: "R-1107", channel: "whatsapp", idx: 2, resolvedAfterH: 1.6 });
// open: in progress
const OPEN_IP = [
  ["electrical", 7 * 60 + 10, 2], ["plumbing", 3 * 60 + 40, 0], ["wifi", 2 * 60 + 35, 0], ["furniture", 26 * 60, 0], ["housekeeping", 2 * 60 + 5, 1], ["plumbing", 5 * 60 + 50, 2],
];
OPEN_IP.forEach(([cat, minsAgo, idx]) => {
  const c = makeComplaint({ category: cat, status: "in_progress", createdAt: minutesBefore(NOW, minsAgo), idx });
  c.updates.push({ at: minutesBefore(NOW, Math.round(minsAgo * 0.5)), kind: "on_the_way", by: c.assignedTo });
});
// open: new
const OPEN_NEW = [["electrical", 18, 1, "app"], ["other", 52, 0, "app"], ["mess", 95, 1, "whatsapp"], ["wifi", 40, 1, "whatsapp"], ["housekeeping", 130, 0, "walk_in"]];
OPEN_NEW.forEach(([cat, minsAgo, idx, ch]) => makeComplaint({ category: cat, status: "new", createdAt: minutesBefore(NOW, minsAgo), idx, channel: ch }));
complaints.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ---------- leave requests ----------
const leaves = [];
let lvSeq = 301;
const pickActive = (pred) => pick(activeRes.filter(pred));
const usedLeave = new Set(["R-1042", "R-1043", "R-1044", "R-1107"]);
function leaveFor(r, from, to, reason, destination, status, requestedAt, decidedAt) {
  usedLeave.add(r.id);
  leaves.push({ id: `LV-${lvSeq++}`, residentId: r.id, from, to, reason, destination, status, requestedAt, parentDecisionAt: decidedAt ?? null });
}
const REASONS = [["Going home for the weekend", null], ["Sister's wedding", null], ["Sabarimala pilgrimage", null], ["Medical appointment at home", null], ["College industrial visit", "Bengaluru"], ["Family function", null], ["Fever, going home to rest", null]];
const onLeaveNow = [];
for (let i = 0; i < 12; i++) {
  const r = pickActive((x) => !usedLeave.has(x.id));
  const startDay = ri(23, 26);
  const [reason, dest] = pick(REASONS);
  const from = dt(`2026-11-${pad(startDay)}`, ri(15, 18), pick([0, 15, 30]));
  const to = dt(addDays(TODAY, ri(1, 3)), ri(17, 20), 0);
  leaveFor(r, from, to, reason, dest ?? r.hometown, "approved", minutesBefore(from, ri(300, 2000)), minutesBefore(from, ri(60, 280)));
  onLeaveNow.push({ r, from });
}
for (let i = 0; i < 5; i++) {
  const r = pickActive((x) => !usedLeave.has(x.id));
  const d = ri(6, 18);
  leaveFor(r, dt(`2026-11-${pad(d)}`, 17, 0), dt(`2026-11-${pad(d + 2)}`, 19, 0), pick(REASONS)[0], r.hometown, "approved", dt(`2026-11-${pad(d - 1)}`, 20, 10), dt(`2026-11-${pad(d - 1)}`, 21, 2));
}
// awaiting parent
leaveFor(residents.find((r) => r.id === "R-1042"), dt(TODAY, 17, 0), dt("2026-11-29", 19, 0), "Going home for the weekend", "Thrissur", "awaiting_parent", minutesBefore(NOW, 44));
for (let i = 0; i < 2; i++) {
  const r = pickActive((x) => !usedLeave.has(x.id));
  leaveFor(r, dt(addDays(TODAY, 1), 8, 0), dt(addDays(TODAY, 2), 20, 0), pick(REASONS)[0], r.hometown, "awaiting_parent", minutesBefore(NOW, ri(90, 400)));
}
for (let i = 0; i < 2; i++) {
  const r = pickActive((x) => !usedLeave.has(x.id));
  leaveFor(r, dt(`2026-11-${pad(ri(14, 22))}`, 21, 30), dt(`2026-11-${pad(ri(23, 25))}`, 23, 0), "Friend's birthday trip", "Wayanad", "rejected", dt("2026-11-13", 19, 0), dt("2026-11-13", 21, 40));
}
leaves.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

// ---------- gate events ----------
const gate = [];
let gSeq = 1;
const addGate = (residentId, type, at, extra = {}) => gate.push({ id: `G-${String(gSeq++).padStart(5, "0")}`, residentId, type, at, method: extra.method ?? (chance(0.94) ? "qr" : "manual"), late: extra.late ?? false, passId: extra.passId ?? null });
const leaveIds = new Set(onLeaveNow.map((x) => x.r.id));
const YDAY = addDays(TODAY, -1);
for (const r of activeRes) {
  if (r.checkInDate > YDAY) continue;
  const block = bedById[r.bedId].block;
  const curfew = block === "C" ? 21 * 60 + 30 : 22 * 60;
  const lv = onLeaveNow.find((x) => x.r.id === r.id);
  // yesterday
  if (!lv || lv.from.slice(0, 10) > YDAY) {
    if (chance(0.82)) {
      const outM = ri(7 * 60 + 15, 9 * 60 + 40);
      addGate(r.id, "out", dt(YDAY, Math.floor(outM / 60), outM % 60));
      let inM = ri(16 * 60 + 30, 21 * 60 + 20);
      const late = chance(0.03);
      if (late) inM = curfew + ri(8, 85);
      addGate(r.id, "in", dt(YDAY, Math.floor(inM / 60), inM % 60), { late });
    }
  } else if (lv.from.slice(0, 10) === YDAY) {
    // left yesterday evening on leave
  }
  if (lv) {
    const f = lv.from;
    addGate(r.id, "out", minutesBefore(f, -ri(5, 50)), { passId: leaves.find((l) => l.residentId === r.id && l.status === "approved")?.id });
    continue;
  }
  // today morning
  if (chance(r.occupation === "student" ? 0.8 : 0.66)) {
    const outM = ri(7 * 60 + 10, 9 * 60 + 55);
    addGate(r.id, "out", dt(TODAY, Math.floor(outM / 60), outM % 60));
    if (chance(0.06)) {
      const backM = Math.min(outM + ri(30, 120), 10 * 60 + 20);
      addGate(r.id, "in", dt(TODAY, Math.floor(backM / 60), backM % 60));
    }
  }
}
// late entries over the previous week
for (let i = 0; i < 11; i++) {
  const r = pick(activeRes);
  const d = addDays(TODAY, -ri(2, 7));
  const block = bedById[r.bedId].block;
  const curfew = block === "C" ? 21 * 60 + 30 : 22 * 60;
  const m = curfew + ri(6, 95);
  addGate(r.id, "in", dt(d, Math.floor(m / 60), m % 60), { late: true });
}
gate.sort((a, b) => b.at.localeCompare(a.at));

// ---------- visitors ----------
const VIS = [
  ["Father", "Dropped off home food and clothes"], ["Mother", "Visit"], ["Brother", "Visit"], ["Sister", "Visit"], ["Uncle", "Fee discussion with warden"], ["Friend", "Project work (lobby only)"], ["Cousin", "Visit"],
];
const visitors = [];
for (let i = 0; i < 18; i++) {
  const r = pick(activeRes);
  const [relation, purpose] = pick(VIS);
  const d = addDays(TODAY, -ri(0, 6));
  const inM = d === TODAY ? ri(8 * 60 + 30, 10 * 60) : ri(10 * 60, 18 * 60 + 30);
  const inAt = dt(d, Math.floor(inM / 60), inM % 60);
  const p = makePerson(chance(0.6) ? "M" : "F");
  const vname = relation === "Father" ? r.parent.relation === "Father" ? r.parent.name : p.name : relation === "Mother" && r.parent.relation === "Mother" ? r.parent.name : p.name;
  const stillIn = d === TODAY && chance(0.6);
  const outM = inM + ri(25, 110);
  visitors.push({
    id: `V-${String(i + 1).padStart(3, "0")}`, name: vname, phone: phone(), relation, residentId: r.id, purpose, inAt,
    outAt: stillIn ? null : dt(d, Math.floor(outM / 60), outM % 60), idProof: weighted([["Aadhaar", 70], ["Driving licence", 20], ["Voter ID", 10]]), idLast4: String(ri(1000, 9999)),
  });
}
visitors.sort((a, b) => b.inAt.localeCompare(a.inAt));

// ---------- mess ----------
const M = (en, ml, veg = true) => ({ en, ml, veg });
const menu = [
  { day: 0, breakfast: M("Appam and vegetable stew", "അപ്പവും വെജിറ്റബിൾ സ്റ്റ്യൂവും"), lunch: M("Chicken biryani, raita and pickle", "ചിക്കൻ ബിരിയാണി, റൈത്ത, അച്ചാർ", false), snacks: M("Tea and pazham pori", "ചായയും പഴംപൊരിയും"), dinner: M("Chapati and egg roast", "ചപ്പാത്തിയും മുട്ട റോസ്റ്റും", false), special: M("Semiya payasam", "സേമിയ പായസം") },
  { day: 1, breakfast: M("Puttu and kadala curry", "പുട്ടും കടലക്കറിയും"), lunch: M("Rice, sambar, avial, cabbage thoran", "ചോറ്, സാമ്പാർ, അവിയൽ, കാബേജ് തോരൻ"), snacks: M("Tea and uzhunnu vada", "ചായയും ഉഴുന്നുവടയും"), dinner: M("Chapati and veg kurma", "ചപ്പാത്തിയും വെജ് കുറുമയും") },
  { day: 2, breakfast: M("Idiyappam and egg curry", "ഇടിയപ്പവും മുട്ടക്കറിയും", false), lunch: M("Rice, fish curry, beans thoran", "ചോറ്, മീൻകറി, ബീൻസ് തോരൻ", false), snacks: M("Tea and banana chips", "ചായയും കായ വറുത്തതും"), dinner: M("Kanji, cherupayar and pappadam", "കഞ്ഞി, ചെറുപയർ, പപ്പടം") },
  { day: 3, breakfast: M("Dosa, sambar and chutney", "ദോശ, സാമ്പാർ, ചട്ണി"), lunch: M("Rice, moru curry, beetroot thoran", "ചോറ്, മോരുകറി, ബീറ്റ്റൂട്ട് തോരൻ"), snacks: M("Tea and sukhiyan", "ചായയും സുഖിയനും"), dinner: M("Kerala porotta and chicken curry", "പൊറോട്ടയും ചിക്കൻ കറിയും", false) },
  { day: 4, breakfast: M("Upma and banana", "ഉപ്പുമാവും പഴവും"), lunch: M("Rice, sambar, fish fry, thoran", "ചോറ്, സാമ്പാർ, മീൻ വറുത്തത്, തോരൻ", false), snacks: M("Tea and cutlet", "ചായയും കട്ലറ്റും"), dinner: M("Chapati and dal fry", "ചപ്പാത്തിയും ദാൽ ഫ്രൈയും") },
  { day: 5, breakfast: M("Poori and potato masala", "പൂരിയും ഉരുളക്കിഴങ്ങ് മസാലയും"), lunch: M("Ghee rice and chicken curry", "നെയ്ച്ചോറും ചിക്കൻ കറിയും", false), snacks: M("Tea and unniyappam", "ചായയും ഉണ്ണിയപ്പവും"), dinner: M("Chapati and channa masala", "ചപ്പാത്തിയും ചന്ന മസാലയും") },
  { day: 6, breakfast: M("Puttu and green gram curry", "പുട്ടും ചെറുപയർ കറിയും"), lunch: M("Rice, rasam, egg curry, thoran", "ചോറ്, രസം, മുട്ടക്കറി, തോരൻ", false), snacks: M("Tea and bonda", "ചായയും ബോണ്ടയും"), dinner: M("Fried rice and gobi manchurian", "ഫ്രൈഡ് റൈസും ഗോബി മഞ്ചൂരിയനും") },
];
const PLATE = { breakfast: 20, lunch: 34, snacks: 10, dinner: 30 };
const MEALS = ["breakfast", "lunch", "snacks", "dinner"];
const messRes = residents.filter((r) => r.messPlan && r.status !== "checked_out");
const optOuts = [];
let ooSeq = 1;
const addOpt = (residentId, date, meals, reason, source = "app", createdAt) => optOuts.push({ id: `OO-${String(ooSeq++).padStart(4, "0")}`, residentId, date, meals, reason, source, createdAt: createdAt ?? dt(addDays(date, -1), ri(18, 22), ri(0, 59)) });
// weekend home visits
const weekends = [["2026-11-07", "2026-11-08"], ["2026-11-14", "2026-11-15"], ["2026-11-21", "2026-11-22"], ["2026-11-28", "2026-11-29"]];
for (const [sat, sun] of weekends) {
  const goers = shuffle(messRes.filter((r) => !leaveIds.has(r.id) && r.id !== "R-1042")).slice(0, ri(52, 64));
  for (const r of goers) {
    addOpt(r.id, sat, ["lunch", "snacks", "dinner"], "Going home for the weekend", chance(0.3) ? "whatsapp" : "app");
    addOpt(r.id, sun, [...MEALS], "Going home for the weekend", "app");
  }
}
// longer stretches → rebates
const longStays = shuffle(messRes.filter((r) => !leaveIds.has(r.id))).slice(0, 14);
longStays.forEach((r, k) => {
  const start = ri(2, 20);
  const len = ri(3, 6);
  const reason = r.gender === "M" && k % 3 === 0 ? "Sabarimala pilgrimage" : pick(["Exam leave at home", "Sister's wedding", "Fever, resting at home", "College tour"]);
  for (let d = start; d < start + len && d <= 27; d++) addOpt(r.id, `2026-11-${pad(d)}`, [...MEALS], reason);
});
// residents on leave now
for (const { r, from } of onLeaveNow) {
  if (!r.messPlan) continue;
  const lv = leaves.find((l) => l.residentId === r.id && l.status === "approved" && l.from === from);
  let d = from.slice(0, 10);
  const end = lv.to.slice(0, 10);
  while (d <= end) {
    addOpt(r.id, d, d === from.slice(0, 10) ? ["dinner"] : [...MEALS], lv.reason, "app", lv.parentDecisionAt);
    d = addDays(d, 1);
  }
}
// random single meals
for (let i = 0; i < 260; i++) {
  const r = pick(messRes);
  const day = ri(1, 27);
  const date = `2026-11-${pad(day)}`;
  if (optOuts.some((o) => o.residentId === r.id && o.date === date)) continue;
  const meal = weighted([["lunch", 45], ["dinner", 25], ["breakfast", 15], ["snacks", 15]]);
  addOpt(r.id, date, [meal], pick(["Lunch at college", "Practical lab till late", "Eating out with friends", "Night duty at hospital", "Early class", "Fasting"]), chance(0.35) ? "whatsapp" : "app");
}
// today's opt-outs (so headcount is believable)
for (const r of shuffle(messRes.filter((x) => !leaveIds.has(x.id) && x.id !== "R-1042")).slice(0, 38)) {
  if (optOuts.some((o) => o.residentId === r.id && o.date === TODAY)) continue;
  addOpt(r.id, TODAY, chance(0.7) ? ["lunch"] : ["lunch", "snacks"], pick(["Lunch at college", "Practical lab till late", "Night duty at hospital"]), chance(0.4) ? "whatsapp" : "app", minutesBefore(NOW, ri(30, 900)));
}
optOuts.sort((a, b) => a.date.localeCompare(b.date));
const mess = {
  menu,
  plateCost: PLATE,
  rebatePerDay: 70,
  rebateMinDays: 3,
  cutoffs: { breakfast: "21:00 previous day", lunch: "10:00", snacks: "14:00", dinner: "16:00" },
  servingTimes: { breakfast: "07:00–09:00", lunch: "12:30–14:00", snacks: "16:30–17:30", dinner: "19:30–21:00" },
  specials: [
    { date: "2026-11-01", en: "Kerala Piravi sadya lunch", ml: "കേരളപ്പിറവി സദ്യ" },
    { date: "2026-11-14", en: "Children's Day ice cream after dinner", ml: "ശിശുദിനം · അത്താഴത്തിന് ശേഷം ഐസ്ക്രീം" },
    { date: "2026-11-27", en: "Friday ghee rice", ml: "വെള്ളിയാഴ്ച നെയ്ച്ചോറ്" },
  ],
  optOuts,
};

// ---------- notices ----------
const notices = [
  { id: "N-21", category: "maintenance", pinned: true, audience: "C", postedAt: dt(TODAY, 8, 5), title: "Water supply off in Block C, 2–4 PM today", titleMl: "ഇന്ന് ഉച്ചയ്ക്ക് 2 മുതൽ 4 വരെ ബ്ലോക്ക് സി-യിൽ വെള്ളം ഉണ്ടാകില്ല", body: "Overhead tank cleaning. Please store water in buckets before 2 PM.", bodyMl: "ടാങ്ക് വൃത്തിയാക്കുന്നതിനാൽ 2 മണിക്ക് മുമ്പ് ബക്കറ്റിൽ വെള്ളം ശേഖരിച്ച് വയ്ക്കുക." },
  { id: "N-20", category: "fees", pinned: false, audience: "all", postedAt: dt("2026-11-25", 18, 30), title: "December invoices go out on 1 December", titleMl: "ഡിസംബർ ബില്ലുകൾ ഡിസംബർ 1-ന് അയയ്ക്കും", body: "Pay by 7 December through the app or the WhatsApp link. Mess rebates for November are added automatically.", bodyMl: "ഡിസംബർ 7-ന് മുമ്പ് ആപ്പ് വഴിയോ വാട്സ്ആപ്പ് ലിങ്ക് വഴിയോ അടയ്ക്കുക. നവംബറിലെ മെസ്സ് റിബേറ്റ് സ്വയം കുറയ്ക്കും." },
  { id: "N-19", category: "safety", pinned: false, audience: "all", postedAt: dt("2026-11-24", 11, 0), title: "Fire drill on Saturday, 28 Nov at 7:30 AM", titleMl: "ശനിയാഴ്ച (നവം 28) രാവിലെ 7:30-ന് ഫയർ ഡ്രിൽ", body: "Assemble at the front courtyard when the alarm sounds. Takes about 15 minutes.", bodyMl: "അലാറം കേൾക്കുമ്പോൾ മുൻവശത്തെ മുറ്റത്ത് ഒത്തുകൂടുക. ഏകദേശം 15 മിനിറ്റ്." },
  { id: "N-18", category: "mess", pinned: false, audience: "all", postedAt: dt("2026-11-22", 9, 15), title: "New dinner menu from Monday", titleMl: "തിങ്കൾ മുതൽ പുതിയ അത്താഴ മെനു", body: "Kanji on Tuesdays and porotta on Wednesdays, as voted in the mess survey.", bodyMl: "മെസ്സ് സർവേയിലെ തീരുമാനപ്രകാരം ചൊവ്വാഴ്ച കഞ്ഞിയും ബുധനാഴ്ച പൊറോട്ടയും." },
  { id: "N-17", category: "general", pinned: false, audience: "all", postedAt: dt("2026-11-18", 17, 45), title: "Gate closes at 10 PM (Block C at 9:30 PM)", titleMl: "ഗേറ്റ് രാത്രി 10-ന് അടയ്ക്കും (ബ്ലോക്ക് സി 9:30-ന്)", body: "Late entry needs a gate pass approved by your parent. Late entries are shared with parents on WhatsApp.", bodyMl: "വൈകി വരാൻ രക്ഷിതാവ് അംഗീകരിച്ച ഗേറ്റ് പാസ് വേണം. വൈകിയുള്ള പ്രവേശനം രക്ഷിതാക്കളെ വാട്സ്ആപ്പിൽ അറിയിക്കും." },
  { id: "N-16", category: "general", pinned: false, audience: "all", postedAt: dt("2026-11-10", 10, 0), title: "Wi-Fi upgraded to 300 Mbps in all blocks", titleMl: "എല്ലാ ബ്ലോക്കുകളിലും വൈ-ഫൈ 300 Mbps ആക്കി", body: "New network names: AlNoor-A, AlNoor-B, AlNoor-C. Password is on your room card.", bodyMl: "പുതിയ നെറ്റ്‌വർക്കുകൾ: AlNoor-A, AlNoor-B, AlNoor-C. പാസ്‌വേഡ് റൂം കാർഡിൽ ഉണ്ട്." },
];

// ---------- activity seed ----------
const activity = [];
let actSeq = 1;
const addAct = (at, kind, data) => activity.push({ id: `ACT-${String(actSeq++).padStart(4, "0")}`, at, kind, ...data });
invoices.filter((i) => i.paidOn && i.paidOn.startsWith(TODAY)).forEach((i) => addAct(i.paidOn, "payment", { residentId: i.residentId, amount: i.total, method: i.method, invoiceId: i.id }));
gate.filter((g) => g.at.startsWith(TODAY)).slice(0, 6).forEach((g) => addAct(g.at, g.type === "in" ? "gate_in" : "gate_out", { residentId: g.residentId }));
complaints.filter((c) => c.createdAt.startsWith(TODAY)).forEach((c) => addAct(c.createdAt, "complaint", { residentId: c.residentId, complaintId: c.id, channel: c.channel }));
optOuts.filter((o) => o.createdAt.startsWith(TODAY)).slice(0, 4).forEach((o) => addAct(o.createdAt, "optout", { residentId: o.residentId, meals: o.meals }));
visitors.filter((v) => v.inAt.startsWith(TODAY)).forEach((v) => addAct(v.inAt, "visitor", { residentId: v.residentId, visitorName: v.name }));
leaves.filter((l) => l.status === "awaiting_parent").slice(0, 1).forEach((l) => addAct(l.requestedAt, "leave_request", { residentId: l.residentId, leaveId: l.id }));
activity.sort((a, b) => b.at.localeCompare(a.at));

// ---------- WhatsApp seed ----------
const anjaliNov = invoices.find((i) => i.residentId === "R-1042" && i.month === "2026-11");
const morningPayer = invoices.filter((i) => i.paidOn && i.paidOn.startsWith(TODAY)).sort((a, b) => a.paidOn.localeCompare(b.paidOn))[0];
const mpRes = residents.find((r) => r.id === morningPayer.residentId);
const sneha = residents.find((r) => r.id === "R-1044");
const wa = [
  {
    id: "wa-anjali", contactName: "Anjali Menon", role: "resident", residentId: "R-1042", phone: "+91 94470 31862", unread: 0,
    messages: [
      { id: "m1", from: "hostel", at: dt("2026-11-01", 9, 0), kind: "template", template: "invoice", data: { name: "Anjali", month: "November", amount: anjaliNov.total, due: "7 Nov", invoiceId: anjaliNov.id }, status: "read" },
      { id: "m2", from: "hostel", at: dt("2026-11-07", 9, 0), kind: "template", template: "reminder_due", data: { name: "Anjali", amount: anjaliNov.total, invoiceId: anjaliNov.id }, status: "read" },
      { id: "m3", from: "contact", at: dt("2026-11-07", 21, 18), kind: "text", text: "Sorry sir, father will transfer by this week 🙏" },
      { id: "m4", from: "hostel", at: dt("2026-11-17", 9, 0), kind: "template", template: "reminder_overdue", data: { name: "Anjali", amount: anjaliNov.total, days: 10, invoiceId: anjaliNov.id }, status: "delivered" },
    ],
  },
  {
    id: "wa-rajesh", contactName: "Rajesh Menon", role: "parent", residentId: "R-1042", phone: "+91 98461 20754", unread: 1,
    messages: [
      { id: "m1", from: "hostel", at: dt("2026-11-22", 20, 0), kind: "template", template: "weekly_summary", data: { child: "Anjali", present: 7, late: 0, meals: 25 }, status: "read" },
      { id: "m2", from: "contact", at: dt("2026-11-22", 20, 31), kind: "text", text: "Thank you 👍" },
      { id: "m3", from: "hostel", at: dt("2026-11-26", 20, 12), kind: "template", template: "gate_in", data: { child: "Anjali", time: "8:12 PM" }, status: "read" },
      { id: "m4", from: "hostel", at: minutesBefore(NOW, 43), kind: "template", template: "leave_request", data: { child: "Anjali", from: "Today, 5:00 PM", to: "Sun 29 Nov, 7:00 PM", destination: "Thrissur", reason: "Going home for the weekend", leaveId: leaves.find((l) => l.residentId === "R-1042").id }, status: "delivered" },
    ],
  },
  {
    id: "wa-arjun", contactName: "Arjun Das", role: "resident", residentId: "R-1107", phone: "+91 90372 64105", unread: 0,
    messages: [
      { id: "m1", from: "contact", at: dt("2026-11-20", 22, 14), kind: "text", text: "Wifi B block il every 10 min disconnect aavunnu after 11 😩" },
      { id: "m2", from: "hostel", at: dt("2026-11-20", 22, 14), kind: "template", template: "complaint_ack", data: { id: complaints.find((c) => c.residentId === "R-1107").id, category: "Wi-Fi", room: "B-108", sla: "3 hours" }, status: "read" },
      { id: "m3", from: "hostel", at: dt("2026-11-20", 23, 50), kind: "template", template: "complaint_resolved", data: { id: complaints.find((c) => c.residentId === "R-1107").id, by: "Nisha (office)" }, status: "read" },
      { id: "m4", from: "contact", at: dt("2026-11-20", 23, 58), kind: "text", text: "5" },
    ],
  },
  {
    id: "wa-sneha", contactName: sneha.name, role: "resident", residentId: sneha.id, phone: sneha.phone, unread: 0,
    messages: [
      { id: "m1", from: "contact", at: dt(TODAY, 6, 48), kind: "text", text: "Night duty today. Skip dinner please" },
      { id: "m2", from: "hostel", at: dt(TODAY, 6, 48), kind: "template", template: "optout_ack", data: { meal: "Dinner", date: "Fri 27 Nov" }, status: "read" },
    ],
  },
  {
    id: "wa-payer", contactName: mpRes.name, role: "resident", residentId: mpRes.id, phone: mpRes.phone, unread: 0,
    messages: [
      { id: "m1", from: "hostel", at: dt("2026-11-17", 9, 0), kind: "template", template: "reminder_overdue", data: { name: mpRes.name.split(" ")[0], amount: morningPayer.total, days: 10, invoiceId: morningPayer.id }, status: "read" },
      { id: "m2", from: "hostel", at: morningPayer.paidOn, kind: "template", template: "receipt", data: { amount: morningPayer.total, invoiceId: morningPayer.id, utr: morningPayer.utr, month: "November" }, status: "read" },
    ],
  },
];
// Sneha's dinner opt-out exists in data
if (!optOuts.some((o) => o.residentId === sneha.id && o.date === TODAY)) addOpt(sneha.id, TODAY, ["dinner"], "Night duty at hospital", "whatsapp", dt(TODAY, 6, 48));
else optOuts.find((o) => o.residentId === sneha.id && o.date === TODAY).meals = ["dinner"];

// ---------- hostel ----------
const hostel = {
  id: "H-ALNOOR", name: "Al Noor Residency", city: "Calicut", address: "Mavoor Road, near Arayidathupalam, Kozhikode, Kerala 673004",
  phone: "+91 495 270 4400", whatsapp: "+91 90480 70400", upiId: "alnoorresidency@federal", bank: "Federal Bank · Mavoor Road",
  owner: { name: "Rasheed Koya", phone: "+91 98470 11226" }, wardenId: "S-01",
  blocks: BLOCKS.map((b) => ({ ...b, wardenId: b.id === "C" ? "S-02" : "S-01", curfew: b.id === "C" ? "21:30" : "22:00" })),
  rentByType: RENT, messFee: MESS_FEE, deposit: 10000, dueDay: 7,
  now: NOW, today: TODAY, months: MONTHS,
};

// ---------- write ----------
fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 0) + "\n");
write("hostel", hostel);
write("rooms", rooms);
write("beds", beds);
write("residents", allResidents);
write("invoices", invoices);
write("expenses", expenses);
write("staff", staff);
write("complaints", complaints);
write("gate", gate);
write("leaves", leaves);
write("visitors", visitors);
write("mess", mess);
write("notices", notices);
write("activity", activity);
write("whatsapp", wa);

// ---------- report ----------
const cur = allResidents.filter((r) => r.status !== "checked_out");
const nov = invoices.filter((i) => i.month === "2026-11");
const billed = nov.reduce((s, i) => s + i.total, 0);
const coll = nov.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
console.log("beds", beds.length, Object.fromEntries(["occupied", "vacant", "reserved", "maintenance"].map((s) => [s, beds.filter((b) => b.status === s).length])));
console.log("residents current", cur.length, "former", former.length, "occupancy", (cur.length / 300 * 100).toFixed(1) + "%");
for (const ym of MONTHS) {
  const l = invoices.filter((i) => i.month === ym);
  const b = l.reduce((s, i) => s + i.total, 0);
  const inMonth = l.filter((i) => i.paidOn && i.paidOn.slice(0, 7) === ym).reduce((s, i) => s + i.total, 0);
  const exp = expenses.filter((e) => e.date.slice(0, 7) === ym).reduce((s, e) => s + e.amount, 0);
  console.log(ym, "invoices", l.length, "billed", b, "collected in month", inMonth, ((inMonth / b) * 100).toFixed(1) + "%", "unpaid", l.filter((i) => i.status === "unpaid").length, "expenses", exp);
}
console.log("Nov billed", billed, "collected", coll, "pending", billed - coll);
console.log("complaints", complaints.length, "open", complaints.filter((c) => c.status !== "resolved").length, "gate", gate.length, "optOuts", optOuts.length, "meals skipped to date", optOuts.filter((o) => o.date <= TODAY).reduce((s, o) => s + o.meals.length, 0));
const sizes = fs.readdirSync(OUT).filter((f) => f.endsWith(".json")).map((f) => `${f}:${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)}KB`);
console.log(sizes.join(" "));
