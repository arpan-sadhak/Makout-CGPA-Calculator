const apiLoader = document.getElementById("apiLoader");

function showLoader() {
  apiLoader.classList.remove("hidden");
}

function hideLoader() {
  apiLoader.classList.add("hidden");
}


// 🔥 wake server ASAP
fetch("https://makout-api.onrender.com")
  .catch(() => {});

let apiSemesterCache = {}; 
const API_BASE_URL = "https://makout-api.onrender.com";

/* =========================
   MAKAUT GRADE POINT MAP
========================= */
const gradePoints = { O:10, E:9, A:8, B:7, C:6, D:5, F:2, I:2 };

let currentSemester = 1;

// Load session data
let semesterData = JSON.parse(sessionStorage.getItem("semesterData")) || {};

/* =========================
   INIT SEMESTERS
========================= */
initSemesters(8);

function initSemesters(count) {
  const tabs = document.getElementById("semesterTabs");
  tabs.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const tab = document.createElement("div");
    tab.className = "sem-tab" + (i === currentSemester ? " active" : "");
    tab.innerText = "Semester " + i;
    tab.onclick = () => switchSemester(i);
    tabs.appendChild(tab);
  }

}

/* =========================
   SEMESTER SWITCH
========================= */
function switchSemester(sem) {
  autoSaveCurrentSemester(); // 🔥 autosave before switching
  currentSemester = sem;

  document.querySelectorAll(".sem-tab")
    .forEach((t,i)=>t.classList.toggle("active", i+1===sem));

  loadSemester(sem);
}

/* =========================
   LOAD SEMESTER
========================= */
function loadSemester(sem) {
  document.getElementById("subjects").innerHTML = "";
  document.getElementById("mobileSubjects").innerHTML = "";

  // 1️⃣ USER DATA HAS PRIORITY
  if (semesterData[sem]?.subjects?.length) {
    semesterData[sem].subjects.forEach(s => {
      addSubjectFromData(s);
      addMobileSubject(s);
    });
    return; // 🔥 STOP HERE
  }

  // 2️⃣ ONLY USE API DATA IF NO USER DATA EXISTS
  if (apiSemesterCache[sem]) {
    apiSemesterCache[sem].forEach(s => {
      const subject = { name: s.name, credit: s.credit, grade: "O" };
      addSubjectFromData(subject);
      addMobileSubject(subject);
    });

    // Save API data ONCE so it becomes user data
    autoSaveCurrentSemester();
    return;
  }

  // 3️⃣ EMPTY SEMESTER
  addSubject();
}


/* =========================
   SUBJECT UI
========================= */
function addSubject() {
  const isMobile = window.innerWidth < 640;

  if (isMobile) {
    addMobileSubject({ name: "", credit: "", grade: "O" });
  } else {
    const tr = createSubjectRow({ name:"", credit:"", grade:"O" });
    document.getElementById("subjects").appendChild(tr);
  }

  autoSaveCurrentSemester();
}

function addSubjectFromData(s) {
  const tr = createSubjectRow(s);
  document.getElementById("subjects").appendChild(tr);
}


function createSubjectRow(data) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input class="input" value="${data.name || ""}"></td>
    <td><input type="number" step="0.5" class="input" value="${data.credit || ""}"></td>
    <td>
      <select class="input">
        ${Object.keys(gradePoints)
          .map(g => `<option ${g === data.grade ? "selected" : ""}>${g}</option>`)
          .join("")}
      </select>
    </td>
    <td>
      <button class="text-red-600 font-bold">✕</button>
    </td>
  `;

  // 🔥 AUTO SAVE ON EVERY INPUT
  tr.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", autoSaveCurrentSemester);
    el.addEventListener("change", autoSaveCurrentSemester);
  });

  tr.querySelector("button").onclick = () => {
    tr.remove();
    autoSaveCurrentSemester();
  };

  return tr;
}

/* =========================
   AUTO SAVE (CORE FIX)
========================= */
function autoSaveCurrentSemester() {
  const subjects = [];
  let totalCredits = 0;
  let totalPoints = 0;

  const isMobile = window.innerWidth < 640;
  const rows = isMobile
    ? document.querySelectorAll("#mobileSubjects .card")
    : document.querySelectorAll("#subjects tr");

  rows.forEach(row => {
    const inputs = row.querySelectorAll("input, select");
    const name = inputs[0].value.trim();
    const credit = parseFloat(inputs[1].value);
    const grade = inputs[2].value;

    if (!isNaN(credit) && credit > 0) {
      totalCredits += credit;
      totalPoints += credit * gradePoints[grade];
      subjects.push({ name, credit, grade });
    }
  });

  semesterData[currentSemester] = {
    subjects,
    totalCredits,
    totalPoints,
    sgpa: totalCredits ? +(totalPoints / totalCredits).toFixed(2) : 0
  };

  sessionStorage.setItem("semesterData", JSON.stringify(semesterData));
}

/* =========================
   SAVE BUTTON (OPTIONAL)
========================= */
function saveSemester() {
  autoSaveCurrentSemester();
  calculateAndDisplay();
}

/* =========================
   CALCULATE + DISPLAY
========================= */
function calculateAndDisplay() {
  const semKeys = Object.keys(semesterData);
  const semCount = semKeys.length;
  const cur = semesterData[currentSemester];

  if (!cur || cur.totalCredits === 0) return;

  document.getElementById("totalCredits").innerText = cur.totalCredits;
  document.getElementById("totalPoints").innerText = cur.totalPoints.toFixed(1);
  document.getElementById("sgpa").innerText = cur.sgpa;

  if (semCount >= 2) {
    let totalC = 0, totalP = 0;
    semKeys.forEach(k => {
      totalC += semesterData[k].totalCredits;
      totalP += semesterData[k].totalPoints;
    });

    const cgpa = +(totalP / totalC).toFixed(2);
    const percentage = +(cgpa * 9.5).toFixed(2);

    document.getElementById("cgpa").innerText = cgpa;
    document.getElementById("percentage").innerText = percentage + " %";
  } else {
    document.getElementById("cgpa").innerText = "-";
    document.getElementById("percentage").innerText = "-";
  }

  document.getElementById("result").classList.remove("hidden");
}

async function loadStreamData() {
  showLoader();   // 👈 ADD THIS LINE

  const stream = document.getElementById("streamSelect").value;
  if (!stream) return;

  apiSemesterCache = {};
  semesterData = {};
  sessionStorage.removeItem("semesterData");

  document.getElementById("subjects").innerHTML = "";
  document.getElementById("mobileSubjects").innerHTML = "";

  // 🔥 1️⃣ Load SEMESTER 1 FIRST
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/subjects?stream=${stream}&semester=1`
    );
    const data = await res.json();

    if (data.subjects) {
      apiSemesterCache[1] = data.subjects;
    }
  } catch {
    console.warn("Semester 1 failed");
  }

  // ✅ show sem 1 immediately
  switchSemester(1);
  hideLoader(); 

  // 🔄 2️⃣ Load remaining semesters in background
  for (let sem = 2; sem <= 8; sem++) {
    fetch(`${API_BASE_URL}/api/subjects?stream=${stream}&semester=${sem}`)
      .then(res => res.json())
      .then(data => { 
        if (data.subjects) {
          apiSemesterCache[sem] = data.subjects;
        }
      })
      .catch(() => {
        console.warn(`Semester ${sem} failed`);
      });
  }
}


function addMobileSubject(data) {
  const card = document.createElement("div");
  card.className = "card border";

  card.innerHTML = `
    <input class="input mb-2" placeholder="Subject / Lab"
      value="${data.name || ""}">
    <input type="number" step="0.5" class="input mb-2"
      placeholder="Credits" value="${data.credit || ""}">
    <select class="input mb-2">
      ${Object.keys(gradePoints)
        .map(g => `<option ${g===data.grade?"selected":""}>${g}</option>`)
        .join("")}
    </select>
    <button class="text-red-600 text-sm">Remove</button>
  `;

  card.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", autoSaveCurrentSemester);
    el.addEventListener("change", autoSaveCurrentSemester);
  });

  card.querySelector("button").onclick = () => {
    card.remove();
    autoSaveCurrentSemester();
  };

  document.getElementById("mobileSubjects").appendChild(card);
}

/* =========================
   BB-8 DARK / LIGHT MODE
========================= */

const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;

// Load saved theme
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  root.classList.add("dark");
  themeToggle.checked = true;
}

// Toggle theme
themeToggle.addEventListener("change", () => {
  if (themeToggle.checked) {
    root.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    root.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
});
async function getSGPAAIAdvice() {
  const aiTextEl = document.getElementById("aiText");
  const aiSection = document.getElementById("aiResult");

  if (!aiTextEl || !aiSection) {
    alert("AI UI not ready");
    return;
  }

  const cur = semesterData[currentSemester];

  if (!cur || !cur.sgpa || !cur.subjects?.length) {
    alert("Please calculate SGPA first.");
    return;
  }

  try {
    showLoader();

    const res = await fetch(
      "https://makout-back.onrender.com/api/sgpa-ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sgpa: Number(cur.sgpa),
          semester: currentSemester,
          subjects: cur.subjects
        })
      }
    );

    const data = await res.json();
    hideLoader();

aiTextEl.innerHTML = DOMPurify.sanitize(
  data.advice || "<div class='ai-report'>No AI advice generated.</div>"
);    aiSection.classList.remove("hidden");

  } catch (err) {
    hideLoader();
    console.error(err);
    alert("AI failed. Try again.");
  }
}
function generatePDF() {
  try {
    const cur = semesterData[currentSemester];

    if (!cur || !cur.sgpa || !cur.subjects || cur.subjects.length === 0) {
      alert("Please calculate SGPA first before downloading PDF.");
      return;
    }

    // ✅ Collect student details
    const studentName = document.getElementById("studentName")?.value || "N/A";
    const roll = document.getElementById("rollNumber")?.value || "N/A";
    const reg = document.getElementById("regNumber")?.value || "N/A";
    const college = document.getElementById("collegeName")?.value || "N/A";
    const stream = document.getElementById("stream")?.value || "N/A";

    // ✅ Build HTML for PDF
    const pdfBox = document.getElementById("pdfTemplate");

    const subjectRows = cur.subjects
      .map(
        (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.name}</td>
          <td>${s.credit}</td>
          <td>${s.grade}</td>
        </tr>
      `
      )
      .join("");

    pdfBox.innerHTML = `
      <div style="
        font-family: Arial, sans-serif;
        padding: 28px;
        color: #0f172a;
        width: 100%;
      ">
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h1 style="margin:0; font-size: 22px;">MAKAUT Grade Card (Unofficial)</h1>
            <p style="margin:6px 0 0; color:#475569; font-size:13px;">
              Generated from MAKAUT CGPA Calculator
            </p>
          </div>
          <div style="
            padding:10px 14px;
            border-radius:10px;
            border:1px solid #cbd5e1;
            font-weight:700;
            font-size:13px;
            background:#f8fafc;
          ">
            Semester ${currentSemester}
          </div>
        </div>

        <hr style="margin:18px 0; border:none; border-top:1px solid #e2e8f0;" />

        <h2 style="margin: 0 0 10px; font-size: 16px;">Student Details</h2>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <tr>
            <td style="padding:6px 0; color:#475569;">Name</td>
            <td style="padding:6px 0; font-weight:600;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#475569;">Roll No</td>
            <td style="padding:6px 0; font-weight:600;">${roll}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#475569;">Registration No</td>
            <td style="padding:6px 0; font-weight:600;">${reg}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#475569;">College</td>
            <td style="padding:6px 0; font-weight:600;">${college}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#475569;">Stream</td>
            <td style="padding:6px 0; font-weight:600;">${stream}</td>
          </tr>
        </table>

        <hr style="margin:18px 0; border:none; border-top:1px solid #e2e8f0;" />

        <h2 style="margin: 0 0 12px; font-size: 16px;">Subjects & Grades</h2>
        <table style="
          width:100%;
          border-collapse:collapse;
          font-size:13px;
          overflow:hidden;
          border-radius:10px;
        ">
          <thead>
            <tr style="background:#0f172a; color:white;">
              <th style="padding:10px; text-align:left;">#</th>
              <th style="padding:10px; text-align:left;">Subject</th>
              <th style="padding:10px; text-align:left;">Credits</th>
              <th style="padding:10px; text-align:left;">Grade</th>
            </tr>
          </thead>
          <tbody>
            ${subjectRows}
          </tbody>
        </table>

        <hr style="margin:18px 0; border:none; border-top:1px solid #e2e8f0;" />

        <h2 style="margin: 0 0 10px; font-size: 16px;">Result Summary</h2>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="flex:1; min-width:160px; padding:12px; background:#f1f5f9; border-radius:12px;">
            <div style="font-size:12px; color:#475569;">Total Credits</div>
            <div style="font-size:20px; font-weight:800;">${cur.totalCredits || "N/A"}</div>
          </div>

          <div style="flex:1; min-width:160px; padding:12px; background:#f1f5f9; border-radius:12px;">
            <div style="font-size:12px; color:#475569;">Credit Points</div>
            <div style="font-size:20px; font-weight:800;">${cur.creditPoints || "N/A"}</div>
          </div>

          <div style="flex:1; min-width:160px; padding:12px; background:#e0f2fe; border-radius:12px;">
            <div style="font-size:12px; color:#075985;">SGPA</div>
            <div style="font-size:20px; font-weight:900; color:#0369a1;">${cur.sgpa}</div>
          </div>
        </div>

        <p style="margin-top:20px; font-size:11px; color:#64748b;">
          ⚠️ Disclaimer: This PDF is auto-generated and unofficial. Values are calculated using input data.
        </p>

      </div>
    `;

    // ✅ show template (for rendering)
    pdfBox.style.display = "block";

    // ✅ PDF options
    const opt = {
      margin: 0.3,
      filename: `MAKAUT_GradeCard_Sem${currentSemester}_${studentName.replaceAll(" ", "_")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };

    html2pdf()
      .set(opt)
      .from(pdfBox)
      .save()
      .then(() => {
        // hide again after save
        pdfBox.style.display = "none";
      });

  } catch (err) {
    console.error(err);
    alert("PDF generation failed.");
  }
}

