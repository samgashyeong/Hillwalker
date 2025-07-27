// 애니메이션 경로 저장 변수
let startUV = { u: 0.5, v: 0.5 };
let endUV = { u: 0.5, v: 0.5 };

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

    // 애니메이션 진행
    animationProgress += animationSpeed;

    if (animationProgress >= 1.0) {
        // 애니메이션 완료
        animationProgress = 1.0;
        isAnimating = false;
        currentMarkerPosition = [...targetMarkerPosition];
        createMarkerAtPoint(currentMarkerPosition);
    } else {
        // UV 공간에서 직접 보간하여 곡면상의 점 계산
        const surfacePoint = calculateUVInterpolationPath(animationProgress);
        currentMarkerPosition = [...surfacePoint];
        createMarkerAtPoint(currentMarkerPosition);
    }

    updateSurface();
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