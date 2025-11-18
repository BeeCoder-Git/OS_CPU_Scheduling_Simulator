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
      remainingTime: bt,
      addIndex: processes.length
    });

    burstTimeInput.value = '';
    arrivalTimeInput.value = '';
    outputSection.classList.add('hidden');
    updateProcessList();
  });


  runButton.addEventListener('click', () => {
    if (processes.length === 0) return;

    let currentTime = 0;
    const results = [];
    const ganttData = [];
    let remainingProcesses = JSON.parse(JSON.stringify(processes));
    let completed = 0;

    while(completed < processes.length) {
      const arrived = remainingProcesses.filter(p => p.arrivalTime <= currentTime && p.remainingTime > 0);

      if (arrived.length === 0) {
        const nextArrival = Math.min(...remainingProcesses.filter(p => p.remainingTime > 0).map(p => p.arrivalTime));
        if (nextArrival > currentTime) {
            ganttData.push({ id: 'IDLE', start: currentTime, end: nextArrival });
            currentTime = nextArrival;
            continue;
        }
      }

      arrived.sort((a, b) => a.remainingTime - b.remainingTime);
      const currentProcess = arrived[0];
      
      const startTime = currentTime;
      currentTime++;
      currentProcess.remainingTime--;

      if (ganttData.length > 0 && ganttData[ganttData.length - 1].id === currentProcess.id) {
        ganttData[ganttData.length - 1].end = currentTime;
      } else {
        ganttData.push({ id: currentProcess.id, start: startTime, end: currentTime });
      }

      if (currentProcess.remainingTime === 0) {
        completed++;
        const originalProcess = processes.find(p => p.id === currentProcess.id);
        results.push({
          ...originalProcess,
          completionTime: currentTime,
          turnaroundTime: currentTime - originalProcess.arrivalTime,
          waitingTime: currentTime - originalProcess.arrivalTime - originalProcess.burstTime,
          startTime: -1 // Will be calculated later
        });
      }
    }

    const finalResults = processes.map(p => {
        const res = results.find(r => r.id === p.id);
        const firstGanttEntry = ganttData.find(g => g.id === p.id);
        return {
            ...res,
            startTime: firstGanttEntry ? firstGanttEntry.start : -1
        };
    });


    renderGantt(ganttData);
    renderResultsTable(finalResults);
    renderAverages(finalResults);
    outputSection.classList.remove('hidden');
  });


  function renderGantt(ganttData) {
    ganttChart.innerHTML = '';
    ganttTime.innerHTML = '';

    if (ganttData.length === 0) return;

    const totalSpan = ganttData[ganttData.length - 1].end;

    const zeroMarker = document.createElement('span');
    zeroMarker.className = "absolute text-xs";
    zeroMarker.style.left = "0%";
    zeroMarker.textContent = "0";
    ganttTime.appendChild(zeroMarker);

    ganttData.forEach((data, i) => {
      const duration = data.end - data.start;
      const block = document.createElement('div');
      if (data.id === 'IDLE') {
        block.className = "h-full flex justify-center items-center bg-gray-400/60 text-xs";
        block.textContent = "IDLE";
      } else {
        const process = processes.find(p => p.id === data.id);
        const colorIndex = process.addIndex % GANTT_COLORS.length;
        block.className = `h-full flex justify-center items-center text-white font-semibold ${GANTT_COLORS[colorIndex]}`;
        block.textContent = data.id;
      }
      block.style.width = (duration / totalSpan) * 100 + "%";
      ganttChart.appendChild(block);

      const marker = document.createElement('span');
      marker.className = "absolute text-xs font-medium";
      marker.style.left = (data.end / totalSpan * 100) + "%";
      marker.textContent = data.end;
      ganttTime.appendChild(marker);
    });
  }


  function renderResultsTable(results) {
    resultsTableBody.innerHTML = '';
    results.sort((a,b) => a.addIndex - b.addIndex).forEach(r => {
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
