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
        // 곡면을 따라 이동하는 경로 계산
        const surfacePoint = calculateSurfacePathPoint(animationProgress);
        currentMarkerPosition = [...surfacePoint];
        createMarkerAtPoint(currentMarkerPosition);
    }

    updateSurface();
}

function calculateSurfacePathPoint(progress) {
    // UV 좌표 보간 (선형 보간)
    const startUV = findUVFromPoint(currentMarkerPosition);
    const endUV = findUVFromPoint(targetMarkerPosition);

    const currentU = lerp(startUV.u, endUV.u, progress); // 선형 보간
    const currentV = lerp(startUV.v, endUV.v, progress); // 선형 보간

    // 보간된 UV 좌표로 곡면상의 점 계산
    return bezierSurface(currentU, currentV, controlPoints);
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