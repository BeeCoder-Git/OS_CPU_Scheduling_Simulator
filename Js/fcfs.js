document.addEventListener('DOMContentLoaded', () => {

  let processes = [];
  let processIdCounter = 1;

  const GANTT_COLORS = [
    'bg-blue-600','bg-green-600','bg-red-600','bg-yellow-500','bg-purple-600',
    'bg-pink-500','bg-indigo-600','bg-teal-600','bg-orange-500','bg-cyan-600'
  ];

  const burstTimeInput = document.getElementById('burst-time');
  const arrivalTimeInput = document.getElementById('arrival-time');
  const addProcessForm = document.getElementById('add-process-form');
  const processListBody = document.getElementById('process-list-body');
  const runButton = document.getElementById('run-simulation');
  const resetButton = document.getElementById('reset-simulation');

  const outputSection = document.getElementById('output-section');
  const ganttChart = document.getElementById('gantt-chart');
  const ganttTime = document.getElementById('gantt-time');
  const resultsTableBody = document.getElementById('results-table-body');
  const averageResults = document.getElementById('average-results');
  const errorMessage = document.getElementById('error-message');
  const noProcessRow = document.getElementById('no-process-row');


  function updateProcessList() {
    processListBody.innerHTML = '';

    if (processes.length === 0) {
      processListBody.appendChild(noProcessRow);
      runButton.disabled = true;
      resetButton.disabled = true;
      return;
    }

    processes.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3 text-sm">${p.id}</td>
        <td class="px-4 py-3 text-sm">${p.burstTime}</td>
        <td class="px-4 py-3 text-sm">${p.arrivalTime}</td>
      `;
      processListBody.appendChild(tr);
    });

    runButton.disabled = false;
    resetButton.disabled = false;
  }


  addProcessForm.addEventListener('submit', e => {
    e.preventDefault();
    errorMessage.textContent = '';

    const bt = Number(burstTimeInput.value);
    const at = Number(arrivalTimeInput.value);

    if (bt <= 0 || Number.isNaN(bt)) {
      errorMessage.textContent = 'Invalid burst time.';
      return;
    }
    if (at < 0 || Number.isNaN(at)) {
      errorMessage.textContent = 'Invalid arrival time.';
      return;
    }

    processes.push({
      id: `P${processIdCounter++}`,
      burstTime: bt,
      arrivalTime: at,
      addIndex: processes.length
    });

    burstTimeInput.value = '';
    arrivalTimeInput.value = '';
    outputSection.classList.add('hidden');
    updateProcessList();
  });


  runButton.addEventListener('click', () => {
    if (processes.length === 0) return;

    const sorted = [...processes].sort((a, b) =>
      a.arrivalTime !== b.arrivalTime
        ? a.arrivalTime - b.arrivalTime
        : a.addIndex - b.addIndex
    );

    let currentTime = 0;
    const results = [];

    sorted.forEach(p => {
      const startTime = Math.max(currentTime, p.arrivalTime);
      const completionTime = startTime + p.burstTime;

      results.push({
        id: p.id,
        burstTime: p.burstTime,
        arrivalTime: p.arrivalTime,
        startTime,
        completionTime,
        turnaroundTime: completionTime - p.arrivalTime,
        waitingTime: startTime - p.arrivalTime
      });

      currentTime = completionTime;
    });

    renderGantt(results);
    renderResultsTable(results);
    renderAverages(results);
    outputSection.classList.remove('hidden');
  });


  function renderGantt(results) {
    ganttChart.innerHTML = '';
    ganttTime.innerHTML = '';

    if (results.length === 0) return;

    let lastTime = 0;
    const totalSpan = results[results.length - 1].completionTime;

    const zeroMarker = document.createElement('span');
    zeroMarker.className = "absolute text-xs";
    zeroMarker.style.left = "0%";
    zeroMarker.textContent = "0";
    ganttTime.appendChild(zeroMarker);

    results.forEach((r, i) => {

      if (r.startTime > lastTime) {
        const idle = document.createElement('div');
        idle.className = "h-full flex justify-center items-center bg-gray-400/60 text-xs";
        idle.style.width = ((r.startTime - lastTime) / totalSpan) * 100 + "%";
        idle.textContent = "IDLE";
        ganttChart.appendChild(idle);
      }

      const block = document.createElement('div');
      block.className = `h-full flex justify-center items-center text-white font-semibold ${GANTT_COLORS[i % GANTT_COLORS.length]}`;
      block.style.width = (r.burstTime / totalSpan) * 100 + "%";
      block.textContent = r.id;
      ganttChart.appendChild(block);

      const marker = document.createElement('span');
      marker.className = "absolute text-xs font-medium";
      marker.style.left = (r.completionTime / totalSpan * 100) + "%";
      marker.textContent = r.completionTime;
      ganttTime.appendChild(marker);

      lastTime = r.completionTime;
    });
  }


  function renderResultsTable(results) {
    resultsTableBody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-2 text-sm">${r.id}</td>
        <td class="px-4 py-2 text-sm">${r.burstTime}</td>
        <td class="px-4 py-2 text-sm">${r.arrivalTime}</td>
        <td class="px-4 py-2 text-sm">${r.startTime}</td>
        <td class="px-4 py-2 text-sm">${r.completionTime}</td>
        <td class="px-4 py-2 text-sm">${r.turnaroundTime}</td>
        <td class="px-4 py-2 text-sm">${r.waitingTime}</td>
      `;
      resultsTableBody.appendChild(tr);
    });
  }


  function renderAverages(results) {
    const totalTAT = results.reduce((acc, r) => acc + r.turnaroundTime, 0);
    const totalWT  = results.reduce((acc, r) => acc + r.waitingTime, 0);

    averageResults.innerHTML = `
      <div class="p-4 bg-sky-100 rounded-lg">
        <p class="text-sm text-sky-800">Average Turnaround Time</p>
        <p class="text-2xl font-bold text-sky-900">${(totalTAT / results.length).toFixed(2)}</p>
      </div>

      <div class="p-4 bg-green-100 rounded-lg">
        <p class="text-sm text-green-800">Average Waiting Time</p>
        <p class="text-2xl font-bold text-green-900">${(totalWT / results.length).toFixed(2)}</p>
      </div>
    `;
  }


  resetButton.addEventListener('click', () => {
    processes = [];
    processIdCounter = 1;

    ganttChart.innerHTML = '';
    ganttTime.innerHTML = '';
    resultsTableBody.innerHTML = '';
    averageResults.innerHTML = '';

    outputSection.classList.add('hidden');
    updateProcessList();
  });


  updateProcessList();
});
