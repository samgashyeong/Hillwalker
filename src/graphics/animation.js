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

// 기울기 제약 조건 체크 함수 (미분 기반)
function checkSlopeConstraint(currentPos, nextPos) {
    // 현재 위치와 다음 위치의 UV 좌표 계산
    const currentUV = findUVFromPoint(currentPos);
    const nextUV = findUVFromPoint(nextPos);
    
    // 두 지점 사이에서 여러 점을 샘플링하여 기울기 체크
    const samples = 5; // 중간에 5개 지점 체크
    
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const sampleU = lerp(currentUV.u, nextUV.u, t);
        const sampleV = lerp(currentUV.v, nextUV.v, t);
        
        // 해당 UV 지점에서 곡면의 기울기 계산 (미분 사용)
        const slope = calculateSurfaceSlope(sampleU, sampleV);
        
        if (slope > maxSlopeThreshold) {
            console.log(`❌ Slope too steep at sample ${i}: ${slope.toFixed(3)} (threshold: ${maxSlopeThreshold})`);
            return false;
        }
    }
    
    return true;
}

// 베지어 곡면의 특정 UV 지점에서 실제 기울기 계산 (미분 사용)
function calculateSurfaceSlope(u, v) {
    const epsilon = 0.001; // 미분을 위한 작은 값
    
    // 현재 점
    const currentPoint = bezierSurface(u, v, controlPoints);
    
    // U 방향 편미분 근사 (∂S/∂u)
    const uPoint = bezierSurface(Math.min(u + epsilon, 1.0), v, controlPoints);
    const duVector = [
        (uPoint[0] - currentPoint[0]) / epsilon,
        (uPoint[1] - currentPoint[1]) / epsilon,
        (uPoint[2] - currentPoint[2]) / epsilon
    ];
    
    // V 방향 편미분 근사 (∂S/∂v)
    const vPoint = bezierSurface(u, Math.min(v + epsilon, 1.0), controlPoints);
    const dvVector = [
        (vPoint[0] - currentPoint[0]) / epsilon,
        (vPoint[1] - currentPoint[1]) / epsilon,
        (vPoint[2] - currentPoint[2]) / epsilon
    ];
    
    // 외적으로 법선 벡터 계산 (du × dv)
    const normal = [
        duVector[1] * dvVector[2] - duVector[2] * dvVector[1],
        duVector[2] * dvVector[0] - duVector[0] * dvVector[2],
        duVector[0] * dvVector[1] - duVector[1] * dvVector[0]
    ];
    
    // 법선 벡터 정규화
    const normalLength = Math.sqrt(normal[0]*normal[0] + normal[1]*normal[1] + normal[2]*normal[2]);
    const normalizedNormal = [
        normal[0] / normalLength,
        normal[1] / normalLength,
        normal[2] / normalLength
    ];
    
    // Y축(위쪽)과 법선 벡터 사이의 각도로 기울기 계산
    const upVector = [0, 1, 0];
    const dotProduct = normalizedNormal[0] * upVector[0] + 
                      normalizedNormal[1] * upVector[1] + 
                      normalizedNormal[2] * upVector[2];
    
    // 기울기 = tan(각도) = sin(각도) / cos(각도)
    // cos(각도) = dotProduct이므로
    const cosAngle = Math.abs(dotProduct);
    const sinAngle = Math.sqrt(1 - cosAngle * cosAngle);
    const slope = sinAngle / cosAngle; // tan(각도)
    
    return slope;
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