function getTrianglesFromSurfaceData(vertices, indices) {
    const triangles = [];
    for (let i = 0; i < indices.length; i += 3) {
        const v0 = vertices[indices[i]];
        const v1 = vertices[indices[i + 1]];
        const v2 = vertices[indices[i + 2]];
        triangles.push([v0, v1, v2]);
    }
    return triangles;
}

function getRayFromMouse(ndcX, ndcY, projectionMatrix, viewMatrix) {
    console.log("=== Ray Calculation Debug (MV.js Style) ===");

    // 1. Clip Space 좌표 (배열로 직접 정의)
    const clipCoords = [ndcX, ndcY, -1.0, 1.0];

    // 2. Clip → Eye (camera) space
    const invProj = inverse(projectionMatrix);
    if (!invProj) throw "Invalid inverse projection matrix";

    let eyeCoords = mult(invProj, clipCoords); // 문제 부분
    eyeCoords[2] = -1.0;
    eyeCoords[3] = 0.0;

    // 3. Eye → World space
    const invView = inverse(viewMatrix);
    if (!invView) throw "Invalid inverse view matrix";

    const worldDir4 = mult(invView, eyeCoords);
    const direction = normalize(vec3(worldDir4[0], worldDir4[1], worldDir4[2]));

    // 4. camera world position (translation part of invView matrix)
    const cameraWorldPos = vec3(invView[0][3], invView[1][3], invView[2][3]);

    console.log("Camera world pos:", cameraWorldPos);
    console.log("Ray direction:", direction);
    console.log("=== End Debug ===");

    return {
        origin: cameraWorldPos,
        direction: direction
    };
}
