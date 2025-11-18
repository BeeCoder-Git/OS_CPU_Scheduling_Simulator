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

    simProcesses.sort((a, b) => a.arrivalTime - b.arrivalTime);

    let currentTime = 0;
    let completedProcesses = 0;
    const ganttData = [];
    const finalResults = [];

    let minHeap = []; // Using an array to simulate min-heap
    let heapSize = 0;

    function insertHeap(process, cTime) {
        process.intime = cTime;
        minHeap[heapSize] = process;
        let current = heapSize;
        heapSize++;

        while (current !== 0 && minHeap[Math.floor((current - 1) / 2)].priority > minHeap[current].priority) {
            [minHeap[Math.floor((current - 1) / 2)], minHeap[current]] = [minHeap[current], minHeap[Math.floor((current - 1) / 2)]];
            current = Math.floor((current - 1) / 2);
        }
    }

    function heapify(start) {
        let smallest = start;
        let left = 2 * start + 1;
        let right = 2 * start + 2;
        if (left < heapSize && minHeap[left].priority < minHeap[smallest].priority) {
            smallest = left;
        }
        if (right < heapSize && minHeap[right].priority < minHeap[smallest].priority) {
            smallest = right;
        }

        if (smallest !== start) {
            [minHeap[start], minHeap[smallest]] = [minHeap[smallest], minHeap[start]];
            heapify(smallest);
        }
    }

    function extractMinHeap(cTime) {
        let min_process = minHeap[0];
        if (min_process.responsetime === -1) {
            min_process.responsetime = cTime - min_process.arrivalTime;
        }
        heapSize--;
        if (heapSize >= 1) {
            minHeap[0] = minHeap[heapSize];
            heapify(0);
        }
        return min_process;
    }

    let processIndex = 0;
    let prevProcessId = null;

    while (completedProcesses < simProcesses.length) {
        // Add arrived processes to the heap
        while (processIndex < simProcesses.length && simProcesses[processIndex].arrivalTime <= currentTime) {
            insertHeap(simProcesses[processIndex], currentTime);
            processIndex++;
        }

        if (heapSize === 0) {
            // CPU is idle, advance time to next arrival
            let nextArrivalTime = Infinity;
            if (processIndex < simProcesses.length) {
                nextArrivalTime = simProcesses[processIndex].arrivalTime;
            }
            if (nextArrivalTime !== Infinity) {
                if (ganttData.length > 0 && ganttData[ganttData.length - 1].id === 'IDLE') {
                    ganttData[ganttData.length - 1].end = nextArrivalTime;
                } else {
                    ganttData.push({ id: 'IDLE', start: currentTime, end: nextArrivalTime });
                }
                currentTime = nextArrivalTime;
            } else {
                // No more processes to arrive and heap is empty, break
                break;
            }
            continue;
        }

        let currentExecutingProcess = extractMinHeap(currentTime);

        if (currentExecutingProcess.startTime === -1) {
            currentExecutingProcess.startTime = currentTime;
        }

        // Add to Gantt Chart
        if (ganttData.length > 0 && ganttData[ganttData.length - 1].id === currentExecutingProcess.processID) {
            ganttData[ganttData.length - 1].end = currentTime + 1;
        } else {
            ganttData.push({ id: currentExecutingProcess.processID, start: currentTime, end: currentTime + 1 });
        }

        currentExecutingProcess.remainingTime--;
        currentTime++;

        if (currentExecutingProcess.remainingTime === 0) {
            currentExecutingProcess.outtime = currentTime;
            finalResults.push({
                id: currentExecutingProcess.processID,
                burstTime: currentExecutingProcess.burstTime,
                arrivalTime: currentExecutingProcess.arrivalTime,
                priority: currentExecutingProcess.priority,
                startTime: currentExecutingProcess.startTime,
                completionTime: currentExecutingProcess.outtime,
                turnaroundTime: currentExecutingProcess.outtime - currentExecutingProcess.arrivalTime,
                waitingTime: currentExecutingProcess.outtime - currentExecutingProcess.arrivalTime - currentExecutingProcess.burstTime,
                addIndex: currentExecutingProcess.addIndex
            });
            completedProcesses++;
        } else {
            // Re-insert if not finished
            insertHeap(currentExecutingProcess, currentTime);
        }
    }

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

    ganttData.forEach((data) => {
      const duration = data.end - data.start;
      const block = document.createElement('div');
      if (data.id === 'IDLE') {
        block.className = "h-full flex justify-center items-center bg-gray-400/60 text-xs";
        block.textContent = "IDLE";
      } else {
        const process = processes.find(p => p.processID === data.id);
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