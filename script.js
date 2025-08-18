(function() {
    // =================================================================
    // 1. 配置与初始化
    // =================================================================
    const CONFIG = {
        animationBaseDuration: 3000,
        speeds: [0.5, 1, 1.5, 2, 3],
        speedLabels: ['0.5x', '1.0x', '1.5x', '2.0x', '3.0x'],
        colors: {
            plane: '#9C27B0', 
            train: '#2196F3', 
            bus: '#FF9800', 
            bicycle: '#4CAF50',
            walk: '#795548',
            pathDefault: '#6b7280', 
            pathVisited: '#10b981', 
            pathCurrent: '#3b82f6'
        }
    };

    const map = L.map('map').setView([34.5, 108.9], 4);
    const playPauseBtn = document.getElementById('play-pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const speedBtn = document.getElementById('speed-btn');
    const speedMenu = document.getElementById('speed-menu');
    const timelineSlider = document.getElementById('timeline-slider');
    const infoDisplay = document.getElementById('info-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const journeyEndOverlay = document.getElementById('journey-end-overlay');

    let isAnimating = true;
    let animationFrameId = null;
    let currentSegmentIndex = 0;
    let trajectoryData = [];
    let allTrajectoryPoints = [];
    let movingMarker = null;
    let pathLayers = [];
    let currentSpeedIndex = 1; // 默认1.0x
    let animationSpeed = CONFIG.speeds[currentSpeedIndex];
    let previousBearing = 0;
    let stats = { totalLocations: 0, totalYears: 0, transportModes: new Set() };

    // =================================================================
    // 2. 地图底图设置
    // =================================================================
    const baseMaps = {
        "高德地图": L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', { 
            subdomains: ['1', '2', '3', '4'], 
            attribution: '&copy; 高德地图'
        }),
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }),
        "CartoDB 浅色": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
            attribution: '&copy; CARTO', 
            maxZoom: 19 
        }),
        "谷歌影像": L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { 
            subdomains: ['0', '1', '2', '3'], 
            attribution: '&copy; Google Maps' 
        })
    };
    baseMaps["高德地图"].addTo(map);
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // =================================================================
    // 3. 使用本地SVG文件的图标定义
    // =================================================================
    const createDirectionalIcon = (type, bearing = 0) => {
        const iconFileMap = {
            plane: 'plane.svg',
            train: 'train.svg',
            bus: 'bus.svg',
            bicycle: 'bike.svg',
            walk: 'walk.svg'
        };
        const iconFile = iconFileMap[type] || iconFileMap.train;

        const rotation = (type === 'plane') ? bearing - 45 : bearing;

        return L.divIcon({
            html: `<div class="direction-indicator-wrapper">
                       <img src="${iconFile}" class="direction-indicator-svg" style="transform: rotate(${rotation}deg);">
                   </div>`,
            className: '', 
            iconSize: [36, 36], 
            iconAnchor: [18, 18]
        });
    };
    
    // =================================================================
    // 4. 工具函数
    // =================================================================
    function calculateBearing(start, end) {
        const startLat = start[1] * Math.PI / 180;
        const startLng = start[0] * Math.PI / 180;
        const endLat = end[1] * Math.PI / 180;
        const endLng = end[0] * Math.PI / 180;
        const dLng = endLng - startLng;
        const y = Math.sin(dLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function interpolateBearing(start, end, t) {
        let diff = end - start;
        if (diff > 180) diff -= 360; 
        if (diff < -180) diff += 360;
        return (start + diff * t + 360) % 360;
    }

    function animateValue(obj, start, end, duration, suffix = '') {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.textContent = Math.floor(progress * (end - start) + start) + suffix;
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }
    
    function isEurope(lat, lng) { return lat > 35 && lng > -10 && lng < 40; }
    function isNorthAmerica(lat, lng) { return lat > 25 && lng < -50 && lng > -170; }
    function isAsia(lat, lng) { return lat > 0 && lng > 60 && lng < 150; }

    function createRealisticCurvedPath(start, end, drawnSegments) {
        const segmentKey = `${end.toString()}-${start.toString()}`;
        const isReturnTrip = drawnSegments.has(segmentKey);
        const startLatLng = L.latLng(start[1], start[0]);
        const endLatLng = L.latLng(end[1], end[0]);
        const distance = map.options.crs.distance(startLatLng, endLatLng);
        const midPoint = L.latLng((startLatLng.lat + endLatLng.lat) / 2, (startLatLng.lng + endLatLng.lng) / 2);

        let controlPoint;
        let offsetMultiplier;
        
        const startIsAsia = isAsia(startLatLng.lat, startLatLng.lng);
        const endIsNA = isNorthAmerica(endLatLng.lat, endLatLng.lng);
        const startIsNA = isNorthAmerica(startLatLng.lat, startLatLng.lng);
        const endIsAsia = isAsia(endLatLng.lat, endLatLng.lng);
        
        if ((startIsAsia && endIsNA) || (startIsNA && endIsAsia)) {
            offsetMultiplier = Math.min(distance * 0.00000025, 0.4);
            let perpOffset, latOffset;

            if (startIsAsia && endIsNA) {
                perpOffset = offsetMultiplier * (isReturnTrip ? 1.5 : -1); 
                latOffset = Math.abs(startLatLng.lng - endLatLng.lng) * 0.2;
            } else { 
                perpOffset = offsetMultiplier * (isReturnTrip ? -1.5 : 1);
                latOffset = -Math.abs(startLatLng.lng - endLatLng.lng) * 0.15;
            }

            controlPoint = L.latLng(
                midPoint.lat + latOffset,
                midPoint.lng + (endLatLng.lat - startLatLng.lat) * perpOffset
            );
        } else {
            offsetMultiplier = Math.min(distance * 0.0000003, 0.5);
            const startIsEU = isEurope(startLatLng.lat, startLatLng.lng), endIsEU = isEurope(endLatLng.lat, endLatLng.lng);
            if ((startIsEU && !endIsEU && !isNorthAmerica(endLatLng.lat, endLatLng.lng)) || (!startIsEU && endIsEU && !isNorthAmerica(startLatLng.lat, startLatLng.lng))) {
                offsetMultiplier = Math.min(distance * 0.0000001, 0.2);
            }
            const perpOffset = offsetMultiplier * (isReturnTrip ? -1.5 : 1);
            controlPoint = L.latLng(
                midPoint.lat + (startLatLng.lng - endLatLng.lng) * perpOffset + Math.abs(startLatLng.lat - endLatLng.lat) * 0.1,
                midPoint.lng + (endLatLng.lat - startLatLng.lat) * perpOffset
            );
        }

        const points = [startLatLng];
        const numSegments = Math.max(50, Math.floor(distance / 20000));
        for (let i = 1; i <= numSegments; i++) {
            const t = i / numSegments;
            const lat = (1 - t) ** 2 * startLatLng.lat + 2 * (1 - t) * t * controlPoint.lat + t ** 2 * endLatLng.lat;
            const lng = (1 - t) ** 2 * startLatLng.lng + 2 * (1 - t) * t * controlPoint.lng + t ** 2 * endLatLng.lng;
            points.push(L.latLng(lat, lng));
        }
        return points.map(point => [point.lat, point.lng]);
    }

    // =================================================================
    // 5. 数据处理与场景设置
    // =================================================================
    const sampleData = { "type": "FeatureCollection", "features": [ { "type": "Feature", "properties": { "时间段": "1969.01 - 1987.07", "地点": "甘肃省民勤县", "事件": "出生与中小学", "transport_mode": "walk" }, "geometry": { "type": "Point", "coordinates": [ 103.09011, 38.62409 ] } }, { "type": "Feature", "properties": { "时间段": "1987.09 - 1991.07", "地点": "武汉", "事件": "武汉测绘科技大学 (本科)", "transport_mode": "train" }, "geometry": { "type": "Point", "coordinates": [ 114.298572, 30.584355 ] } }, { "type": "Feature", "properties": { "时间段": "1996.07 - 1999.08", "地点": "兰州", "事件": "兰州铁道学院 (任教)", "transport_mode": "train" }, "geometry": { "type": "Point", "coordinates": [ 103.823557, 36.058039 ] } }, { "type": "Feature", "properties": { "时间段": "1999.09 - 2002.03", "地点": "武汉", "事件": "武汉大学 (博士)", "transport_mode": "train" }, "geometry": { "type": "Point", "coordinates": [ 114.298572, 30.584355 ] } }, { "type": "Feature", "properties": { "时间段": "2002.04 - 2003.04", "地点": "香港", "事件": "香港理工大学", "transport_mode": "plane" }, "geometry": { "type": "Point", "coordinates": [ 114.177216, 22.302711 ] } }, { "type": "Feature", "properties": { "时间段": "2005.06 - 2006.06", "地点": "瑞士苏黎世", "事件": "苏黎世大学", "transport_mode": "plane" }, "geometry": { "type": "Point", "coordinates": [ 8.541694, 47.3768866 ] } }, { "type": "Feature", "properties": { "时间段": "2010.03 - 2014.06", "地点": "加拿大滑铁卢", "事件": "滑铁卢大学", "transport_mode": "plane" }, "geometry": { "type": "Point", "coordinates": [ -80.52041, 43.46426 ] } }, { "type": "Feature", "properties": { "时间段": "2014.12 - 2015.02", "地点": "美国弗吉尼亚州", "事件": "老道明大学", "transport_mode": "plane" }, "geometry": { "type": "Point", "coordinates": [ -76.285873, 36.8529 ] } }, { "type": "Feature", "properties": { "时间段": "2015.03 - 至今", "地点": "兰州", "事件": "兰州交通大学", "transport_mode": "plane" }, "geometry": { "type": "Point", "coordinates": [ 103.823557, 36.058039 ] } } ] };

    function loadTrajectoryData() {
        fetch('Yan_trails.geojson')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => { 
                trajectoryData = data.features; 
                setupScene(trajectoryData); 
            })
            .catch(error => { 
                console.warn('无法加载 Yan_trails.geojson，将使用内置的示例数据:', error); 
                trajectoryData = sampleData.features; 
                setupScene(trajectoryData); 
            });
    }

    function setupScene(features) {
        loadingOverlay.style.display = 'none';
        if (features.length < 2) { 
            infoDisplay.innerHTML = "轨迹数据不足..."; 
            return; 
        }
        
        allTrajectoryPoints = features.map(f => f.geometry.coordinates.slice().reverse());
        calculateAndDisplayStats(features, true);
        
        const drawnSegments = new Set();
        for (let i = 0; i < features.length - 1; i++) {
            const start = features[i].geometry.coordinates;
            const end = features[i + 1].geometry.coordinates;
            const pathPoints = createRealisticCurvedPath(start, end, drawnSegments);
            const casing = L.polyline(pathPoints, { color: 'black', weight: 6, opacity: 0.15 }).addTo(map);
            const line = L.polyline(pathPoints, { color: CONFIG.colors.pathDefault, weight: 3, opacity: 0.7 }).addTo(map);
            pathLayers.push({ line, casing });
            drawnSegments.add(`${start.toString()}-${end.toString()}`);
        }

        features.forEach((feature) => {
            const point = feature.geometry.coordinates.slice().reverse();
            const color = CONFIG.colors[feature.properties.transport_mode] || CONFIG.colors.train;
            L.circleMarker(point, { radius: 8, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9 })
                .addTo(map).bindPopup(generatePopupContent(feature.properties));
        });

        const startNode = features[0];
        const nextNode = features[1];
        const startPoint = startNode.geometry.coordinates.slice().reverse();
        previousBearing = nextNode ? calculateBearing(startNode.geometry.coordinates, nextNode.geometry.coordinates) : 0;
        movingMarker = L.marker(startPoint, { icon: createDirectionalIcon(startNode.properties.transport_mode || 'train', previousBearing) }).addTo(map);

        timelineSlider.max = features.length - 1;
        timelineSlider.disabled = false;
        updateUIState();
        
        map.flyTo(startPoint, 6, { duration: 2.5 });
        setTimeout(() => { if (isAnimating) playAnimation(); }, 2800);
    }

    // =================================================================
    // 6. 动画核心
    // =================================================================
    function startAnimation() {
        if (currentSegmentIndex >= trajectoryData.length - 1) {
            handleJourneyEnd();
            return;
        }

        if (currentSegmentIndex > 0) updatePathStyle(pathLayers[currentSegmentIndex - 1], 'visited');
        updatePathStyle(pathLayers[currentSegmentIndex], 'current');

        const startNode = trajectoryData[currentSegmentIndex];
        const endNode = trajectoryData[currentSegmentIndex + 1];
        const bearing = calculateBearing(startNode.geometry.coordinates, endNode.geometry.coordinates);
        const transportType = endNode.properties.transport_mode || 'train';

        map.flyToBounds(L.latLngBounds([startNode.geometry.coordinates.slice().reverse(), endNode.geometry.coordinates.slice().reverse()]), { 
            padding: [100, 100], duration: 1, maxZoom: 10
        });

        const duration = CONFIG.animationBaseDuration / animationSpeed;
        let startTime = null;

        function animate(currentTime) {
            if (!isAnimating) return;
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);

            if (progress < 1) {
                const pathPoints = pathLayers[currentSegmentIndex].line.getLatLngs();
                const pointIndex = Math.floor(progress * (pathPoints.length - 1));
                const currentLatLng = pathPoints[Math.min(pointIndex, pathPoints.length - 1)];
                movingMarker.setIcon(createDirectionalIcon(transportType, interpolateBearing(previousBearing, bearing, progress)));
                movingMarker.setLatLng(currentLatLng);
                animationFrameId = requestAnimationFrame(animate);
            } else {
                movingMarker.setLatLng(L.latLng(endNode.geometry.coordinates.slice().reverse()));
                movingMarker.setIcon(createDirectionalIcon(transportType, bearing));
                previousBearing = bearing;
                currentSegmentIndex++;
                updateUIState();
                movingMarker.bindPopup(generatePopupContent(endNode.properties), { autoClose: true, closeOnClick: false }).openPopup();
                setTimeout(() => {
                    movingMarker.closePopup();
                    if (isAnimating) startAnimation();
                }, Math.max(1000, 2000 / animationSpeed));
            }
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    function handleJourneyEnd() {
        pauseAnimation();
        movingMarker.setOpacity(0);
        journeyEndOverlay.classList.add('visible');
        if (currentSegmentIndex > 0) updatePathStyle(pathLayers[currentSegmentIndex - 1], 'visited');
        L.marker(trajectoryData[trajectoryData.length - 1].geometry.coordinates.slice().reverse(), {
            icon: L.divIcon({ className: 'pulsing-marker', iconSize: [24,24] })
        }).addTo(map);

        if(allTrajectoryPoints.length > 0) {
            map.flyToBounds(L.latLngBounds(allTrajectoryPoints), { padding: [50, 50], duration: 2 });
        }
    }

    // =================================================================
    // 7. UI 控制与更新
    // =================================================================
    function playAnimation() { isAnimating = true; playPauseBtn.innerHTML = '⏸️'; startAnimation(); }
    function pauseAnimation() { isAnimating = false; playPauseBtn.innerHTML = '▶️'; if (animationFrameId) cancelAnimationFrame(animationFrameId); }
    function handlePlayPause() { 
        if (isAnimating) pauseAnimation();
        else { currentSegmentIndex >= trajectoryData.length - 1 ? resetAnimation() : playAnimation(); }
    }

    function setupSpeedControls() {
        speedMenu.innerHTML = '';
        CONFIG.speeds.forEach((speed, index) => {
            const btn = document.createElement('button');
            btn.textContent = CONFIG.speedLabels[index];
            btn.dataset.index = index;
            if (index === currentSpeedIndex) btn.classList.add('active');
            speedMenu.appendChild(btn);
        });
    }

    function handleSpeedChange(index) {
        currentSpeedIndex = index;
        animationSpeed = CONFIG.speeds[currentSpeedIndex];
        speedBtn.textContent = CONFIG.speedLabels[currentSpeedIndex];
        
        const buttons = speedMenu.querySelectorAll('button');
        buttons.forEach(btn => btn.classList.remove('active'));
        buttons[index].classList.add('active');
        
        speedMenu.classList.remove('visible');
    }

    function resetAnimation() {
        pauseAnimation();
        currentSegmentIndex = 0;
        movingMarker.setOpacity(1);
        journeyEndOverlay.classList.remove('visible');
        map.eachLayer(layer => { if (layer.options.icon?.options.className === 'pulsing-marker') map.removeLayer(layer); });
        pathLayers.forEach(layer => updatePathStyle(layer, 'default'));
        
        if (trajectoryData.length > 0) {
            const startNode = trajectoryData[0];
            previousBearing = trajectoryData[1] ? calculateBearing(startNode.geometry.coordinates, trajectoryData[1].geometry.coordinates) : 0;
            movingMarker.setLatLng(startNode.geometry.coordinates.slice().reverse()).setIcon(createDirectionalIcon(startNode.properties.transport_mode || 'train', previousBearing));
            map.flyTo([34.5, 108.9], 4, { duration: 1.5 });
            updateUIState();
        }
    }
    
    function jumpToStep(index) {
        pauseAnimation();
        currentSegmentIndex = index;
        const targetNode = trajectoryData[index];
        if (!targetNode) return;
        const transportType = targetNode.properties.transport_mode || 'train';
        let bearing = previousBearing;
        if (index < trajectoryData.length - 1) bearing = calculateBearing(targetNode.geometry.coordinates, trajectoryData[index + 1].geometry.coordinates);
        else if (index > 0) bearing = calculateBearing(trajectoryData[index - 1].geometry.coordinates, targetNode.geometry.coordinates);
        previousBearing = bearing;
        movingMarker.setLatLng(targetNode.geometry.coordinates.slice().reverse()).setIcon(createDirectionalIcon(transportType, bearing));
        map.flyTo(targetNode.geometry.coordinates.slice().reverse(), Math.max(map.getZoom(), 6), { duration: 1 });
        updateUIState();
        updateAllPathStyles();
    }

    function updateUIState() {
        timelineSlider.value = currentSegmentIndex;
        updateSliderFill(timelineSlider); 
        updateInfoList(currentSegmentIndex);
        calculateAndDisplayStats(trajectoryData, false);
    }

    function calculateAndDisplayStats(features, withAnimation) {
        stats.totalLocations = features.length;
        stats.transportModes.clear();
        if (features.length > 0) {
            const firstYear = parseInt(features[0].properties.时间段?.split('.')[0] || new Date().getFullYear());
            stats.totalYears = new Date().getFullYear() - firstYear;
        }
        features.forEach(f => { if (f.properties.transport_mode) stats.transportModes.add(f.properties.transport_mode); });
        if (withAnimation) {
            animateValue(document.getElementById('total-locations'), 0, stats.totalLocations, 1000);
            animateValue(document.getElementById('total-years'), 0, stats.totalYears, 1000, ' 年');
            animateValue(document.getElementById('transport-modes'), 0, stats.transportModes.size, 1000);
        } else {
            document.getElementById('total-locations').textContent = stats.totalLocations;
            document.getElementById('total-years').textContent = stats.totalYears + ' 年';
            document.getElementById('transport-modes').textContent = stats.transportModes.size;
        }
        document.getElementById('current-progress').textContent = `${Math.round((currentSegmentIndex / Math.max(1, trajectoryData.length - 1)) * 100)}%`;
    }
    
    function updateAllPathStyles() {
        pathLayers.forEach((layer, i) => updatePathStyle(layer, i < currentSegmentIndex ? 'visited' : 'default'));
    }
    
    function updatePathStyle(layer, state) {
        const styles = {
            default: { color: CONFIG.colors.pathDefault, weight: 3, opacity: 0.7, className: '' },
            visited: { color: CONFIG.colors.pathVisited, weight: 3, opacity: 0.8, className: '' },
            current: { color: CONFIG.colors.pathCurrent, weight: 4, opacity: 1, className: 'animated-path' }
        };
        layer.line.setStyle(styles[state]);
        layer.casing.setStyle({ opacity: { default: 0.15, visited: 0.2, current: 0.3 }[state] });
    }

    function updateInfoList(activeIndex) {
        infoDisplay.innerHTML = '';
        trajectoryData.forEach((feature, i) => {
            const { 时间段, 地点, 事件, transport_mode } = feature.properties;
            const item = document.createElement('div');
            item.className = 'info-item';
            item.dataset.index = i;
            if (i < activeIndex) item.classList.add('visited');
            else if (i === activeIndex) item.classList.add('current');
            const color = CONFIG.colors[transport_mode] || CONFIG.colors.train;
            item.innerHTML = `<span class="transport-indicator" style="background-color: ${color}"></span> <b>${i + 1}:</b> ${时间段 || ''}<br><strong>${地点 || ''}</strong><br>${事件 || ''}`;
            infoDisplay.appendChild(item);
        });
        const currentItem = infoDisplay.querySelector('.current');
        if (currentItem && !isAnimating) {
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function generatePopupContent(props) {
        const type = props.transport_mode || 'train';
        const color = CONFIG.colors[type];
        const names = { plane: '✈️ 飞机', train: '🚄 火车', bus: '🚌 巴士', bicycle: '🚴 自行车', walk: '🚶 步行' };
        return `<div style="min-width: 200px; font-family: var(--font-family);"><div style="display: flex; align-items: center; margin-bottom: 12px; padding: 8px; background: ${color}15; border-radius: 6px;"><span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span><strong style="color: ${color};">${names[type]}</strong></div><div style="line-height: 1.6;"><div style="margin-bottom: 8px;"><strong>📅 时间:</strong> ${props.时间段 || '未知'}</div><div style="margin-bottom: 8px;"><strong>📍 地点:</strong> ${props.地点 || '未知'}</div><div><strong>🎯 事件:</strong> ${props.事件 || '未知'}</div></div></div>`;
    }

    function updateSliderFill(slider) {
        const percentage = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.background = `linear-gradient(90deg, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%)`;
    }
    
    // =================================================================
    // 8. 事件监听
    // =================================================================
    playPauseBtn.addEventListener('click', handlePlayPause);
    resetBtn.addEventListener('click', resetAnimation);
    timelineSlider.addEventListener('input', (e) => jumpToStep(parseInt(e.target.value, 10)));
    infoDisplay.addEventListener('click', (e) => {
        const item = e.target.closest('.info-item');
        if (item) jumpToStep(parseInt(item.dataset.index, 10));
    });
    
    speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speedMenu.classList.toggle('visible');
    });
    speedMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) handleSpeedChange(parseInt(btn.dataset.index));
    });
    
    document.addEventListener('click', (e) => {
        if (!speedBtn.contains(e.target) && !speedMenu.contains(e.target)) {
            speedMenu.classList.remove('visible');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') { e.preventDefault(); handlePlayPause(); }
        if (e.key.toLowerCase() === 'r') resetAnimation();
    });

    // =================================================================
    // 9. 启动
    // =================================================================
    document.addEventListener('DOMContentLoaded', () => {
        setupSpeedControls();
        setTimeout(loadTrajectoryData, 300);
    });

})();