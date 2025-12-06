document.addEventListener('DOMContentLoaded', () => {

  let processes = [];
  let processIdCounter = 1;

  const GANTT_COLORS = [
    'bg-blue-600','bg-green-600','bg-red-600','bg-yellow-500','bg-purple-600',
    'bg-pink-500','bg-indigo-600','bg-teal-600','bg-orange-500','bg-cyan-600'
  ];

  const burstTimeInput = document.getElementById('burst-time');
  const arrivalTimeInput = document.getElementById('arrival-time');
  const priorityInput = document.getElementById('priority');
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

  class Process {
    constructor(processID, arrivalTime, priority, burstTime, addIndex) {
        this.processID = processID;
        this.arrivalTime = arrivalTime;
        this.priority = priority;
        this.burstTime = burstTime;
        this.tempburstTime = burstTime; // Original burst time
        this.remainingTime = burstTime; // For preemptive
        this.responsetime = -1;
        this.outtime = 0;
        this.intime = -1;
        this.addIndex = addIndex; // To maintain original order for display
        this.startTime = -1; // First time process starts execution
    }
  }

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
        <td class="px-4 py-3 text-sm">${p.processID}</td>
        <td class="px-4 py-3 text-sm">${p.burstTime}</td>
        <td class="px-4 py-3 text-sm">${p.arrivalTime}</td>
        <td class="px-4 py-3 text-sm">${p.priority}</td>
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
    const priority = Number(priorityInput.value);

    if (bt <= 0 || Number.isNaN(bt)) {
      errorMessage.textContent = 'Invalid burst time.';
      return;
    }
    if (at < 0 || Number.isNaN(at)) {
      errorMessage.textContent = 'Invalid arrival time.';
      return;
    }
    if (priority < 0 || Number.isNaN(priority)) {
      errorMessage.textContent = 'Invalid priority.';
      return;
    }

    processes.push(new Process(`P${processIdCounter++}`, at, priority, bt, processes.length));

    burstTimeInput.value = '';
    arrivalTimeInput.value = '';
    priorityInput.value = '';
    outputSection.classList.add('hidden');
    updateProcessList();
  });


  runButton.addEventListener('click', () => {
    if (processes.length === 0) return;

    // Deep copy processes to avoid modifying original data
    let simProcesses = JSON.parse(JSON.stringify(processes));
    simProcesses.forEach(p => {
        p.remainingTime = p.burstTime;
        p.responsetime = -1;
        p.outtime = 0;
        p.intime = -1;
        p.startTime = -1;
    });

    // Sort by arrival time for scanning arrivals
    simProcesses.sort((a, b) => {
      if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
      return a.addIndex - b.addIndex;
    });

    let currentTime = 0;
    let completedProcesses = 0;
    const ganttBlocks = [];
    let prevId = null;

    const n = simProcesses.length;
    const remaining = simProcesses.map(p => p.remainingTime);

    // Helper: find next index among simProcesses corresponding to original addIndex
    function findSimIndexByPID(pid) {
      return simProcesses.findIndex(p => p.processID === pid);
    }

    // Main loop
    while (completedProcesses < n) {
        // Select highest priority process available at currentTime
        let idx = -1;
        let bestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (simProcesses[i].arrivalTime <= currentTime && simProcesses[i].remainingTime > 0) {
                // Priority: lower numerical value = higher priority
                if (simProcesses[i].priority < bestPriority) {
                    bestPriority = simProcesses[i].priority;
                    idx = i;
                } else if (simProcesses[i].priority === bestPriority) {
                    // Tie-breaker: earlier arrival or lower addIndex (stable)
                    const curr = simProcesses[idx];
                    const cand = simProcesses[i];
                    if (cand.arrivalTime < curr.arrivalTime) {
                        idx = i;
                    } else if (cand.arrivalTime === curr.arrivalTime && cand.addIndex < curr.addIndex) {
                        idx = i;
                    }
                }
            }
        }

        if (idx === -1) {
            // If no process available, advance time to next arrival (or 1 unit) and mark IDLE
            // Find next arrival
            let nextArrival = Infinity;
            for (let i = 0; i < n; i++) {
                if (simProcesses[i].remainingTime > 0 && simProcesses[i].arrivalTime > currentTime) {
                    nextArrival = Math.min(nextArrival, simProcesses[i].arrivalTime);
                }
            }

            // If no more arrivals (shouldn't happen if completedProcesses < n), break
            if (nextArrival === Infinity) break;

            // Record idle block between currentTime and nextArrival
            if (ganttBlocks.length > 0 && ganttBlocks[ganttBlocks.length - 1].id === 'IDLE') {
                ganttBlocks[ganttBlocks.length - 1].end = nextArrival;
            } else {
                ganttBlocks.push({ id: 'IDLE', start: currentTime, end: nextArrival });
            }
            currentTime = nextArrival;
            prevId = 'IDLE';
            continue;
        }

        // If process starts first time, set startTime
        if (simProcesses[idx].startTime === -1) {
            simProcesses[idx].startTime = currentTime;
        }

        const executingPid = simProcesses[idx].processID;

        // Append/extend Gantt block for 1 unit (preemptive executes in quanta = 1)
        if (ganttBlocks.length > 0 && ganttBlocks[ganttBlocks.length - 1].id === executingPid) {
            ganttBlocks[ganttBlocks.length - 1].end = currentTime + 1;
        } else {
            ganttBlocks.push({ id: executingPid, start: currentTime, end: currentTime + 1 });
        }

        // Execute for 1 time unit
        simProcesses[idx].remainingTime--;
        currentTime++;

        // If process completes
        if (simProcesses[idx].remainingTime === 0) {
            simProcesses[idx].outtime = currentTime;
            completedProcesses++;
        }

        // After executing 1 unit, preemption will be considered naturally in next loop iteration
        prevId = executingPid;
    }

    // Build final results array (one entry per original process)
    // We want results sorted by addIndex when displayed (renderResultsTable sorts them)
    const finalResults = [];

    // Note: simProcesses was sorted by arrival; we must map back to original addIndex for display
    // Create a mapping from addIndex to simProcesses entry
    const byAddIndex = {};
    simProcesses.forEach(p => {
      byAddIndex[p.addIndex] = p;
    });

    // Ensure we iterate addIndex 0..(original count-1)
    for (let ai = 0; ai < processes.length; ai++) {
      let p = byAddIndex[ai];
      if (!p) {
        // This should not happen, but safety fallback to find by addIndex inside processes
        p = simProcesses.find(x => x.addIndex === ai) || processes[ai];
      }

      // If a process has not completed (edge cases), compute completion as last gantt end for that pid
      let completionTime = p.outtime;
      if (!completionTime || completionTime === 0) {
        // find last gantt block with this id
        const lastBlock = ganttBlocks.slice().reverse().find(b => b.id === p.processID);
        if (lastBlock) completionTime = lastBlock.end;
        else completionTime = p.arrivalTime; // fallback
      }

      const turnaround = completionTime - p.arrivalTime;
      const waiting = turnaround - p.burstTime;

      finalResults.push({
        id: p.processID,
        burstTime: p.burstTime,
        arrivalTime: p.arrivalTime,
        priority: p.priority,
        startTime: p.startTime === -1 ? '' : p.startTime,
        completionTime: completionTime,
        turnaroundTime: turnaround,
        waitingTime: waiting,
        addIndex: p.addIndex
      });
    }

    renderGantt(ganttBlocks);
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

    ganttData.forEach((data) => {
      const duration = data.end - data.start;
      const block = document.createElement('div');
      if (data.id === 'IDLE') {
        block.className = "h-full flex justify-center items-center bg-gray-400/60 text-xs";
        block.textContent = "IDLE";
      } else {
        const process = processes.find(p => p.processID === data.id);
        const colorIndex = (process && typeof process.addIndex === 'number') ? process.addIndex % GANTT_COLORS.length : 0;
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
    // If results has undefined entries or null, filter them out
    const safeResults = results.filter(r => r !== null && typeof r !== 'undefined');
    safeResults.sort((a,b) => a.addIndex - b.addIndex).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-2 text-sm">${r.id}</td>
        <td class="px-4 py-2 text-sm">${r.burstTime}</td>
        <td class="px-4 py-2 text-sm">${r.arrivalTime}</td>
        <td class="px-4 py-2 text-sm">${r.priority}</td>
        <td class="px-4 py-2 text-sm">${r.startTime}</td>
        <td class="px-4 py-2 text-sm">${r.completionTime}</td>
        <td class="px-4 py-2 text-sm">${r.turnaroundTime}</td>
        <td class="px-4 py-2 text-sm">${r.waitingTime}</td>
      `;
      resultsTableBody.appendChild(tr);
    });
  }


  function renderAverages(results) {
    const safe = results.filter(r => r !== null && typeof r !== 'undefined');
    if (safe.length === 0) {
      averageResults.innerHTML = '';
      return;
    }

    const totalTAT = safe.reduce((acc, r) => acc + r.turnaroundTime, 0);
    const totalWT  = safe.reduce((acc, r) => acc + r.waitingTime, 0);

    averageResults.innerHTML = `
      <div class="p-4 bg-sky-100 rounded-lg">
        <p class="text-sm text-sky-800">Average Turnaround Time</p>
        <p class="text-2xl font-bold text-sky-900">${(totalTAT / safe.length).toFixed(2)}</p>
      </div>

      <div class="p-4 bg-green-100 rounded-lg">
        <p class="text-sm text-green-800">Average Waiting Time</p>
        <p class="text-2xl font-bold text-green-900">${(totalWT / safe.length).toFixed(2)}</p>
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
