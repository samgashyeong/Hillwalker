// 애니메이션 경로 저장 변수
let startUV = { u: 0.5, v: 0.5 };
let endUV = { u: 0.5, v: 0.5 };
let maxSlopeThreshold = 0.5; // 최대 허용 기울기 (조정 가능)

function startMarkerAnimation(userClickPoint) {
    isAnimating = true;
    animationProgress = 0;

    // UV 계산
    startUV = findUVFromPoint(currentMarkerPosition);
    endUV = findUVFromPoint(userClickPoint);

    // 실제 이동할 좌표 계산
    targetMarkerPosition = bezierSurface(endUV.u, endUV.v, controlPoints);

    // 거리 기반으로 애니메이션 속도 설정
    const distance = calculateDistance(currentMarkerPosition, targetMarkerPosition);
    const desiredSpeedPerFrame = 0.02; // 프레임당 0.02 단위만큼 이동하게 만들기
    animationSpeed = desiredSpeedPerFrame / distance;

    console.log("Animation speed set to:", animationSpeed);
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

    // 다음 애니메이션 진행값 계산
    const nextProgress = animationProgress + animationSpeed;

    if (nextProgress >= 1.0) {
        // 애니메이션 완료
        animationProgress = 1.0;
        isAnimating = false;
        currentMarkerPosition = [...targetMarkerPosition];
        createMarkerAtPoint(currentMarkerPosition);
    } else {
        // 다음 위치 계산
        const nextSurfacePoint = calculateUVInterpolationPath(nextProgress);
        
        // 곡률 변화량 체크
        if (checkSlopeConstraint(currentMarkerPosition, nextSurfacePoint)) {
            // 기울기가 허용 범위 내이면 이동
            animationProgress = nextProgress;
            currentMarkerPosition = [...nextSurfacePoint];
            createMarkerAtPoint(currentMarkerPosition);
        } else {
            // 기울기가 너무 크면 애니메이션 중단
            console.log("❌ Animation stopped: Slope too steep!");
            isAnimating = false;
        }
    }

    updateSurface();
}

// 기울기 제약 조건 체크 함수
function checkSlopeConstraint(currentPos, nextPos) {
    // 두 점 사이의 거리와 높이 차이 계산
    const horizontalDistance = Math.sqrt(
        Math.pow(nextPos[0] - currentPos[0], 2) + 
        Math.pow(nextPos[2] - currentPos[2], 2)
    );
    const verticalDistance = Math.abs(nextPos[1] - currentPos[1]);
    
    // 기울기 계산 (수직거리 / 수평거리)
    if (horizontalDistance === 0) return true; // 수평거리가 0이면 이동 허용
    
    const slope = verticalDistance / horizontalDistance;
    
    console.log(`Slope check: ${slope.toFixed(3)} (threshold: ${maxSlopeThreshold})`);
    
    return slope <= maxSlopeThreshold;
}

// UV 공간에서 직접 보간하여 곡면상의 점 계산
function calculateUVInterpolationPath(progress) {
    // UV 좌표를 선형 보간
    const currentU = lerp(startUV.u, endUV.u, progress);
    const currentV = lerp(startUV.v, endUV.v, progress);
    
    // 보간된 UV 좌표로 베지어 곡면상의 점 계산
    const surfacePoint = bezierSurface(currentU, currentV, controlPoints);
    
    return surfacePoint;
}

// 3D 점에서 가장 가까운 UV 좌표 찾기 (더 높은 해상도로 정확도 향상)
function findUVFromPoint(point) {
    let closestU = 0.5;
    let closestV = 0.5;
    let minDistance = Infinity;
    
    // 그리드 서치로 가장 가까운 UV 찾기
    const resolution = 40; // 해상도를 높여서 더 정확한 UV 찾기
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

// 두 점 사이의 거리 계산
function calculateDistance(point1, point2) {
    return Math.sqrt(
        Math.pow(point2[0] - point1[0], 2) +
        Math.pow(point2[1] - point1[1], 2) +
        Math.pow(point2[2] - point1[2], 2)
    );
}