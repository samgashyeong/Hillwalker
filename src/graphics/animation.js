// 애니메이션 경로 저장 변수
let precomputedPath = [];
let pathLength = 0;

// 마커 애니메이션 시작 함수
function startMarkerAnimation(targetPoint) {
    targetMarkerPosition = [...targetPoint];
    isAnimating = true;
    animationProgress = 0;
    
    console.log("Animation started from:", currentMarkerPosition, "to:", targetMarkerPosition);
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

    // 애니메이션 진행
    animationProgress += animationSpeed;

    if (animationProgress >= 1.0) {
        // 애니메이션 완료
        animationProgress = 1.0;
        isAnimating = false;
        currentMarkerPosition = [...targetMarkerPosition];
        createMarkerAtPoint(currentMarkerPosition);
    } else {
        // 직선 경로 + 곡면 높이 조정 방식
        const surfacePoint = calculateLinearPathWithSurfaceHeight(animationProgress);
        currentMarkerPosition = [...surfacePoint];
        createMarkerAtPoint(currentMarkerPosition);
    }

    updateSurface();
}

// 미리 계산된 경로에서 진행률에 따른 점 가져오기
function getPointOnPrecomputedPath(progress) {
    if (precomputedPath.length === 0) return currentMarkerPosition;
    
    // 단순 선형 진행 (ease-out 제거)
    const easeProgress = progress;
    
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

function calculateLinearPathWithSurfaceHeight(progress) {
    // 단순 선형 보간으로 XZ 좌표 계산 (smoothStep 제거)
    const x = lerp(currentMarkerPosition[0], targetMarkerPosition[0], progress);
    const z = lerp(currentMarkerPosition[2], targetMarkerPosition[2], progress);

    // (x, z)에 해당하는 곡면의 Y 좌표를 찾기 위해서 가장 가까운 UV를 찾음
    const uv = findUVFromXZ(x, z);
    const surfacePoint = bezierSurface(uv.u, uv.v, controlPoints);
    
    // 높이는 곡면의 Y 좌표로 대체
    const y = surfacePoint[1];

    return [x, y, z];
}

function findUVFromXZ(x, z) {
    let closestU = 0.5, closestV = 0.5;
    let minDistance = Infinity;
    const resolution = 150;

    for (let i = 0; i <= resolution; i++) {
        const u = i / resolution;
        for (let j = 0; j <= resolution; j++) {
            const v = j / resolution;
            const point = bezierSurface(u, v, controlPoints);
            const dx = x - point[0];
            const dz = z - point[2];
            const dist = dx * dx + dz * dz;

            if (dist < minDistance) {
                minDistance = dist;
                closestU = u;
                closestV = v;
            }
        }
    }

    return { u: closestU, v: closestV };
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