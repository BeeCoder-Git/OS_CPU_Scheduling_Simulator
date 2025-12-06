runButton.addEventListener('click', () => {
    if (processes.length === 0) return;

    let simProcesses = JSON.parse(JSON.stringify(processes));

    // Prepare arrays
    let n = simProcesses.length;
    let remaining = simProcesses.map(p => p.burstTime);
    let time = 0;
    let completed = 0;

    let gantt = [];
    let results = new Array(n).fill(null);

    // Keep track of when each block starts and ends
    let ganttBlocks = [];
    let prev = null;

    while (completed < n) {

        // Select highest priority process available
        let idx = -1;
        let bestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (simProcesses[i].arrivalTime <= time && remaining[i] > 0) {
                if (simProcesses[i].priority < bestPriority) {
                    bestPriority = simProcesses[i].priority;
                    idx = i;
                }
            }
        }

        if (idx === -1) {
            // CPU idle
            if (prev === "IDLE") {
                ganttBlocks[ganttBlocks.length - 1].end++;
            } else {
                ganttBlocks.push({ id: "IDLE", start: time, end: time + 1 });
            }
            prev = "IDLE";
            time++;
            continue;
        }

        let currentPID = simProcesses[idx].processID;

        // Start Gantt block or extend previous one
        if (prev === currentPID) {
            ganttBlocks[ganttBlocks.length - 1].end++;
        } else {
            ganttBlocks.push({ id: currentPID, start: time, end: time + 1 });
        }
        prev = currentPID;

        remaining[idx]--;
        time++;

        // When process completes
        if (remaining[idx] === 0) {
            completed++;

            let finish = time;

            let arr = simProcesses[idx].arrivalTime;
            let bt = simProcesses[idx].burstTime;

            results[idx] = {
                id: currentPID,
                burstTime: bt,
                arrivalTime: arr,
                priority: simProcesses[idx].priority,
                startTime: ganttBlocks.find(b => b.id === currentPID).start,
                completionTime: finish,
                turnaroundTime: finish - arr,
                waitingTime: finish - arr - bt,
                addIndex: simProcesses[idx].addIndex
            };
        }
    }

    // Render all results
    renderGantt(ganttBlocks);
    renderResultsTable(results);
    renderAverages(results);

    outputSection.classList.remove('hidden');
});
