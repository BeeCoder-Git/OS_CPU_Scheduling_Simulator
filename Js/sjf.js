document.addEventListener("DOMContentLoaded", () => {

  let processes = [];
  let processIdCounter = 1;

  const addForm = document.getElementById("add-process-form");
  const btInput = document.getElementById("burst-time");
  const atInput = document.getElementById("arrival-time");

  const errorMessage = document.getElementById("error-message");
  const processListBody = document.getElementById("process-list-body");
  const noProcessRow = document.getElementById("no-process-row");

  const runBtn = document.getElementById("run-simulation");
  const resetBtn = document.getElementById("reset-simulation");

  const outputSection = document.getElementById("output-section");
  const ganttChart = document.getElementById("gantt-chart");
  const ganttTime = document.getElementById("gantt-time");
  const resultsTableBody = document.getElementById("results-table-body");
  const averageResults = document.getElementById("average-results");

  const COLORS = [
    "bg-blue-600", "bg-green-600", "bg-red-600", "bg-purple-600",
    "bg-yellow-500", "bg-pink-500", "bg-teal-600", "bg-orange-500"
  ];

  function refreshProcessList() {
    processListBody.innerHTML = "";
    if (processes.length === 0) {
      processListBody.appendChild(noProcessRow);
      runBtn.disabled = true;
      resetBtn.disabled = true;
      return;
    }

    processes.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-3">${p.id}</td>
        <td class="px-4 py-3">${p.burst}</td>
        <td class="px-4 py-3">${p.arrival}</td>
      `;
      processListBody.appendChild(tr);
    });

    runBtn.disabled = false;
    resetBtn.disabled = false;
  }

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    errorMessage.textContent = "";

    let bt = parseInt(btInput.value);
    let at = parseInt(atInput.value);

    if (bt <= 0 || at < 0) {
      errorMessage.textContent = "Invalid burst / arrival time!";
      return;
    }

    processes.push({
      id: "P" + processIdCounter++,
      burst: bt,
      arrival: at
    });

    btInput.value = "";
    atInput.value = "";
    refreshProcessList();
  });

  runBtn.addEventListener("click", () => {

    const n = processes.length;
    let time = 0;
    let completed = 0;
    const execLog = [];

    const procCopy = processes.map(p => ({ ...p, remaining: p.burst, start: -1, completion: 0 }));
    procCopy.sort((a, b) => a.arrival - b.arrival);

    while (completed < n) {
      let candidates = procCopy.filter(p => p.arrival <= time && p.remaining > 0);

      if (candidates.length === 0) {
        execLog.push({ id: "IDLE", start: time, end: time + 1 });
        time++;
        continue;
      }

      candidates.sort((a, b) => a.remaining - b.remaining);
      let p = candidates[0];

      if (p.start === -1) p.start = time;

      execLog.push({ id: p.id, start: time, end: time + p.remaining });

      time += p.remaining;
      p.remaining = 0;
      p.completion = time;

      completed++;
    }

    const results = procCopy.map(p => ({
      id: p.id,
      burst: p.burst,
      arrival: p.arrival,
      start: p.start,
      completion: p.completion,
      turnaround: p.completion - p.arrival,
      waiting: p.start - p.arrival
    }));

    renderGantt(execLog);
    renderResults(results);
    outputSection.classList.remove("hidden");
  });

  function renderGantt(logs) {
    ganttChart.innerHTML = "";
    ganttTime.innerHTML = "";

    const totalTime = logs[logs.length - 1].end;

    logs.forEach((entry, index) => {
      const width = ((entry.end - entry.start) / totalTime) * 100;

      const block = document.createElement("div");
      block.style.width = width + "%";
      block.className =
        "h-full flex justify-center items-center text-white " +
        (entry.id === "IDLE" ? "bg-gray-400" : COLORS[index % COLORS.length]);

      block.textContent = entry.id;
      ganttChart.appendChild(block);

      const marker = document.createElement("span");
      marker.className = "absolute text-xs";
      marker.style.left = (entry.end / totalTime) * 100 + "%";
      marker.textContent = entry.end;
      ganttTime.appendChild(marker);
    });
  }

  function renderResults(results) {
    resultsTableBody.innerHTML = "";

    let totalTurnaround = 0;
    let totalWaiting = 0;

    results.forEach(r => {
      totalTurnaround += r.turnaround;
      totalWaiting += r.waiting;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2">${r.id}</td>
        <td class="px-4 py-2">${r.burst}</td>
        <td class="px-4 py-2">${r.arrival}</td>
        <td class="px-4 py-2">${r.start}</td>
        <td class="px-4 py-2">${r.completion}</td>
        <td class="px-4 py-2">${r.turnaround}</td>
        <td class="px-4 py-2">${r.waiting}</td>
      `;
      resultsTableBody.appendChild(tr);
    });

    averageResults.innerHTML = `
      <div class="p-4 bg-blue-100 rounded-lg">
        <p class="text-sm text-blue-800">Average Turnaround Time</p>
        <p class="text-2xl font-bold text-blue-900">${(totalTurnaround / results.length).toFixed(2)}</p>
      </div>

      <div class="p-4 bg-green-100 rounded-lg">
        <p class="text-sm text-green-800">Average Waiting Time</p>
        <p class="text-2xl font-bold text-green-900">${(totalWaiting / results.length).toFixed(2)}</p>
      </div>
    `;
  }

  resetBtn.addEventListener("click", () => {
    processes = [];
    processIdCounter = 1;

    ganttChart.innerHTML = "";
    ganttTime.innerHTML = "";
    resultsTableBody.innerHTML = "";
    averageResults.innerHTML = "";
    outputSection.classList.add("hidden");

    btInput.value = "";
    atInput.value = "";

    refreshProcessList();
  });

  refreshProcessList();
});
