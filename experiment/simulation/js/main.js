let inputsPanel, outputsPanel, chartStatsPanel, panelHolder;
let simInputsContainer, simOutputsContainer, analysisInputsContainer, analysisOutputsContainer;

function initialize() {
  inputsPanel = document.getElementById('inputs-panel');
  outputsPanel = document.getElementById('outputs-panel');
  chartStatsPanel = document.getElementById('chart-stats-panel');
  panelHolder = document.getElementById('panel-holder');
  
  simInputsContainer = document.getElementById('simulation-inputs-column');
  simOutputsContainer = document.getElementById('simulation-outputs-column');
  analysisInputsContainer = document.getElementById('analysis-inputs-column');
  analysisOutputsContainer = document.getElementById('analysis-outputs-column');

  createGrid(); 
  setupInputListeners();
  setMode('normal'); 
  switchMainTask('simulation'); 
  updatePathlossAndMetrics();
  loadChartJS();
}

function switchMainTask(taskName) {
  document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.main-task-btn').forEach(btn => btn.classList.remove('active'));

  panelHolder.appendChild(inputsPanel);
  panelHolder.appendChild(outputsPanel);
  panelHolder.appendChild(chartStatsPanel);

  document.getElementById(taskName + '-page').classList.add('active');
  document.getElementById(taskName + '-task-btn').classList.add('active');

  if (taskName === 'simulation') {
    simInputsContainer.appendChild(inputsPanel);
    simOutputsContainer.appendChild(outputsPanel);
  } else {
    analysisInputsContainer.appendChild(inputsPanel);
    analysisOutputsContainer.appendChild(chartStatsPanel);
    setTimeout(() => {
        if(analysisChart) analysisChart.resize();
        updateChart();
    }, 10);
  }
}


const originalUpdatePathlossAndMetrics = updatePathlossAndMetrics;
updatePathlossAndMetrics = function() {
  originalUpdatePathlossAndMetrics();
  if (analysisChart && document.getElementById('analysis-page').classList.contains('active')) {
    updateChart();
  }
};

// ... (The rest of the JS code from the previous step is identical) ...
const gridSize = 18; 
const rows = 31;
const cols = 31;
const transmitter = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }; 
const CELL_SIZE_METERS = 100; 

let currentMode = 'normal'; 
let cells = [];

const MAX_SHADOW_FADE_DISTANCE_GRID_UNITS = 12; 
const MAX_VISUAL_ALPHA = 0.03; 
const MIN_VISUAL_ALPHA = 0.002; 

const environmentFactors = {
  urban: { pathLossOffset: 5, name: "Urban" },     
  suburban: { pathLossOffset: 2, name: "Suburban" }, 
  rural: { pathLossOffset: 0, name: "Rural" }      
};

const gridContainer = document.getElementById("grid-container");
gridContainer.style.display = 'grid';
gridContainer.style.gridTemplateRows = `repeat(${rows}, ${gridSize}px)`;
gridContainer.style.gridTemplateColumns = `repeat(${cols}, ${gridSize}px)`;
gridContainer.style.width = `${cols * gridSize}px`; 
gridContainer.style.height = `${rows * gridSize}px`; 

const tooltip = document.createElement("div");
tooltip.className = "tooltip";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

function createGrid() {
  gridContainer.innerHTML = ''; 
  cells = [];
  
  for (let row = 0; row < rows; row++) {
    cells[row] = [];
    for (let col = 0; col < cols; col++) {
      const cellElement = document.createElement("div");
      cellElement.classList.add("cell");
      cellElement.dataset.row = row;
      cellElement.dataset.col = col;

      if (row === transmitter.y && col === transmitter.x) {
        cellElement.classList.add("transmitter");
      }

      gridContainer.appendChild(cellElement); 
      cells[row][col] = {
        element: cellElement, basePathloss: 0, currentPathloss: 0, receivedPower: 0,
        lossComponents: { base: 0, obstacleShadow: 0 }, 
        obstacleType: null, isOutage: false, distance: 0,
        isVisuallyShadowed: false, 
        distanceForTinge: MAX_SHADOW_FADE_DISTANCE_GRID_UNITS + 1,
        lateralScaleForTinge: 0 
      };

      cellElement.addEventListener('click', () => handleCellClick(row, col));
      cellElement.addEventListener('mouseover', (e) => showTooltip(e, row, col));
      cellElement.addEventListener('mouseout', () => hideTooltip());
    }
  }
}

function calculateFreeSpacePathLoss(distanceM, frequencyMHz) {
  if (distanceM <= 0) return 0; 
  return 20 * Math.log10(distanceM) + 20 * Math.log10(frequencyMHz) - 27.55;
}

function calculatePathLoss(distanceM, frequencyMHz, environment) {
  if (distanceM <= 0) return 0;
  const freeSpacePL = calculateFreeSpacePathLoss(Math.max(1, distanceM), frequencyMHz); 
  const envData = environmentFactors[environment];
  return freeSpacePL + envData.pathLossOffset; 
}

function isPointShadowed(targetCol, targetRow, obstacleCol, obstacleRow, obstacleType) {
    const tx = transmitter.x;
    const ty = transmitter.y;

    const vec_tx_obs_x = obstacleCol - tx;
    const vec_tx_obs_y = obstacleRow - ty;
    const vec_tx_target_x = targetCol - tx;
    const vec_tx_target_y = targetRow - ty;

    const dist_tx_obs_sq = vec_tx_obs_x * vec_tx_obs_x + vec_tx_obs_y * vec_tx_obs_y;
    const dist_tx_target_sq = vec_tx_target_x * vec_tx_target_x + vec_tx_target_y * vec_tx_target_y;

    if (dist_tx_target_sq <= dist_tx_obs_sq) {
        return { isShadowed: false, baseAttenuation: 0, distanceInShadow: 0, lateralScale: 0 };
    }

    const dotProduct = vec_tx_obs_x * vec_tx_target_x + vec_tx_obs_y * vec_tx_target_y;
    if (dotProduct <= 0 || dotProduct < dist_tx_obs_sq) {
        return { isShadowed: false, baseAttenuation: 0, distanceInShadow: 0, lateralScale: 0 };
    }

    const dist_tx_obs = Math.sqrt(dist_tx_obs_sq);
    if (dist_tx_obs < 0.1) {
        return { isShadowed: false, baseAttenuation: 0, distanceInShadow: 0, lateralScale: 0 };
    }
    
    const perpendicularDistance = Math.abs(vec_tx_obs_x * vec_tx_target_y - vec_tx_obs_y * vec_tx_target_x) / dist_tx_obs;
    const distanceInShadow = Math.sqrt(dist_tx_target_sq) - dist_tx_obs;

    const INITIAL_SHADOW_WIDTH = 0.6; 
    const SHADOW_SPREAD_FACTOR = 0.35; 
    const CORE_PERCENTAGE_OF_CONE = 0.3; 
    const PENUMBRA_TOTAL_PERCENTAGE_OF_CONE = 1.0; 
    const currentMaxConeHalfWidth = INITIAL_SHADOW_WIDTH + (distanceInShadow * SHADOW_SPREAD_FACTOR);

    let lateralScale = 0; 

    if (perpendicularDistance <= currentMaxConeHalfWidth * CORE_PERCENTAGE_OF_CONE) {
        lateralScale = 1.0;
    } else if (perpendicularDistance <= currentMaxConeHalfWidth * PENUMBRA_TOTAL_PERCENTAGE_OF_CONE) {
        const coreEdge = currentMaxConeHalfWidth * CORE_PERCENTAGE_OF_CONE;
        const penumbraEdge = currentMaxConeHalfWidth * PENUMBRA_TOTAL_PERCENTAGE_OF_CONE;
        if (penumbraEdge > coreEdge) {
            lateralScale = 1.0 - (perpendicularDistance - coreEdge) / (penumbraEdge - coreEdge);
            lateralScale = Math.max(0, Math.min(1, lateralScale)); 
        } else { 
            lateralScale = (coreEdge === 0 && penumbraEdge === 0 && perpendicularDistance === 0) ? 1.0 : 0;
        }
    } else {
        return { isShadowed: false, baseAttenuation: 0, distanceInShadow: 0, lateralScale: 0 };
    }

    let baseAttenuationDb = 0;
    if (obstacleType === "heavy") {
        baseAttenuationDb = 35; 
    } else if (obstacleType === "normal") {
        baseAttenuationDb = 18;
    }
    
    const scaledBaseAttenuation = baseAttenuationDb * lateralScale;

    return { 
        isShadowed: lateralScale > 0.001, 
        baseAttenuation: scaledBaseAttenuation, 
        distanceInShadow: distanceInShadow,
        lateralScale: lateralScale 
    };
}

function getEffectiveShadowProperties(targetRow, targetCol, allObstacles) {
    let strongestEffectiveAttenuation = 0;
    let isVisuallyShadowedByAny = false;
    let distanceForTingeVisual = MAX_SHADOW_FADE_DISTANCE_GRID_UNITS + 1;
    let strongestLateralScaleForTinge = 0; 

    for (const obs of allObstacles) {
        const shadowDetails = isPointShadowed(targetCol, targetRow, obs.x, obs.y, obs.type);

        if (shadowDetails.isShadowed) { 
            isVisuallyShadowedByAny = true; 

            const distanceFadeFactor = Math.max(0, 1 - (shadowDetails.distanceInShadow / MAX_SHADOW_FADE_DISTANCE_GRID_UNITS));
            const currentEffectiveAttenuation = shadowDetails.baseAttenuation * distanceFadeFactor;

            if (currentEffectiveAttenuation > strongestEffectiveAttenuation) {
                strongestEffectiveAttenuation = currentEffectiveAttenuation;
                distanceForTingeVisual = shadowDetails.distanceInShadow;
                strongestLateralScaleForTinge = shadowDetails.lateralScale;
            } else if (currentEffectiveAttenuation === strongestEffectiveAttenuation) {
                if (shadowDetails.lateralScale > strongestLateralScaleForTinge) {
                    distanceForTingeVisual = shadowDetails.distanceInShadow;
                    strongestLateralScaleForTinge = shadowDetails.lateralScale;
                } else if (shadowDetails.lateralScale === strongestLateralScaleForTinge && shadowDetails.distanceInShadow < distanceForTingeVisual) {
                    distanceForTingeVisual = shadowDetails.distanceInShadow;
                }
            }
        }
    }
    return {
        attenuation: strongestEffectiveAttenuation,
        isVisuallyShadowed: isVisuallyShadowedByAny,
        distanceForTinge: distanceForTingeVisual,
        lateralScaleForTinge: strongestLateralScaleForTinge 
    };
}

function powerToColor(Pr) {
    const weakPowerThreshold = -80;    
    const strongPowerThreshold = -60;  
    const mediumPowerPoint = (weakPowerThreshold + strongPowerThreshold) / 2; 

    const R_RED = 255, G_RED = 0, B_RED = 0;         
    const R_YELLOW = 255, G_YELLOW = 255, B_YELLOW = 0; 
    const R_GREEN = 0, G_GREEN = 255, B_GREEN = 0;    

    let r, g, b;

    if (Pr <= weakPowerThreshold) { 
        [r, g, b] = [R_RED, G_RED, B_RED];
    } else if (Pr < mediumPowerPoint) { 
        const t = (Pr - weakPowerThreshold) / (mediumPowerPoint - weakPowerThreshold);
        r = Math.round(R_RED * (1 - t) + R_YELLOW * t);
        g = Math.round(G_RED * (1 - t) + G_YELLOW * t);
        b = Math.round(B_RED * (1 - t) + B_YELLOW * t);
    } else if (Pr < strongPowerThreshold) { 
        const t = (Pr - mediumPowerPoint) / (strongPowerThreshold - mediumPowerPoint);
        r = Math.round(R_YELLOW * (1 - t) + R_GREEN * t);
        g = Math.round(G_YELLOW * (1 - t) + G_GREEN * t);
        b = Math.round(B_YELLOW * (1 - t) + B_GREEN * t);
    } else { 
        [r, g, b] = [R_GREEN, G_GREEN, B_GREEN];
    }
    return `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
}


function updateCellPathloss(row, col, obstaclesData) {
  const cell = cells[row][col];
  const Pt = parseFloat(document.getElementById('Pt').value); 

  cell.isVisuallyShadowed = false; 
  cell.distanceForTinge = MAX_SHADOW_FADE_DISTANCE_GRID_UNITS + 1; 
  cell.lateralScaleForTinge = 0;

  if (row === transmitter.y && col === transmitter.x) {
    cell.receivedPower = Pt; cell.currentPathloss = 0; cell.isOutage = false; cell.distance = 0;
    cell.lossComponents = { base: 0, obstacleShadow: 0 };
    updateCellAppearance(cell); return cell;
  }
  
  if (cell.obstacleType) {
    cell.receivedPower = -200; cell.currentPathloss = Pt - cell.receivedPower; cell.isOutage = true; 
    cell.distance = Math.sqrt((col - transmitter.x)**2 + (row - transmitter.y)**2) * CELL_SIZE_METERS;
    cell.lossComponents = { base: cell.currentPathloss, obstacleShadow: 0 };
    updateCellAppearance(cell); return cell;
  }

  const distanceGrid = Math.sqrt((col - transmitter.x)**2 + (row - transmitter.y)**2);
  const distanceM = distanceGrid * CELL_SIZE_METERS;
  cell.distance = distanceM;

  const Pmin = parseFloat(document.getElementById('Pmin').value);
  const frequencyVal = parseFloat(document.getElementById('frequency').value);
  const environmentVal = document.getElementById('setting').value;

  cell.basePathloss = calculatePathLoss(distanceM, frequencyVal, environmentVal);
  cell.lossComponents.base = cell.basePathloss;

  const shadowProps = getEffectiveShadowProperties(row, col, obstaclesData);
  const obstacleShadowAttenuation = shadowProps.attenuation;
  cell.isVisuallyShadowed = shadowProps.isVisuallyShadowed;
  cell.distanceForTinge = shadowProps.distanceForTinge; 
  cell.lateralScaleForTinge = shadowProps.lateralScaleForTinge;

  cell.lossComponents.obstacleShadow = obstacleShadowAttenuation;
  
  cell.currentPathloss = cell.basePathloss + obstacleShadowAttenuation;
  cell.receivedPower = Pt - cell.currentPathloss;
  cell.isOutage = cell.receivedPower < Pmin;

  updateCellAppearance(cell);
  return cell;
}

function updateCellAppearance(cell) {
  const cellElement = cell.element;
  cellElement.classList.remove('outage-cell', 'shadowed-cell');
  cellElement.style.removeProperty('--shadow-alpha'); 

  if (cellElement.classList.contains("transmitter")) return; 
  
  if (cell.obstacleType) {
    cellElement.classList.add('outage-cell'); 
    return;
  }

  cellElement.style.backgroundColor = powerToColor(cell.receivedPower);

  if (cell.isVisuallyShadowed && cell.lateralScaleForTinge > 0.001) {
      cellElement.classList.add('shadowed-cell');
      
      const distanceFadeRatio = Math.max(0, 1 - (cell.distanceForTinge / MAX_SHADOW_FADE_DISTANCE_GRID_UNITS));
      const maxAlphaAtThisDistance = MIN_VISUAL_ALPHA + (MAX_VISUAL_ALPHA - MIN_VISUAL_ALPHA) * (1 - (1 - distanceFadeRatio) * (1 - distanceFadeRatio));
      const currentAlpha = maxAlphaAtThisDistance * cell.lateralScaleForTinge;

      cellElement.style.setProperty('--shadow-alpha', Math.max(0, currentAlpha).toFixed(3)); 
  }

  if (cell.isOutage) {
    cellElement.classList.add("outage-cell"); 
  }
}

function updatePathlossAndMetrics() {
  const obstaclesData = [];
  let totalPathlossSum = 0, totalReceivedPowerSum = 0, totalObstacleShadowSum = 0;
  let simulatedCellsCount = 0, outageCellsCount = 0;
  let minRxPowerCovered = Infinity, maxRxPowerCovered = -Infinity, maxCoverageDist = 0;
  let obstacleCount = 0;
  
  const totalCells = rows * cols - 1; // All cells except the transmitter itself

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (cells[r][c].obstacleType) {
      obstaclesData.push({ x: c, y: r, type: cells[r][c].obstacleType });
      obstacleCount++;
    }
  }

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cellData = updateCellPathloss(r, c, obstaclesData); 
    if ((r === transmitter.y && c === transmitter.x) || cellData.obstacleType) continue; 

    simulatedCellsCount++;
    totalPathlossSum += cellData.currentPathloss;
    if (cellData.lossComponents) {
        totalObstacleShadowSum += cellData.lossComponents.obstacleShadow;
    }
    
    if (cellData.isOutage) outageCellsCount++;
    else {
      totalReceivedPowerSum += cellData.receivedPower; 
      minRxPowerCovered = Math.min(minRxPowerCovered, cellData.receivedPower);
      maxRxPowerCovered = Math.max(maxRxPowerCovered, cellData.receivedPower);
      maxCoverageDist = Math.max(maxCoverageDist, cellData.distance);
    }
  }
  
  const coveredCellsCount = simulatedCellsCount - outageCellsCount; 
  const outageProb = totalCells > 0 ? (outageCellsCount / totalCells) * 100 : 0;
  const coverageArea = totalCells > 0 ? (coveredCellsCount / totalCells) * 100 : 0;
  const avgPathloss = simulatedCellsCount > 0 ? totalPathlossSum / simulatedCellsCount : 0;
  const avgReceivedPower = coveredCellsCount > 0 ? totalReceivedPowerSum / coveredCellsCount : (simulatedCellsCount > 0 ? NaN : 0);
  const avgObstacleShadow = simulatedCellsCount > 0 ? totalObstacleShadowSum / simulatedCellsCount : 0;
  const signalRange = (maxRxPowerCovered !== -Infinity && minRxPowerCovered !== Infinity && maxRxPowerCovered > minRxPowerCovered) ? (maxRxPowerCovered - minRxPowerCovered) : 0;

  updateMetricDisplays({
    outageProb, coverageArea, 
    outageCells: outageCellsCount, 
    totalSimulatedCells: totalCells, 
    avgPathloss, avgReceivedPower, 
    avgShadowLoss: avgObstacleShadow, 
    minRxPower: minRxPowerCovered === Infinity ? NaN : minRxPowerCovered,
    maxRxPower: maxRxPowerCovered === -Infinity ? NaN : maxRxPowerCovered,
    signalRange, maxCoverageDist: maxCoverageDist / 1000, obstacleCount
  });
}

function updateMetricDisplays(metrics) {
  document.getElementById('outageProb').textContent = `${metrics.outageProb.toFixed(2)}%`;
  document.getElementById('outageProgress').style.width = `${metrics.outageProb.toFixed(2)}%`;
  document.getElementById('coverageArea').textContent = `${metrics.coverageArea.toFixed(2)}%`;
  document.getElementById('outageCells').textContent = `${metrics.outageCells} / ${metrics.totalSimulatedCells}`; 
  document.getElementById('avgReceivedPower').textContent = `${isNaN(metrics.avgReceivedPower) ? 'N/A' : metrics.avgReceivedPower.toFixed(2)} dBm`;
  document.getElementById('minReceivedPower').textContent = `${isNaN(metrics.minRxPower) ? 'N/A' : metrics.minRxPower.toFixed(2)} dBm`;
  document.getElementById('maxReceivedPower').textContent = `${isNaN(metrics.maxRxPower) ? 'N/A' : metrics.maxRxPower.toFixed(2)} dBm`;
  document.getElementById('signalRange').textContent = `${metrics.signalRange.toFixed(2)} dB`;
  document.getElementById('avgPathloss').textContent = `${metrics.avgPathloss.toFixed(2)} dB`;
  document.getElementById('avgShadowLoss').textContent = `${metrics.avgShadowLoss.toFixed(2)} dB`; 
  document.getElementById('maxDistance').textContent = `${metrics.maxCoverageDist.toFixed(2)} km`;
  const environment = document.getElementById('setting').value;
  document.getElementById('envFactor').textContent = environmentFactors[environment].name;
  document.getElementById('obstacleCount').textContent = metrics.obstacleCount;
  document.getElementById('shadowingFactor').textContent = "Cone (Fading w/ Penumbra)"; 
  const statusIndicator = document.getElementById('systemStatus');
  statusIndicator.classList.remove('status-excellent', 'status-good', 'status-fair', 'status-poor');
  if (metrics.outageProb <= 5) { statusIndicator.textContent = "System Status: Excellent Coverage"; statusIndicator.classList.add('status-excellent');}
  else if (metrics.outageProb <= 15) { statusIndicator.textContent = "System Status: Good Coverage"; statusIndicator.classList.add('status-good');}
  else if (metrics.outageProb <= 30) { statusIndicator.textContent = "System Status: Fair Coverage"; statusIndicator.classList.add('status-fair');}
  else { statusIndicator.textContent = "System Status: Poor Coverage"; statusIndicator.classList.add('status-poor');}
}

function handleCellClick(row, col) {
  if (row === transmitter.y && col === transmitter.x) return; 
  const cell = cells[row][col];
  const cellElement = cell.element;
  cellElement.classList.remove('obstacle-normal', 'obstacle-heavy', 'outage-cell', 'shadowed-cell');
  cellElement.style.removeProperty('--shadow-alpha'); 
  cellElement.style.backgroundColor = ''; 
  if (currentMode === 'erase' || cell.obstacleType === currentMode) cell.obstacleType = null;
  else if (currentMode === 'normal') { cell.obstacleType = 'normal'; cellElement.classList.add('obstacle-normal'); }
  else if (currentMode === 'heavy') { cell.obstacleType = 'heavy'; cellElement.classList.add('obstacle-heavy'); }
  updatePathlossAndMetrics();
}

function showTooltip(event, row, col) {
    const cell = cells[row][col];
    if (!cell) return;
    let content = `Cell (${col}, ${row})<br>`;
    if (row === transmitter.y && col === transmitter.x) {
        content += `Type: Transmitter<br>Power: ${document.getElementById('Pt').value} dBm`;
    } else if (cell.obstacleType) {
        content += `Type: ${cell.obstacleType.charAt(0).toUpperCase() + cell.obstacleType.slice(1)} Obstacle`;
    } else {
        content += `Rx Power: ${cell.receivedPower.toFixed(2)} dBm<br>`;
        content += `Total PL: ${cell.currentPathloss.toFixed(2)} dB<br>`;
        if (cell.lossComponents) {
            content += `  Base Model PL: ${cell.lossComponents.base.toFixed(2)} dB<br>`;
            content += `  Obstacle Shadow: ${cell.lossComponents.obstacleShadow.toFixed(2)} dB<br>`;
        }
        content += `Distance: ${(cell.distance / 1000).toFixed(2)} km<br>`;
        
        if (cell.isOutage) {
            content += `Status: <span style="color: #ff6b6b; font-weight: bold;">Outage</span>`;
        } else {
            content += `Status: <span style="color: #69f0ae; font-weight: bold;">Covered</span>`;
        }
        
        if(cell.isVisuallyShadowed && cell.lateralScaleForTinge > 0.001) {
            const alpha = cell.element.style.getPropertyValue('--shadow-alpha');
            content += `<br><i>(In shadow, Tinge Alpha: ${alpha ? parseFloat(alpha).toFixed(3) : 'N/A'})</i>`;
        }
    }
    tooltip.innerHTML = content;
    tooltip.style.display = "block";
    const offset = 15; 
    let newX = event.clientX + offset, newY = event.clientY + offset;
    const tooltipRect = tooltip.getBoundingClientRect(), bodyRect = document.body.getBoundingClientRect();
    if (newX + tooltipRect.width > bodyRect.right) newX = event.clientX - tooltipRect.width - offset;
    if (newY + tooltipRect.height > bodyRect.bottom) newY = event.clientY - tooltipRect.height - offset;
    tooltip.style.left = `${Math.max(0, newX)}px`;
    tooltip.style.top = `${Math.max(0, newY)}px`;
}

function hideTooltip() { tooltip.style.display = "none"; }
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.mode-btn[onclick="setMode('${mode}')"]`).classList.add('active');
}

function clearAll() {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (cells[r][c].obstacleType) {
      cells[r][c].obstacleType = null;
      cells[r][c].element.classList.remove('obstacle-normal', 'obstacle-heavy');
    }
  }
  updatePathlossAndMetrics();
}

function generatePoisson(mean) {
    if (mean <= 0) return 0;
    const L = Math.exp(-mean);
    let p = 1.0;
    let k = 0;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}

function randomObstacles() {
  clearAll(); 

  const densityPer100 = parseFloat(document.getElementById('obstacleDensity').value);
  const gridArea = rows * cols;
  const meanObstacles = (densityPer100 / 100) * gridArea;

  const numObstaclesToPlace = generatePoisson(meanObstacles);
  
  const maxPlaceable = gridArea - 1; 
  const numObstacles = Math.min(numObstaclesToPlace, maxPlaceable);

  for (let i = 0; i < numObstacles; i++) {
    let r, c;
    do { r = Math.floor(Math.random()*rows); c = Math.floor(Math.random()*cols); }
    while ((r === transmitter.y && c === transmitter.x) || cells[r][c].obstacleType);
    
    const type = Math.random() < 0.7 ? 'normal' : 'heavy'; 
    cells[r][c].obstacleType = type;
    cells[r][c].element.classList.add(type === 'normal' ? 'obstacle-normal' : 'obstacle-heavy');
  }
  updatePathlossAndMetrics();
}

function setupInputListeners() {
  const inputsToWatch = ['Pt', 'Pmin', 'frequency', 'setting', 'obstacleDensity']; 
  inputsToWatch.forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener('change', updatePathlossAndMetrics);
    if (element.type === 'number') element.addEventListener('input', updatePathlossAndMetrics);
  });
}

let analysisChart = null;

function initializeChart() {
  const ctx = document.getElementById('analysisChart');
  if (!ctx) return;
  if (analysisChart) { analysisChart.destroy(); }
  
  analysisChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Data Points', data: [],
        backgroundColor: 'rgba(40, 167, 69, 0.7)',
        borderColor: 'rgba(40, 167, 69, 1)',
        borderWidth: 1, pointRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Distance (km)' } },
        y: { title: { display: true, text: 'Value' } }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) { return `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`; }
          }
        }
      }
    }
  });
}

function updateChart() {
  if (!analysisChart) {
    initializeChart();
    if (!analysisChart) return;
  }
  
  const chartType = document.getElementById('chartType').value;
  const dataPoints = [];
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if ((r === transmitter.y && c === transmitter.x) || cell.obstacleType) continue;
      
      const distanceKm = cell.distance / 1000;
      let yValue;
      
      switch (chartType) {
        case 'snr-distance': const noiseFloor = -100; yValue = cell.receivedPower - noiseFloor; break;
        case 'power-distance': yValue = cell.receivedPower; break;
        case 'pathloss-distance': yValue = cell.currentPathloss; break;
        default: yValue = cell.receivedPower;
      }
      dataPoints.push({ x: distanceKm, y: yValue });
    }
  }
  
  analysisChart.data.datasets[0].data = dataPoints;
  
  const chartLabels = {
    'snr-distance': { title: 'SNR vs Distance', yLabel: 'SNR (dB)', color: 'rgba(40, 167, 69, 0.7)' },
    'power-distance': { title: 'Received Power vs Distance', yLabel: 'Received Power (dBm)', color: 'rgba(0, 123, 255, 0.7)' },
    'pathloss-distance': { title: 'Path Loss vs Distance', yLabel: 'Path Loss (dB)', color: 'rgba(220, 53, 69, 0.7)' }
  };
  
  const currentLabel = chartLabels[chartType];
  analysisChart.data.datasets[0].label = currentLabel.title;
  analysisChart.data.datasets[0].backgroundColor = currentLabel.color;
  analysisChart.data.datasets[0].borderColor = currentLabel.color.replace('0.7', '1');
  analysisChart.options.scales.y.title.text = currentLabel.yLabel;
  
  // MODIFICATION: Call the new dynamic statistic functions
  const correlation = calculateCorrelation(dataPoints);
  const trend = getTrend(dataPoints);
  
  document.getElementById('chartDataPoints').textContent = dataPoints.length;
  document.getElementById('chartCorrelation').textContent = isNaN(correlation) ? 'N/A' : correlation.toFixed(3);
  document.getElementById('chartTrend').textContent = trend;
  
  analysisChart.update('none');
}

// This function calculates R-squared for correlation
function calculateCorrelation(points) {
  if (points.length < 2) return NaN;
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + (p.x * p.y), 0);
  const sumX2 = points.reduce((sum, p) => sum + (p.x * p.x), 0);
  const sumY2 = points.reduce((sum, p) => sum + (p.y * p.y), 0);
  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
  if (denominator === 0) return 0;
  return (numerator / denominator) ** 2;
}

// MODIFICATION: New function to determine the trend based on Pearson's 'r'
function getTrend(points) {
    if (points.length < 2) return "N/A";

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + (p.x * p.y), 0);
    const sumX2 = points.reduce((sum, p) => sum + (p.x * p.x), 0);
    const sumY2 = points.reduce((sum, p) => sum + (p.y * p.y), 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));

    if (denominator === 0) return "N/A";

    const r = numerator / denominator; // This is the Pearson correlation coefficient

    if (r > 0.1) return "Increasing";
    if (r < -0.1) return "Decreasing";
    return "No Clear Trend";
}

function loadChartJS() {
  if (typeof Chart !== 'undefined') { initializeChart(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
  script.onload = function() { initializeChart(); };
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', initialize);
