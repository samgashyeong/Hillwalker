// 애니메이션 경로 저장 변수
let precomputedPath = [];
let pathLength = 0;

// 마커 애니메이션 시작 함수
function startMarkerAnimation(targetPoint) {
    targetMarkerPosition = [...targetPoint];
    isAnimating = true;
    animationProgress = 0;
    
    // 시작 시 경로를 미리 계산해서 저장
    precomputedPath = calculateOptimalSurfacePath(currentMarkerPosition, targetMarkerPosition);
    pathLength = calculatePathLength(precomputedPath);
    
    console.log("Animation started from:", currentMarkerPosition, "to:", targetMarkerPosition);
    console.log("Path calculated with", precomputedPath.length, "points, length:", pathLength);
}


// 애니메이션 루프 함수
function startAnimationLoop() {
    function animate() {
        if (isAnimating) {
            updateMarkerAnimation();
        }
        requestAnimationFrame(animate);
    }
    animate();
}

function updateMarkerAnimation() {
    if (!isAnimating) return;

    // 애니메이션 진행 (더 부드러운 속도)
    animationProgress += animationSpeed;

    if (animationProgress >= 1.0) {
        // 애니메이션 완료
        animationProgress = 1.0;
        isAnimating = false;
        currentMarkerPosition = [...targetMarkerPosition];
        createMarkerAtPoint(currentMarkerPosition);
    } else {
        // 미리 계산된 경로를 따라 이동
        const surfacePoint = getPointOnPrecomputedPath(animationProgress);
        currentMarkerPosition = [...surfacePoint];
        createMarkerAtPoint(currentMarkerPosition);
    }

    updateSurface();
}

// 미리 계산된 경로에서 진행률에 따른 점 가져오기
function getPointOnPrecomputedPath(progress) {
    if (precomputedPath.length === 0) return currentMarkerPosition;
    
    // Ease-out 곡선 적용 (더 자연스러운 감속)
    const easeProgress = easeOutCubic(progress);
    
    // 경로 상의 정확한 인덱스 계산
    const totalIndex = easeProgress * (precomputedPath.length - 1);
    const index = Math.floor(totalIndex);
    const fraction = totalIndex - index;
    
    if (index >= precomputedPath.length - 1) {
        return precomputedPath[precomputedPath.length - 1];
    }
    
    // 부드러운 보간
    const currentPoint = precomputedPath[index];
    const nextPoint = precomputedPath[index + 1];
    
    return [
        lerp(currentPoint[0], nextPoint[0], fraction),
        lerp(currentPoint[1], nextPoint[1], fraction),
        lerp(currentPoint[2], nextPoint[2], fraction)
    ];
}

// 개선된 곡면 경로 계산 (한 번만 계산)
function calculateOptimalSurfacePath(startPoint, endPoint) {
    const startUV = findUVFromPoint(startPoint);
    const endUV = findUVFromPoint(endPoint);
    const path = [];
    
    // 더 많은 세그먼트로 부드러운 경로
    const segments = 50;
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        
        // 자연스러운 곡선 경로 (Catmull-Rom spline 스타일)
        let u, v;
        
        if (Math.abs(startUV.u - endUV.u) > Math.abs(startUV.v - endUV.v)) {
            // U 방향이 더 긴 경우 - U를 주축으로
            u = smoothStep(startUV.u, endUV.u, t);
            v = smoothStep(startUV.v, endUV.v, t) + 
                0.05 * Math.sin(Math.PI * t) * Math.abs(endUV.u - startUV.u);
        } else {
            // V 방향이 더 긴 경우 - V를 주축으로
            v = smoothStep(startUV.v, endUV.v, t);
            u = smoothStep(startUV.u, endUV.u, t) + 
                0.05 * Math.sin(Math.PI * t) * Math.abs(endUV.v - startUV.v);
        }
        
        // UV 좌표를 [0,1] 범위로 클램핑
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));
        
        const surfacePoint = bezierSurface(u, v, controlPoints);
        path.push(surfacePoint);
    }
    
    return path;
}

// 부드러운 보간 함수 (smoothstep)
function smoothStep(start, end, t) {
    const smoothT = t * t * (3 - 2 * t);
    return start + (end - start) * smoothT;
}

// Ease-out cubic 함수
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// 경로의 총 길이 계산
function calculatePathLength(path) {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i-1][0];
        const dy = path[i][1] - path[i-1][1];
        const dz = path[i][2] - path[i-1][2];
        length += Math.sqrt(dx*dx + dy*dy + dz*dz);
    }
    return length;
}
// 3D 점에서 가장 가까운 UV 좌표 찾기 (근사값)
function findUVFromPoint(point) {
    let closestU = 0.5;
    let closestV = 0.5;
    let minDistance = Infinity;
    
    // 그리드 서치로 가장 가까운 UV 찾기
    const resolution = 50;
    for (let i = 0; i <= resolution; i++) {
        const u = i / resolution;
        for (let j = 0; j <= resolution; j++) {
            const v = j / resolution;
            const surfacePoint = bezierSurface(u, v, controlPoints);
            
            const distance = Math.sqrt(
                Math.pow(point[0] - surfacePoint[0], 2) +
                Math.pow(point[1] - surfacePoint[1], 2) +
                Math.pow(point[2] - surfacePoint[2], 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestU = u;
                closestV = v;
            }
        }
    }
    
    return { u: closestU, v: closestV };
}

// 선형 보간 함수
function lerp(start, end, progress) {
    return start + (end - start) * progress;
}