(function() {
    // =================================================================
    // 1. 配置与初始化 (No changes)
    // =================================================================
    const CONFIG = {
        animationBaseDuration: 3000,
        speeds: [0.5, 1, 1.5, 2, 3],
        speedLabels: ['0.5x', '1.0x', '1.5x', '2.0x', '3.0x'],
        colors: {
            plane: '#9C27B0', train: '#2196F3', bus: '#FF9800', 
            bicycle: '#4CAF50', walk: '#795548',
            pathVisited: 'var(--primary-color)' 
        },
        colorMap: { 
            'paper': { main: '59, 130, 246' }, 'book': { main: '139, 92, 246' },
            'report': { main: '236, 72, 153' }, 'patent': { main: '16, 185, 129' },
            'software': { main: '245, 158, 11' }, 'national-proj': { main: '239, 68, 68' },
            'provincial-proj': { main: '249, 115, 22' }, 'other-proj': { main: '234, 179, 8' },
            'cumulative': { main: '107, 114, 128' }
        },
        // NEW: 在这里添加暗黑模式的颜色配置
        darkColorMap: {
            'paper': { main: '96, 165, 250' },   // A brighter blue
            'book': { main: '165, 180, 252' },  // Lavender
            'report': { main: '244, 114, 182' }, // Pink
            'patent': { main: '52, 211, 153' },  // A vibrant green
            'software': { main: '251, 191, 36' }, // Amber
            'national-proj': { main: '248, 113, 113' }, // A softer red
            'provincial-proj': { main: '251, 146, 60' },// Orange
            'other-proj': { main: '250, 204, 21' } // Yellow
        }
    };

    const map = L.map('map',{minZoom:1}).setView([34.5, 108.9], 4);
    const playPauseBtn = document.getElementById('play-pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const speedBtn = document.getElementById('speed-btn');
    const speedMenu = document.getElementById('speed-menu');
    const timelineSlider = document.getElementById('timeline-slider');
    const academicPanel = document.getElementById('academic-panel');
    const loadingOverlay = document.getElementById('loading-overlay');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    let isAnimating = true, animationFrameId = null, currentSegmentIndex = 0;
    let trajectoryData = [], fullAcademicData = null;
    let movingMarker = null, pathLayers = [], previousBearing = 0;
    let currentSpeedIndex = 1, animationSpeed = CONFIG.speeds[currentSpeedIndex];
    let publicationChart = null, projectChart = null;
    let yearMap = [];
    let drawnPathLayer = null;
    let completedPathPoints = [];

    // =================================================================
    // 2. 地图图层与图标 (No changes)
    // =================================================================
    const baseMaps = {
        "高德地图": L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', { subdomains: ['1', '2', '3', '4'], attribution: '&copy; 高德地图' }),
        // NEW: 添加高德暗色地图
        "高德地图 (暗色)": L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}', { subdomains: "1234", attribution: '&copy; 高德地图' }),
        "CartoDB 浅色": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO', maxZoom: 19 }),
        "CartoDB 暗色": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO', maxZoom: 19 }),
        "谷歌影像": L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains: ['0', '1', '2', '3'], attribution: '&copy; Google Maps' })
    };
    // 新增：动态切换底图的变量和函数
    let currentBaseLayer = null;
    const ZOOM_THRESHOLD = 3.5; // 缩放级别阈值

    // 新增：动态切换底图的函数
    function switchBaseMapByZoom(zoomLevel) {
        const isDarkMode = document.body.classList.contains('dark-mode');
        let targetLayer;
        
        if (isDarkMode) {
            // 暗黑模式：根据缩放级别动态切换
            if (zoomLevel < ZOOM_THRESHOLD) {
                targetLayer = baseMaps["CartoDB 暗色"];  // 小缩放：全球视图好
            } else {
                targetLayer = baseMaps["高德地图 (暗色)"];  // 大缩放：细节好
            }
        } else {
            // 白天模式：始终使用高德地图
            targetLayer = baseMaps["高德地图"];
        }
        
        // 移除当前底图并添加目标底图
        if (currentBaseLayer && map.hasLayer(currentBaseLayer)) {
            map.removeLayer(currentBaseLayer);
        }
        if (!map.hasLayer(targetLayer)) {
            map.addLayer(targetLayer);
        }
        currentBaseLayer = targetLayer;
    }

    // 新增：监听地图缩放事件
    map.on('zoomend', () => {
        switchBaseMapByZoom(map.getZoom());
    });

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    const createDirectionalIcon = (type, bearing = 0) => { /* ... function content is unchanged ... */ const rotation = (type === 'plane') ? bearing - 45 : bearing; const iconContent = { plane: `<img src="plane.svg" class="direction-indicator-svg" style="transform: rotate(${rotation}deg);"/>`, train: `<img src="train.svg" class="direction-indicator-svg" style="transform: rotate(${bearing}deg);"/>`, bus: `<svg class="direction-indicator-svg" style="transform: rotate(${bearing}deg);" viewBox="0 0 24 24" fill="#FF9800"><path d="M18 6c-2.76 0-5 2.24-5 5v1H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2h-3v-1c0-2.76-2.24-5-5-5zm-1 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-6 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg>`, bicycle: `<svg class="direction-indicator-svg" style="transform: rotate(${bearing}deg);" viewBox="0 0 24 24" fill="#4CAF50"><path d="M15.5 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-3.41 4.59L12 10l-1.59-1.59L9 10l-1.41-1.41L6 10l-2.47-2.47C3.21 7.21 3 6.65 3 6c0-1.1.9-2 2-2s2 .9 2 2c0 .28-.08.54-.22.78l1.44 1.44L10 9l1.59-1.59L13 9l2.41-2.41c.28-.28.47-.64.55-1.04-.26-.18-.54-.31-.86-.41L12.92 3h-1.84l-1.14 2.28c-.5.1-.96.28-1.38.52L10 7.17l-1.41-1.41L7.17 7.17 8.59 8.59 7.17 10l-4.24 4.24c-.78.78-.78 2.05 0 2.83s2.05.78 2.83 0L10 12.83l1.41 1.41L10 15.66l1.41 1.41L10 18.48l3.75 3.75c.78.78 2.05.78 2.83 0s.78-2.05 0-2.83L12.34 15l1.41-1.41L15.17 15l1.41-1.41L18 15.03l2.12-2.12c.78-.78.78-2.05 0-2.83s-2.05-.78-2.83 0L14.08 13.29l-1.41-1.41L14.08 10.47l1.42-1.42z"/></svg>`, walk: `<svg class="direction-indicator-svg" style="transform: rotate(${bearing}deg);" viewBox="0 0 24 24" fill="#795548"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L9.8 8.9z"/></svg>` }; return L.divIcon({ html: `<div class="direction-indicator-wrapper">${iconContent[type] || iconContent.train}</div>`, className: '', iconSize: [36, 36], iconAnchor: [18, 18] }); };
    
    // =================================================================
    // 3. 辅助函数 (No changes)
    // =================================================================
    function animateCountUp(element, end, duration = 1000) { const start = parseInt(element.dataset.currentValue || '0', 10); const finalVal = parseInt(end, 10); if (start === finalVal) return; element.dataset.currentValue = finalVal; if (isNaN(finalVal)) { element.textContent = end; return; } let startTime = null; function animation(currentTime) { if (!startTime) startTime = currentTime; const progress = Math.min((currentTime - startTime) / duration, 1); const currentVal = Math.floor(start + progress * (finalVal - start)); element.textContent = currentVal; if (progress < 1) { requestAnimationFrame(animation); } else { element.textContent = finalVal; } } requestAnimationFrame(animation); }
    function calculateBearing(start, end) { const startLat = start[1] * Math.PI / 180, startLng = start[0] * Math.PI / 180; const endLat = end[1] * Math.PI / 180, endLng = end[0] * Math.PI / 180; const dLng = endLng - startLng; const y = Math.sin(dLng) * Math.cos(endLat); const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
    function interpolateBearing(start, end, t) { let diff = end - start; if (diff > 180) diff -= 360; if (diff < -180) diff += 360; return (start + diff * t + 360) % 360; }
    function createRealisticCurvedPath(start, end, drawnSegments) { /* ... function content is unchanged ... */ const segmentKey = `${end.toString()}-${start.toString()}`; const isReturnTrip = drawnSegments.has(segmentKey); const startLatLng = L.latLng(start[1], start[0]); const endLatLng = L.latLng(end[1], end[0]); const distance = map.options.crs.distance(startLatLng, endLatLng); const midPoint = L.latLng((startLatLng.lat + endLatLng.lat) / 2, (startLatLng.lng + endLatLng.lng) / 2); let controlPoint; let offsetMultiplier; const isAsia = (lat, lng) => lat > 0 && lng > 60 && lng < 150; const isNorthAmerica = (lat, lng) => lat > 25 && lng < -50 && lng > -170; const isEurope = (lat, lng) => lat > 35 && lng > -10 && lng < 40; if ((isAsia(startLatLng.lat, startLatLng.lng) && isNorthAmerica(endLatLng.lat, endLatLng.lng)) || (isNorthAmerica(startLatLng.lat, startLatLng.lng) && isAsia(endLatLng.lat, endLatLng.lng))) { offsetMultiplier = Math.min(distance * 0.00000025, 0.4); let perpOffset, latOffset; if (isAsia(startLatLng.lat, startLatLng.lng)) { perpOffset = offsetMultiplier * (isReturnTrip ? 1.5 : -1); latOffset = Math.abs(startLatLng.lng - endLatLng.lng) * 0.2; } else { perpOffset = offsetMultiplier * (isReturnTrip ? -1.5 : 1); latOffset = -Math.abs(startLatLng.lng - endLatLng.lng) * 0.15; } controlPoint = L.latLng(midPoint.lat + latOffset, midPoint.lng + (endLatLng.lat - startLatLng.lat) * perpOffset); } else { offsetMultiplier = Math.min(distance * 0.0000003, 0.5); if ((isEurope(startLatLng.lat, startLatLng.lng) && isAsia(endLatLng.lat, endLatLng.lng)) || (isAsia(startLatLng.lat, startLatLng.lng) && isEurope(endLatLng.lat, endLatLng.lng))) { offsetMultiplier = Math.min(distance * 0.0000002, 0.3); const perpOffset = offsetMultiplier * (isReturnTrip ? -1.5 : 1); controlPoint = L.latLng(midPoint.lat + (startLatLng.lng - endLatLng.lng) * perpOffset, midPoint.lng + (endLatLng.lat - startLatLng.lat) * perpOffset); } else { const perpOffset = offsetMultiplier * (isReturnTrip ? -1.5 : 1); controlPoint = L.latLng(midPoint.lat + (startLatLng.lng - endLatLng.lng) * perpOffset, midPoint.lng + (endLatLng.lat - startLatLng.lat) * perpOffset); } } const points = [startLatLng]; const numSegments = Math.max(50, Math.floor(distance / 20000)); for (let i = 1; i <= numSegments; i++) { const t = i / numSegments; points.push(L.latLng( (1 - t) ** 2 * startLatLng.lat + 2 * (1 - t) * t * controlPoint.lat + t ** 2 * endLatLng.lat, (1 - t) ** 2 * startLatLng.lng + 2 * (1 - t) * t * controlPoint.lng + t ** 2 * endLatLng.lng )); } return points.map(point => [point.lat, point.lng]); }

    // =================================================================
    // 4. 数据处理与场景设置 (No changes)
    // =================================================================
    async function loadData() { /* ... function content is unchanged ... */ try { const response = await fetch('Yan_trails.geojson'); if (!response.ok) throw new Error('轨迹数据加载失败'); trajectoryData = (await response.json()).features; } catch (e) { console.warn('无法加载 Yan_trails.geojson, 使用内置示例数据。', e); trajectoryData = [{"type":"Feature","properties":{"时间段":"1969.01 - 1987.07","地点":"甘肃省民勤县","事件":"出生与中小学","transport_mode":"walk"},"geometry":{"type":"Point","coordinates":[103.09011,38.62409]}},{"type":"Feature","properties":{"时间段":"1987.09 - 1991.07","地点":"武汉","事件":"武汉测绘科技大学 (本科)","transport_mode":"train"},"geometry":{"type":"Point","coordinates":[114.298572,30.584355]}},{"type":"Feature","properties":{"时间段":"1996.07 - 1999.08","地点":"兰州","事件":"兰州铁道学院 (任教)","transport_mode":"train"},"geometry":{"type":"Point","coordinates":[103.823557,36.058039]}},{"type":"Feature","properties":{"时间段":"1999.09 - 2002.03","地点":"武汉","事件":"武汉大学 (博士)","transport_mode":"train"},"geometry":{"type":"Point","coordinates":[114.298572,30.584355]}},{"type":"Feature","properties":{"时间段":"2002.04 - 2003.04","地点":"香港","事件":"香港理工大学","transport_mode":"plane"},"geometry":{"type":"Point","coordinates":[114.177216,22.302711]}},{"type":"Feature","properties":{"时间段":"2005.06 - 2006.06","地点":"瑞士苏黎世","事件":"苏黎世大学","transport_mode":"plane"},"geometry":{"type":"Point","coordinates":[8.541694,47.3768866]}},{"type":"Feature","properties":{"时间段":"2010.03 - 2014.06","地点":"加拿大滑铁卢","事件":"滑铁卢大学","transport_mode":"plane"},"geometry":{"type":"Point","coordinates":[-80.52041,43.46426]}},{"type":"Feature","properties":{"时间段":"2014.12 - 2015.02","地点":"美国弗吉GINIA州","事件":"老道明大学","transport_mode":"plane"},"geometry":{"type":"Point","coordinates":[-76.285873,36.8529]}},{"type":"Feature","properties":{"时间段":"2015.03 - 至今","地点":"兰州","事件":"兰州交通大学","transport_mode":"plane"},"geometry":{"type":"Point","coordinates":[103.823557,36.058039]}}]; } try { const response = await fetch('academic_data.json'); if (!response.ok) throw new Error('学术数据加载失败'); fullAcademicData = await response.json(); } catch (e) { console.error('无法加载 academic_data.json, 学术面板将无法显示。', e); fullAcademicData = { "publications": [], "projects": [], "awards": [], "students": [] }; } yearMap = trajectoryData.map(feature => { const timeStr = feature.properties.时间段 || ""; const yearMatch = timeStr.match(/(\d{4})\.\d{2}\s*-\s*(\d{4})\.\d{2}|(\d{4})\.\d{2}\s*-\s*至今|(\d{4})\.\d{2}/); if (yearMatch) { return parseInt(yearMatch[2] || yearMatch[3] || yearMatch[4] || new Date().getFullYear(), 10); } return new Date().getFullYear(); }); setupScene(); setupAcademicPanel(); updateAcademicPanelToYear(yearMap[0] || 1987); }
    function setupScene() { /* ... function content is unchanged ... */ loadingOverlay.style.display = 'none'; if (trajectoryData.length < 2) return; const drawnSegments = new Set(); for (let i = 0; i < trajectoryData.length - 1; i++) { const start = trajectoryData[i].geometry.coordinates, end = trajectoryData[i+1].geometry.coordinates; const pathPoints = createRealisticCurvedPath(start, end, drawnSegments); pathLayers.push({ fullPoints: pathPoints }); drawnSegments.add(`${start.toString()}-${end.toString()}`); } drawnPathLayer = L.polyline([], { className: 'tech-glow-path trajectory-path', color: CONFIG.colors.pathVisited, opacity: 0.9 }).addTo(map); trajectoryData.forEach(feature => { const point = feature.geometry.coordinates.slice().reverse(); const color = CONFIG.colors[feature.properties.transport_mode] || CONFIG.colors.train; L.circleMarker(point, { radius: 8, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9 }).addTo(map).bindPopup(generatePopupContent(feature.properties)); }); const startNode = trajectoryData[0], nextNode = trajectoryData[1]; previousBearing = nextNode ? calculateBearing(startNode.geometry.coordinates, nextNode.geometry.coordinates) : 0; movingMarker = L.marker(startNode.geometry.coordinates.slice().reverse(), { icon: createDirectionalIcon(startNode.properties.transport_mode || 'train', previousBearing) }).addTo(map); timelineSlider.max = trajectoryData.length - 1; timelineSlider.disabled = false; updateUIState(); map.flyTo(startNode.geometry.coordinates.slice().reverse(), 6, { duration: 2.5 }).once('moveend', () => { setTimeout(() => { if (isAnimating) playAnimation(); }, 300); }); }

    // =================================================================
    // 5. 动画与UI控制 (No changes)
    // =================================================================
    function startAnimation() { /* ... function content is unchanged ... */ 
        if (currentSegmentIndex >= trajectoryData.length - 1) { handleJourneyEnd(); return; } 
        const startNode = trajectoryData[currentSegmentIndex], endNode = trajectoryData[currentSegmentIndex + 1]; 
        const startLatLng = L.latLng(startNode.geometry.coordinates.slice().reverse()); 
        const endLatLng = L.latLng(endNode.geometry.coordinates.slice().reverse()); 
        const bearing = calculateBearing(startNode.geometry.coordinates, endNode.geometry.coordinates); 
        const transportType = endNode.properties.transport_mode || 'train'; 
        const duration = CONFIG.animationBaseDuration / animationSpeed; let startTime = null; 
        const currentPathPoints = pathLayers[currentSegmentIndex].fullPoints; 
        const distance = startLatLng.distanceTo(endLatLng); 
        const LONG_DISTANCE_THRESHOLD = 10000 * 1000; 
        if (distance > LONG_DISTANCE_THRESHOLD) { const geoMidPointLat = (startLatLng.lat + endLatLng.lat) / 2; 
            const midPointLng = (startLatLng.lng + endLatLng.lng) / 2; 
            const latOffset = 18; 
            const visualCenterLat = geoMidPointLat - latOffset; 
            const visualMidPoint = L.latLng(visualCenterLat, midPointLng); 
            map.flyTo(visualMidPoint, 1.5, { duration: 1.2 }); 
        } else { 
            const bounds = L.latLngBounds(startLatLng, endLatLng); 
            map.flyToBounds(bounds, { padding: [100, 100], maxZoom: 12, duration: 1.0 }); 
        } 
        map.once('moveend', () => { animationFrameId = requestAnimationFrame(animate); }); 
        function animate(currentTime) { 
            if (!isAnimating) return; 
            if (!startTime) startTime = currentTime; 
            const progress = Math.min((currentTime - startTime) / duration, 1); 
            const pointIndex = Math.floor(progress * (currentPathPoints.length - 1)); 
            const currentLatLng = currentPathPoints[Math.min(pointIndex, currentPathPoints.length - 1)]; 
            movingMarker.setIcon(createDirectionalIcon(transportType, interpolateBearing(previousBearing, bearing, progress))); 
            movingMarker.setLatLng(currentLatLng); 
            const currentSlice = currentPathPoints.slice(0, pointIndex + 1); 
            drawnPathLayer.setLatLngs([...completedPathPoints, ...currentSlice]); 
            if (progress < 1) { 
                animationFrameId = requestAnimationFrame(animate); 
            } else { 
                completedPathPoints.push(...currentPathPoints); 
                drawnPathLayer.setLatLngs(completedPathPoints); 
                previousBearing = bearing; 
                currentSegmentIndex++; 
                updateUIState(); 
                // ** 修改的核心逻辑在这里 **
                movingMarker.bindPopup(generatePopupContent(endNode.properties), { autoClose: true, closeOnClick: false }).openPopup();

                // 判断旅程是否已经结束
                if (currentSegmentIndex >= trajectoryData.length - 1) {
                    // 如果是最后一个点，直接调用结束函数，并停止后续操作
                    setTimeout(() => {
                        movingMarker.closePopup();
                        handleJourneyEnd(); // 清晰地调用结束处理
                    }, 1500); // 留一点时间看最后一个点的弹窗
                } else {
                    // 如果还未结束，才更新学术面板并准备下一次动画
                    updateAcademicPanelToYear(yearMap[currentSegmentIndex]);
                    setTimeout(() => {
                        movingMarker.closePopup();
                        if (isAnimating) startAnimation(); // 正常继续下一次循环
                    }, Math.max(1000, 2000 / animationSpeed));
                }
            }
        }
    }
    function handleJourneyEnd() {
        pauseAnimation();
        const allPoints = trajectoryData.map(f => f.geometry.coordinates.slice().reverse());
        if(allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints);
            map.flyToBounds(bounds, { 
                paddingTopLeft: [50, 20],
                paddingBottomRight: [50, 80],
                duration: 2,
                maxZoom: 6
            });
        }
        updateAcademicPanelToYear(new Date().getFullYear());
    }
    function playAnimation() { isAnimating = true; playPauseBtn.innerHTML = '⏸️'; startAnimation(); }
    function pauseAnimation() { isAnimating = false; playPauseBtn.innerHTML = '▶️'; if (animationFrameId) cancelAnimationFrame(animationFrameId); }
    function handlePlayPause() { if (isAnimating) { pauseAnimation(); } else { if (currentSegmentIndex >= trajectoryData.length - 1) { resetAnimation(); setTimeout(playAnimation, 100); } else { playAnimation(); } } }
    function setupSpeedControls() { speedMenu.innerHTML = ''; CONFIG.speeds.forEach((speed, index) => { const btn = document.createElement('button'); btn.textContent = CONFIG.speedLabels[index]; btn.dataset.index = index; if (index === currentSpeedIndex) btn.classList.add('active'); speedMenu.appendChild(btn); }); }
    function handleSpeedChange(index) { currentSpeedIndex = index; animationSpeed = CONFIG.speeds[currentSpeedIndex]; speedBtn.textContent = CONFIG.speedLabels[currentSpeedIndex]; speedMenu.querySelectorAll('button').forEach(btn => btn.classList.remove('active')); speedMenu.querySelector(`button[data-index="${index}"]`).classList.add('active'); speedMenu.classList.remove('visible'); }
    function resetAnimation() { if (animationFrameId) cancelAnimationFrame(animationFrameId); isAnimating = false; playPauseBtn.innerHTML = '▶️'; currentSegmentIndex = 0; completedPathPoints = []; drawnPathLayer.setLatLngs([]); if (trajectoryData.length > 0) { const startNode = trajectoryData[0]; previousBearing = trajectoryData[1] ? calculateBearing(startNode.geometry.coordinates, trajectoryData[1].geometry.coordinates) : 0; movingMarker.setLatLng(startNode.geometry.coordinates.slice().reverse()).setIcon(createDirectionalIcon(startNode.properties.transport_mode || 'train', previousBearing)); map.flyTo([34.5, 108.9], 4, { duration: 1.5 }); updateUIState(); updateAcademicPanelToYear(yearMap[0]); } }
    function jumpToStep(index) { pauseAnimation(); currentSegmentIndex = index; completedPathPoints = pathLayers.slice(0, index).flatMap(p => p.fullPoints); drawnPathLayer.setLatLngs(completedPathPoints); const targetNode = trajectoryData[index]; if (!targetNode) return; const transportType = targetNode.properties.transport_mode || 'train'; let bearing = previousBearing; if (index < trajectoryData.length - 1) bearing = calculateBearing(targetNode.geometry.coordinates, trajectoryData[index + 1].geometry.coordinates); else if (index > 0) bearing = calculateBearing(trajectoryData[index - 1].geometry.coordinates, targetNode.geometry.coordinates); previousBearing = bearing; movingMarker.setLatLng(targetNode.geometry.coordinates.slice().reverse()).setIcon(createDirectionalIcon(transportType, bearing)); if (index === parseInt(timelineSlider.max, 10)) { const allPoints = trajectoryData.map(f => f.geometry.coordinates.slice().reverse()); if (allPoints.length > 0) { map.flyToBounds(L.latLngBounds(allPoints), { padding: [50, 50], duration: 1.5 }); } } else { map.flyTo(targetNode.geometry.coordinates.slice().reverse(), Math.max(map.getZoom(), 6), { duration: 1 }); } updateUIState(); const year = (index == timelineSlider.max) ? new Date().getFullYear() : yearMap[index]; updateAcademicPanelToYear(year); }
    function updateUIState() { timelineSlider.value = currentSegmentIndex; updateSliderFill(timelineSlider); }
    function generatePopupContent(props) { /* ... function content is unchanged ... */ const type = props.transport_mode || 'train'; const colorRgbVar = `--${type}-color-rgb`; const colorVar = `--${type}-color`; const names = { plane: '✈️ 飞机', train: '🚄 火车', bus: '🚌 巴士', bicycle: '🚴 自行车', walk: '🚶 步行' }; return `<div style="min-width: 200px;"><div style="display: flex; align-items: center; margin-bottom: 12px; padding: 8px; background-color: rgba(var(${colorRgbVar}), 0.1); border-radius: 6px;"><span style="display: inline-block; width: 12px; height: 12px; background-color: var(${colorVar}); border-radius: 50%; margin-right: 8px;"></span><strong style="color: var(${colorVar});">${names[type]}</strong></div><div style="line-height: 1.6;"><div><strong>📅 时间:</strong> ${props.时间段 || '未知'}</div><div><strong>📍 地点:</strong> ${props.地点 || '未知'}</div><div><strong>🎯 事件:</strong> ${props.事件 || '未知'}</div></div></div>`; }
    function updateSliderFill(slider) { const percentage = (slider.value - slider.min) / (slider.max - slider.min) * 100; slider.style.background = `linear-gradient(90deg, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%)`; }
    
    // =================================================================
    // 6. 学术面板逻辑 (Charts logic updated for new theme)
    // =================================================================
    function setupAcademicPanel() { /* ... function content is unchanged ... */ if (!fullAcademicData) { academicPanel.innerHTML = '<p>学术数据加载失败。</p>'; return; } academicPanel.innerHTML = ` <div class="academic-category" id="publications-card"> <div class="category-header"><span class="category-icon">📚</span>学术著作</div> <div class="category-content"> <div class="stat-grid"> <div class="stat-item" id="papers-total-item"><div class="stat-number" id="papers-total">0</div><div class="stat-label">论文</div></div> <div class="stat-item" id="books-total-item"><div class="stat-number" id="books-total">0</div><div class="stat-label">著作</div></div> <div class="stat-item" id="reports-total-item"><div class="stat-number" id="reports-total">0</div><div class="stat-label">报告</div></div> <div class="stat-item" id="patents-total-item"><div class="stat-number" id="patents-total">0</div><div class="stat-label">专利</div></div> <div class="stat-item" id="softwares-total-item"><div class="stat-number" id="softwares-total">0</div><div class="stat-label">软著</div></div> <div class="stat-item"><div class="stat-number" id="publications-cumulative">0</div><div class="stat-label">累计</div></div> </div> <div class="chart-container"><canvas id="publicationChart"></canvas></div> </div> </div> <div class="academic-category" id="projects-card"> <div class="category-header"><span class="category-icon">🔬</span>科研项目</div> <div class="category-content"> <div class="stat-grid"> <div class="stat-item" id="national-proj-total-item"><div class="stat-number" id="national-proj-total">0</div><div class="stat-label">国家级</div></div> <div class="stat-item" id="provincial-proj-total-item"><div class="stat-number" id="provincial-proj-total">0</div><div class="stat-label">省部级</div></div> <div class="stat-item" id="other-proj-total-item"><div class="stat-number" id="other-proj-total">0</div><div class="stat-label">其他</div></div> <div class="stat-item"><div class="stat-number" id="projects-cumulative">0</div><div class="stat-label">累计</div></div> </div> <div class="chart-container"><canvas id="projectChart"></canvas></div> </div> </div> <div class="academic-category" id="awards-card"> <div class="category-header"><span class="category-icon">🏆</span>获奖情况</div> <div class="category-content" id="awards-list"></div> </div> <div class="academic-category" id="students-card"> <div class="category-header"><span class="category-icon">🎓</span>研究生培养</div> <div class="category-content" id="students-list"></div> </div> <div class="academic-category" id="interests-card"> <div class="category-header"><span class="category-icon">💡</span>研究兴趣</div> <div class="category-content"> <ul id="research-interests-list"></ul> </div> </div> `; document.getElementById('awards-list').innerHTML = `<div class="detail-list"> <div class="detail-group"> <h4 class="detail-subheader"> <span class="detail-subheader-title">荣誉称号</span> <span class="detail-count" id="honors-count">0</span> </h4> <div class="detail-menu"><ul class="detail-sublist" id="honors-sublist"></ul></div> </div> <div class="detail-group"> <h4 class="detail-subheader"> <span class="detail-subheader-title">科研奖励</span> <span class="detail-count" id="research-awards-count">0</span> </h4> <div class="detail-menu"><ul class="detail-sublist" id="research-awards-sublist"></ul></div> </div> </div>`; document.getElementById('students-list').innerHTML = `<div class="detail-list"> <div class="detail-group"> <h4 class="detail-subheader"> <span class="detail-subheader-title">博后</span> <span class="detail-count" id="postdocs-count">0</span> </h4> <div class="detail-menu"><ul class="detail-sublist" id="postdocs-sublist"></ul></div> </div> <div class="detail-group"> <h4 class="detail-subheader"> <span class="detail-subheader-title">博士</span> <span class="detail-count" id="phds-count">0</span> </h4> <div class="detail-menu"><ul class="detail-sublist" id="phds-sublist"></ul></div> </div> <div class="detail-group"> <h4 class="detail-subheader"> <span class="detail-subheader-title">硕士</span> <span class="detail-count" id="masters-count">0</span> </h4> <div class="detail-menu"><ul class="detail-sublist" id="masters-sublist"></ul></div> </div> </div>`; const interestsList = document.getElementById('research-interests-list'); const interests = fullAcademicData.research_interests || ["时空数据挖掘", "地理信息科学", "时空大数据分析与可视化", "机器学习", "位置智能"]; interestsList.innerHTML = interests.map(interest => `<li>${interest}</li>`).join(''); createAcademicCharts(); }
    function updateAcademicPanelToYear(targetYear) { /* ... function content is unchanged ... */ if (!fullAcademicData) return; const filteredData = { publications: (fullAcademicData.publications || []).filter(p => p.year <= targetYear), projects: (fullAcademicData.projects || []).filter(p => p.year <= targetYear), awards: (fullAcademicData.awards || []).filter(a => a.year <= targetYear), students: (fullAcademicData.students || []).filter(s => s.year_start <= targetYear), }; const pubTotals = { papers: 0, books: 0, reports: 0, patents: 0, softwares: 0 }; const paperTypes = ["论文", "博士学位论文", "博士后出站报告", "硕士学位论文"]; const bookTypes = ["著作", "书中章节"]; filteredData.publications.forEach(p => { if (paperTypes.includes(p.type)) pubTotals.papers++; else if (bookTypes.includes(p.type)) pubTotals.books++; else if (p.type === "学术报告") pubTotals.reports++; else if (p.type === "专利") pubTotals.patents++; else if (p.type === "软著") pubTotals.softwares++; }); animateCountUp(document.getElementById('papers-total'), pubTotals.papers); animateCountUp(document.getElementById('books-total'), pubTotals.books); animateCountUp(document.getElementById('reports-total'), pubTotals.reports); animateCountUp(document.getElementById('patents-total'), pubTotals.patents); animateCountUp(document.getElementById('softwares-total'), pubTotals.softwares); animateCountUp(document.getElementById('publications-cumulative'), Object.values(pubTotals).reduce((a, b) => a + b, 0)); const projTotals = { national: 0, provincial: 0, other: 0 }; const provincialLevels = ["省级", "省部级", "部级"]; filteredData.projects.forEach(p => { if (p.level === "国家级") projTotals.national++; else if (provincialLevels.includes(p.level)) projTotals.provincial++; else projTotals.other++; }); animateCountUp(document.getElementById('national-proj-total'), projTotals.national); animateCountUp(document.getElementById('provincial-proj-total'), projTotals.provincial); animateCountUp(document.getElementById('other-proj-total'), projTotals.other); animateCountUp(document.getElementById('projects-cumulative'), Object.values(projTotals).reduce((a, b) => a + b, 0)); const awardsHonors = filteredData.awards.filter(a => a.type === "荣誉称号").sort((a,b) => b.year - a.year); const awardsResearch = filteredData.awards.filter(a => a.type !== "荣誉称号").sort((a,b) => b.year - a.year); animateCountUp(document.getElementById('honors-count'), awardsHonors.length); animateCountUp(document.getElementById('research-awards-count'), awardsResearch.length); document.getElementById('honors-sublist').innerHTML = awardsHonors.map(a => `<li><small>${a.year}</small> ${a.title}</li>`).join('') || '<li>暂无数据</li>'; document.getElementById('research-awards-sublist').innerHTML = awardsResearch.map(a => `<li><small>${a.year}</small> ${a.title}</li>`).join('') || '<li>暂无数据</li>'; const studentsPostdocs = filteredData.students.filter(s => s.level === "博后"); const studentsPhds = filteredData.students.filter(s => s.level === "博士"); const studentsMasters = filteredData.students.filter(s => s.level === "硕士"); const postdocsCount = studentsPostdocs.reduce((acc, s) => acc + s.names.length, 0); const phdsCount = studentsPhds.reduce((acc, s) => acc + s.names.length, 0); const mastersCount = studentsMasters.reduce((acc, s) => acc + s.names.length, 0); animateCountUp(document.getElementById('postdocs-count'), postdocsCount); animateCountUp(document.getElementById('phds-count'), phdsCount); animateCountUp(document.getElementById('masters-count'), mastersCount); document.getElementById('postdocs-sublist').innerHTML = studentsPostdocs.sort((a,b)=>b.year_start-a.year_start).map(s => `<li class="student-list-item"><strong>${s.year_start}级:</strong> ${s.names.join(', ')}</li>`).join('') || '<li>暂无数据</li>'; document.getElementById('phds-sublist').innerHTML = studentsPhds.sort((a,b)=>b.year_start-a.year_start).map(s => `<li class="student-list-item"><strong>${s.year_start}级:</strong> ${s.names.join(', ')}</li>`).join('') || '<li>暂无数据</li>'; document.getElementById('masters-sublist').innerHTML = studentsMasters.sort((a,b)=>b.year_start-a.year_start).map(s => `<li class="student-list-item"><strong>${s.year_start}级:</strong> ${s.names.join(', ')}</li>`).join('') || '<li>暂无数据</li>'; updateCharts(filteredData, targetYear); }
    function createAcademicCharts() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const gridColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0,0,0,0.05)';
        const textColor = isDarkMode ? '#94a3b8' : '#6b7280';
        const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color').trim();
        const cumulativeColor = getComputedStyle(document.body).getPropertyValue('--cumulative-color').trim();

        const getChartOptions = () => ({
            maintainAspectRatio: false, responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 20,
                        font: { size: 11 },
                        color: textColor,
                        // --- 核心修改在这里 ---
                        // 这个函数让我们完全控制图例的外观
                        generateLabels: function(chart) {
                            // 首先，获取 Chart.js 默认生成的图例项
                            const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);

                            // 然后，检查当前是否为暗黑模式
                            if (document.body.classList.contains('dark-mode')) {
                                labels.forEach(label => {
                                    const dataset = chart.data.datasets[label.datasetIndex];
                                    // 我们只修改柱状图的图例。折线图的图例（一条线）保持原样。
                                    // 我们使用之前定义的 hoverBackgroundColor，因为它是一个完美的、100%不透明的实色。
                                    if (dataset.type !== 'line' && dataset.hoverBackgroundColor) {
                                        // --- CORE MODIFICATION HERE ---
                                        // Instead of a solid color, create a semi-transparent one.
                                        // We use an opacity of 0.75 for a good balance of color and transparency.
                                        const colorInfo = CONFIG.darkColorMap[dataset.colorKey] || { main: '96, 165, 250' }; // Get color info
                                        label.fillStyle = `rgba(${colorInfo.main}, 0.75)`;
                                    }
                                });
                            }
                            
                            // 返回我们修改后的图例项数组
                            return labels;
                        }
                    }
                },
                tooltip: {
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(0,0,0,0.8)',
                    borderColor: isDarkMode ? 'rgba(14, 165, 233, 0.5)' : '#fff',
                    borderWidth: isDarkMode ? 1 : 0,
                    padding: 10,
                    backdropFilter: 'blur(5px)',
                }
            },
            scales: { 
                x: { 
                    stacked: true, 
                    grid: { display: false }, 
                    ticks: { font: { size: 10 }, color: textColor } 
                },
                y_bar: { 
                    stacked: true, 
                    beginAtZero: true, 
                    grid: { 
                        color: gridColor,
                        // 新增：将网格线变为科技感虚线
                        border: {
                            dash: isDarkMode ? [3, 6] : [1, 0], // 暗黑模式用虚线，白天用实线
                        }
                    }, 
                    ticks: { precision: 0, color: textColor }, 
                    position: 'left', 
                    title: { display: false } 
                },
                y_line: { 
                    beginAtZero: true, 
                    grid: { drawOnChartArea: false }, 
                    position: 'right', 
                    title: { display: false }, 
                    ticks: { font: { size: 10 }, color: textColor } 
                }
            },
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 800, easing: 'easeOutCubic' },
        });
        
        // MODIFIED: 修改这个辅助函数
        const barDatasetOptions = (colorKey) => {
            const isDarkMode = document.body.classList.contains('dark-mode');
            const colorMapToUse = isDarkMode ? CONFIG.darkColorMap : CONFIG.colorMap;
            const colorInfo = colorMapToUse[colorKey];
            const ctx = document.createElement('canvas').getContext('2d'); 
            
            const borderColorValue = isDarkMode ? '#ffffff' : `rgba(${colorInfo.main}, 1)`;
            
            return {
                colorKey: colorKey, // <-- ADD THIS LINE
                backgroundColor: isDarkMode 
                    ? createDarkGradient(ctx, colorInfo) 
                    : createGradient(ctx, colorInfo),
                
                borderColor: borderColorValue,
                borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
                hoverBackgroundColor: `rgba(${colorInfo.main}, 1)`,
                yAxisID: 'y_bar'
            };
        };

        if (publicationChart) publicationChart.destroy();
        const pubCtx = document.getElementById('publicationChart').getContext('2d');
        publicationChart = new Chart(pubCtx, { type: 'bar', data: { labels: [], datasets: [ 
            { label: '论文', ...barDatasetOptions('paper')}, { label: '著作', ...barDatasetOptions('book') }, { label: '报告', ...barDatasetOptions('report') }, { label: '专利', ...barDatasetOptions('patent') }, { label: '软著', ...barDatasetOptions('software') }, 
            { type: 'line', label: '累计', borderColor: cumulativeColor, yAxisID: 'y_line', tension: 0.3, fill: { target: 'origin', above: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : `rgba(${CONFIG.colorMap.cumulative.main}, 0.1)`}, pointBackgroundColor: cumulativeColor, pointRadius: 3, pointHoverRadius: 6, pointBorderColor: 'white', pointHoverBorderWidth: 2 }
        ] }, options: getChartOptions() });
        
        if (projectChart) projectChart.destroy();
        const projCtx = document.getElementById('projectChart').getContext('2d');
        projectChart = new Chart(projCtx, { type: 'bar', data: { labels: [], datasets: [ 
            { label: '国家级', ...barDatasetOptions('national-proj') }, { label: '省部级', ...barDatasetOptions('provincial-proj') }, { label: '其他', ...barDatasetOptions('other-proj') }, 
            { type: 'line', label: '累计', borderColor: cumulativeColor, yAxisID: 'y_line', tension: 0.3, fill: { target: 'origin', above: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : `rgba(${CONFIG.colorMap.cumulative.main}, 0.1)`}, pointBackgroundColor: cumulativeColor, pointRadius: 3, pointHoverRadius: 6, pointBorderColor: 'white', pointHoverBorderWidth: 2 }
        ] }, options: getChartOptions() });
    }
    function createGradient(ctx, colorInfo) { 
        /* ... function content is unchanged ... */ 
        const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height); 
        gradient.addColorStop(0, `rgba(${colorInfo.main}, 0.8)`); 
        gradient.addColorStop(1, `rgba(${colorInfo.main}, 0.2)`); 
        return gradient; 
    }

    // --- 在这里添加下面的新函数 ---
    function createDarkGradient(ctx, colorInfo) {
        const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
        // 核心修改：适度提高不透明度，找到平衡点
        // 从 70% 不透明度 渐变到 20% 不透明度
        gradient.addColorStop(0, `rgba(${colorInfo.main}, 0.7)`); 
        gradient.addColorStop(1, `rgba(${colorInfo.main}, 0.2)`);
        return gradient;
    }
    function updateCharts(data, targetYear) { /* ... function content is unchanged ... */ const startYear = 1991; const allYears = Array.from({length: targetYear - startYear + 1}, (_, i) => startYear + i); const pubByYear = {}, projByYear = {}; const paperTypes = ["论文", "博士学位论文", "博士后出站报告", "硕士学位论文"], bookTypes = ["著作", "书中章节"]; const provincialLevels = ["省级", "省部级", "部级"]; allYears.forEach(y => { pubByYear[y] = { papers: 0, books: 0, reports: 0, patents: 0, softwares: 0 }; projByYear[y] = { national: 0, provincial: 0, other: 0 }; }); data.publications.forEach(p => { if (pubByYear[p.year]) { if (paperTypes.includes(p.type)) pubByYear[p.year].papers++; else if (bookTypes.includes(p.type)) pubByYear[p.year].books++; else if (p.type === "学术报告") pubByYear[p.year].reports++; else if (p.type === "专利") pubByYear[p.year].patents++; else if (p.type === "软著") pubByYear[p.year].softwares++; } }); data.projects.forEach(p => { if (projByYear[p.year]) { if (p.level === "国家级") projByYear[p.year].national++; else if (provincialLevels.includes(p.level)) projByYear[p.year].provincial++; else projByYear[p.year].other++; } }); let cumulativePub = 0, cumulativeProj = 0; const cumulativePubData = allYears.map(y => { cumulativePub += Object.values(pubByYear[y]).reduce((a, b) => a + b, 0); return cumulativePub; }); const cumulativeProjData = allYears.map(y => { cumulativeProj += Object.values(projByYear[y]).reduce((a, b) => a + b, 0); return cumulativeProj; }); publicationChart.data.labels = allYears; publicationChart.data.datasets[0].data = allYears.map(y => pubByYear[y].papers); publicationChart.data.datasets[1].data = allYears.map(y => pubByYear[y].books); publicationChart.data.datasets[2].data = allYears.map(y => pubByYear[y].reports); publicationChart.data.datasets[3].data = allYears.map(y => pubByYear[y].patents); publicationChart.data.datasets[4].data = allYears.map(y => pubByYear[y].softwares); publicationChart.data.datasets[5].data = cumulativePubData; publicationChart.update(); projectChart.data.labels = allYears; projectChart.data.datasets[0].data = allYears.map(y => projByYear[y].national); projectChart.data.datasets[1].data = allYears.map(y => projByYear[y].provincial); projectChart.data.datasets[2].data = allYears.map(y => projByYear[y].other); projectChart.data.datasets[3].data = cumulativeProjData; projectChart.update(); }
    
    // =================================================================
    // 7. 事件监听 (No changes)
    // =================================================================
    playPauseBtn.addEventListener('click', handlePlayPause); resetBtn.addEventListener('click', resetAnimation); timelineSlider.addEventListener('input', (e) => jumpToStep(parseInt(e.target.value, 10))); speedBtn.addEventListener('click', (e) => { e.stopPropagation(); speedMenu.classList.toggle('visible'); }); speedMenu.addEventListener('click', (e) => { if (e.target.closest('button')) handleSpeedChange(parseInt(e.target.closest('button').dataset.index)); }); themeToggleBtn.addEventListener('click', toggleTheme); document.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); handlePlayPause(); } if (e.key.toLowerCase() === 'r') resetAnimation(); }); 
    academicPanel.addEventListener('click', (e) => {
        const subHeader = e.target.closest('.detail-subheader');
        if (subHeader) {
            const currentGroup = subHeader.parentElement;
            const currentMenu = subHeader.nextElementSibling;
            const parentCategory = currentGroup.closest('.academic-category'); // NEW: Get the parent card

            // Deactivate other groups/cards
            academicPanel.querySelectorAll('.detail-group.is-active').forEach(group => {
                if (group !== currentGroup) {
                    group.classList.remove('is-active');
                    group.querySelector('.detail-menu').classList.remove('visible');
                }
            });
            
            // NEW: Deactivate other cards
            document.querySelectorAll('.academic-category.is-active').forEach(cat => {
                if (cat !== parentCategory) {
                    cat.classList.remove('is-active');
                }
            });

            // Toggle current group and its parent card
            currentGroup.classList.toggle('is-active');
            currentMenu.classList.toggle('visible');
            parentCategory.classList.toggle('is-active', currentGroup.classList.contains('is-active')); // NEW: Toggle the card's active state

            e.stopPropagation();
        }
    });

    // 同时，修改 document 的 click 监听器，确保点击外部时能移除 is-active 类
    document.addEventListener('click', (e) => {
        if (!speedBtn.contains(e.target) && !speedMenu.contains(e.target)) {
            speedMenu.classList.remove('visible');
        }
        if (!e.target.closest('.detail-group')) {
            academicPanel.querySelectorAll('.detail-group.is-active').forEach(group => {
                group.classList.remove('is-active');
                group.querySelector('.detail-menu').classList.remove('visible');
            });
            // NEW: Also remove active state from cards
            document.querySelectorAll('.academic-category.is-active').forEach(cat => cat.classList.remove('is-active'));
        }
    });
    // =================================================================
    // 8. 主题切换与启动 (No changes)
    // =================================================================
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        updateThemeUI(isDarkMode);
        // Recreate charts with new theme colors and update data
        createAcademicCharts();
        const currentYear = (currentSegmentIndex === parseInt(timelineSlider.max, 10)) ? new Date().getFullYear() : (yearMap[currentSegmentIndex] || 1987);
        updateAcademicPanelToYear(currentYear);
    }
    function updateThemeUI(isDarkMode) {
        // 1. 定义两个 SVG 图标字符串
        const sunIconSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="theme-icon-svg sun-icon">
                <!-- Sun Icon SVG Path -->
                <path d="M12 5C8.69 5 6 7.69 6 11s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zM12 15c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zM4 11H1c-0.55 0-1 0.45-1 1s0.45 1 1 1h3c0.55 0 1-0.45 1-1s-0.45-1-1-1zM23 11h-3c-0.55 0-1 0.45-1 1s0.45 1 1 1h3c0.55 0 1-0.45 1-1s-0.45-1-1-1zM12 1c-0.55 0-1 0.45-1 1v3c0 0.55 0.45 1 1 1s1-0.45 1-1V2c0-0.55-0.45-1-1-1zM12 19c-0.55 0-1 0.45-1 1v3c0 0.55 0.45 1 1 1s1-0.45 1-1v-3c0-0.55-0.45-1-1-1zM6.71 5.29L4.6 3.18c-0.39-0.39-1.02-0.39-1.41 0s-0.39 1.02 0 1.41l2.12 2.12c0.39 0.39 1.02 0.39 1.41 0s0.39-1.02 0-1.41zM19.4 17.29l2.12 2.12c0.39 0.39 1.02 0.39 1.41 0s0.39-1.02 0-1.41l-2.12-2.12c-0.39-0.39-1.02-0.39-1.41 0s-0.39 1.02 0 1.41zM19.4 6.71c0.39-0.39 0.39-1.02 0-1.41s-1.02-0.39-1.41 0l-2.12 2.12c-0.39 0.39-0.39 1.02 0 1.41s1.02 0.39 1.41 0l2.12-2.12zM4.6 20.82l2.12-2.12c0.39-0.39 0.39-1.02 0-1.41s-1.02-0.39-1.41 0l-2.12 2.12c-0.39 0.39-0.39 1.02 0 1.41s1.02 0.39 1.41 0z"/>
            </svg>`;

        // --- NEW: Sleek & Technical Moon Icon ---
        const moonIconSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="theme-icon-svg moon-icon">
                <path d="M17.7,18.5c-4.9,0-8.9-4-8.9-8.9c0-3.5,2-6.5,4.9-8.1C13.2,1.2,12.6,1,12,1C6.5,1,2,5.5,2,11s4.5,10,10,10 c3.2,0,6.1-1.5,8-4C19.3,18,18.5,18.5,17.7,18.5z M19,12.5c-0.3,0-0.5,0.1-0.7,0.3c-0.2,0.2-0.3,0.4-0.3,0.7s0.1,0.5,0.3,0.7 c0.2,0.2,0.4,0.3,0.7,0.3s0.5-0.1,0.7-0.3c0.2-0.2,0.3-0.4,0.3-0.7s-0.1-0.5-0.3-0.7C19.5,12.6,19.3,12.5,19,12.5z"/>
            </svg>`;
        
        // 2. 根据模式设置对应的 SVG
        if (isDarkMode) {
            themeToggleBtn.innerHTML = sunIconSVG; // 在暗黑模式下，按钮应该显示“切换到白天”的太阳图标
        } else {
            themeToggleBtn.innerHTML = moonIconSVG; // 在白天模式下，按钮应该显示“切换到黑夜”的月亮图标
        }
        // 3. 这行代码保持不变，它负责处理地图底图
        switchBaseMapByZoom(map.getZoom());
    }
    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // MODIFIED: 初始加载时选择对应的地图
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            baseMaps["高德地图 (暗色)"].addTo(map);
            updateThemeUI(true);
        } else {
            baseMaps["高德地图"].addTo(map);
            updateThemeUI(false);
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        applyInitialTheme();
        setupSpeedControls();
        setTimeout(loadData, 300);
    });
})();