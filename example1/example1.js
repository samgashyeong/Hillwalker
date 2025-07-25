"use strict";

var gl, program;
var projectionMatrix, modelViewMatrix;
var projectionMatrixLoc, modelViewMatrixLoc;


var controlPoints = [
    [[-1, 0, -1], [-1, 0, -0.33], [-1, 0, 0.33], [-1, 0, 1]],
    [[-0.33, 0, -1], [-0.33, 0, -0.33], [-0.33, 0, 0.33], [-0.33, 0, 1]],
    [[0.33, 0, -1], [0.33, 0, -0.33], [0.33, 0, 0.33], [0.33, 0, 1]],
    [[1, 0, -1], [1, 0, -0.33], [1, 0, 0.33], [1, 0, 1]]
];


// WebGL 버퍼들을 재사용하기 위한 변수들
let surfaceVBuffer, surfaceCBuffer, surfaceIBuffer;
let markerVBuffer, markerCBuffer, markerIBuffer;
let rayVBuffer, rayCBuffer;

let surfaceVertices = [];
let surfaceIndices = [];

// 마커 관련 변수
let markerVertices = [];
let markerIndices = [];
let hasMarker = false;

// Ray 시각화 관련 변수
let rayVertices = [];
let hasRay = false;

// 마커 애니메이션 관련 변수
let currentMarkerPosition = [0, 0, 0];
let targetMarkerPosition = [0, 0, 0];
let isAnimating = false;
let animationProgress = 0;
let animationSpeed = 0.1; // 애니메이션 속도

// 카메라 관련 변수
var cameraPosition = [0, 2, 2]; // 초기 카메라 위치 - Y를 2로 올려서 비스듬한 각도로
var cameraTarget = [0, 0, 0];   // 카메라가 바라보는 대상
var cameraUp = [0, 1, 0];       // 카메라의 상단 방향

window.onload = function init() {
    var canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.9, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Load shaders and initialize attribute buffers
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Set up projection and model-view matrices
    projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 10.0);
    modelViewMatrix = lookAt(cameraPosition, cameraTarget, cameraUp);

    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");

    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

    updateSurface();


    document.querySelectorAll(".slider").forEach(slider => {
        slider.addEventListener("input", () => {
            updateControlPoints();
            updateCameraPosition();
            // updateSurface는 updateControlPoints에서 이미 호출됨 - 중복 제거
        });
    });

    // 카메라 컨트롤 슬라이더 이벤트 리스너 추가
    document.getElementById("cameraX").addEventListener("input", updateCameraPosition);
    document.getElementById("cameraY").addEventListener("input", updateCameraPosition);
    document.getElementById("cameraZ").addEventListener("input", updateCameraPosition);

    // 초기 렌더링
    updateSurface();

    // 초기 마커를 곡면 중앙에 생성
    createInitialMarker();
    
    // 최종 렌더링 (중복 updateSurface 제거)
    updateSurface();

    // 마우스 클릭 이벤트 리스너 추가 (ray casting)
    canvas.addEventListener("click", handleCanvasClick);
};


function updateControlPoints() {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            controlPoints[i][j] = [
                parseFloat(document.getElementById(`p${i}${j}x`).value),
                parseFloat(document.getElementById(`p${i}${j}y`).value),
                parseFloat(document.getElementById(`p${i}${j}z`).value)
            ];
        }
    }
    updateSurface();
}

function updateCameraPosition() {
    // 슬라이더 값을 읽어와 카메라 위치 업데이트
    cameraPosition[0] = parseFloat(document.getElementById("cameraX").value);
    cameraPosition[1] = parseFloat(document.getElementById("cameraY").value);
    cameraPosition[2] = parseFloat(document.getElementById("cameraZ").value);

    // 카메라의 모델뷰 행렬 업데이트
    modelViewMatrix = lookAt(cameraPosition, cameraTarget, cameraUp);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

    // 곡면 다시 렌더링
    updateSurface();
}

function bezierSurface(u, v, controlPoints) {
    function bernstein(t, i) {
        const binomial = [1, 3, 3, 1];
        return binomial[i] * Math.pow(1 - t, 3 - i) * Math.pow(t, i);
    }

    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const bU = bernstein(u, i);
            const bV = bernstein(v, j);
            x += bU * bV * controlPoints[i][j][0];
            y += bU * bV * controlPoints[i][j][1];
            z += bU * bV * controlPoints[i][j][2];
        }
    }
    return [x, y, z];
}

function generateBezierSurface(controlPoints, resolution) {
    const vertices = [];
    const colors = []; // 색상 배열 추가
    const indices = [];

    for (let i = 0; i <= resolution; i++) {
        const u = i / resolution;
        for (let j = 0; j <= resolution; j++) {
            const v = j / resolution;
            vertices.push(bezierSurface(u, v, controlPoints));

            // 정점의 색상을 u, v 값에 따라 다르게 설정
            colors.push([u, v, 1.0 - u - v, 1.0]); // RGBA 색상
        }
    }

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const topLeft = i * (resolution + 1) + j;
            const topRight = topLeft + 1;
            const bottomLeft = topLeft + (resolution + 1);
            const bottomRight = bottomLeft + 1;

            indices.push(topLeft, bottomLeft, topRight);
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }

    return { vertices, colors, indices };
}

function updateSurface() {
    const { vertices, colors, indices } = generateBezierSurface(controlPoints, 20);

    surfaceVertices = vertices;
    surfaceIndices = indices;
    
    // 버퍼가 없으면 생성, 있으면 재사용
    if (!surfaceVBuffer) surfaceVBuffer = gl.createBuffer();
    if (!surfaceCBuffer) surfaceCBuffer = gl.createBuffer();
    if (!surfaceIBuffer) surfaceIBuffer = gl.createBuffer();
    
    // Load vertex data into GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, surfaceVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Load color data into GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, surfaceCBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    const vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // Load index data into GPU
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, surfaceIBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // 렌더링
    render(indices.length);
    
    // Ray가 있으면 ray도 렌더링
    if (hasRay) {
        renderRay();
    }
    
    // 마커가 있으면 마커도 렌더링
    if (hasMarker) {
        renderMarker();
    }
}

function render(indexCount) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
}

function renderMarker() {
    if (!hasMarker) return;
    
    // 마커용 검은색 색상 배열 생성 (8개 꼭짓점)
    const markerColors = [
        [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0]
    ];
    
    // 버퍼 재사용
    if (!markerVBuffer) markerVBuffer = gl.createBuffer();
    if (!markerCBuffer) markerCBuffer = gl.createBuffer();
    if (!markerIBuffer) markerIBuffer = gl.createBuffer();
    
    // 마커 꼭짓점 버퍼 설정
    gl.bindBuffer(gl.ARRAY_BUFFER, markerVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(markerVertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // 마커 색상 버퍼 설정
    gl.bindBuffer(gl.ARRAY_BUFFER, markerCBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(markerColors), gl.STATIC_DRAW);

    const vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // 마커 인덱스 버퍼 설정
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, markerIBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(markerIndices), gl.STATIC_DRAW);

    // 마커 렌더링
    gl.drawElements(gl.TRIANGLES, markerIndices.length, gl.UNSIGNED_SHORT, 0);
}
function handleCanvasClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log("=== Mouse Click Debug ===");
    console.log("Raw mouse coordinates:", event.clientX, event.clientY);
    console.log("Canvas rect:", rect);
    console.log("Relative mouse coordinates:", x, y);
    console.log("Canvas size:", canvas.width, canvas.height);

    // Convert mouse coordinates to normalized device coordinates
    const ndcX = (x / canvas.width) * 2 - 1;
    const ndcY = 1 - (y / canvas.height) * 2; // Y축 반전

    console.log("Calculated NDC:", ndcX, ndcY);
    console.log("=== End Mouse Debug ===");

    modelViewMatrix = lookAt(cameraPosition, cameraTarget, cameraUp);
    const ray = getRayFromMouse(ndcX, ndcY, projectionMatrix, modelViewMatrix);

    // Ray 시각화를 위해 저장
    createRayVisualization(ray.origin, ray.direction);

    const triangles = getTrianglesFromSurfaceData(surfaceVertices, surfaceIndices);
    let closest = null;

    for (const tri of triangles) {
        const hit = rayIntersectsTriangle(ray.origin, ray.direction, ...tri);
        if (hit && (!closest || hit.distance < closest.distance)) {
            closest = hit;
        }
    }

    if (closest) {
        console.log("✅ HIT! Intersection at:", closest.point);
        
        // 마커를 바로 해당 위치로 이동
        currentMarkerPosition = [...closest.point];
        targetMarkerPosition = [...closest.point];
        createMarkerAtPoint(closest.point);
    } else {
        console.log("❌ No intersection found");
    }
    
    updateSurface(); // 항상 화면 업데이트
}


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

// Möller-Trumbore ray-triangle intersection algorithm
function rayIntersectsTriangle(rayOrigin, rayDirection, v0, v1, v2) {
    const EPSILON = 0.0000001;
    
    const edge1 = subtract(v1, v0);
    const edge2 = subtract(v2, v0);
    const h = cross(rayDirection, edge2);
    const a = dot(edge1, h);
    
    if (a > -EPSILON && a < EPSILON) return null; // Ray parallel to triangle
    
    const f = 1.0 / a;
    const s = subtract(rayOrigin, v0);
    const u = f * dot(s, h);
    
    if (u < 0.0 || u > 1.0) return null;
    
    const q = cross(s, edge1);
    const v = f * dot(rayDirection, q);
    
    if (v < 0.0 || u + v > 1.0) return null;
    
    const t = f * dot(edge2, q);
    
    if (t > EPSILON) {
        const hitPoint = [
            rayOrigin[0] + rayDirection[0] * t,
            rayOrigin[1] + rayDirection[1] * t,
            rayOrigin[2] + rayDirection[2] * t
        ];
        return { point: hitPoint, distance: t };
    }
    
    return null;
}


// 마커 생성 함수
function createMarkerAtPoint(point) {
    const size = 0.08;
    const halfSize = size / 2;
    
    // 정육면체의 8개 꼭짓점
    markerVertices = [
        // 앞면 (z + halfSize)
        [point[0] - halfSize, point[1] - halfSize, point[2] + halfSize], // 0: 왼쪽 아래 앞
        [point[0] + halfSize, point[1] - halfSize, point[2] + halfSize], // 1: 오른쪽 아래 앞
        [point[0] + halfSize, point[1] + halfSize, point[2] + halfSize], // 2: 오른쪽 위 앞
        [point[0] - halfSize, point[1] + halfSize, point[2] + halfSize], // 3: 왼쪽 위 앞
        
        // 뒷면 (z - halfSize)
        [point[0] - halfSize, point[1] - halfSize, point[2] - halfSize], // 4: 왼쪽 아래 뒤
        [point[0] + halfSize, point[1] - halfSize, point[2] - halfSize], // 5: 오른쪽 아래 뒤
        [point[0] + halfSize, point[1] + halfSize, point[2] - halfSize], // 6: 오른쪽 위 뒤
        [point[0] - halfSize, point[1] + halfSize, point[2] - halfSize]  // 7: 왼쪽 위 뒤
    ];
    
    // 정육면체의 12개 삼각형 (6면 × 2삼각형)
    markerIndices = [
        // 앞면
        0, 1, 2,  0, 2, 3,
        // 뒷면
        4, 6, 5,  4, 7, 6,
        // 왼쪽면
        4, 0, 3,  4, 3, 7,
        // 오른쪽면
        1, 5, 6,  1, 6, 2,
        // 윗면
        3, 2, 6,  3, 6, 7,
        // 아랫면
        4, 5, 1,  4, 1, 0
    ];
    
    hasMarker = true;
}

// Ray 시각화 생성 함수
function createRayVisualization(origin, direction) {
    const rayLength = 5.0; // ray의 길이
    
    // ray의 끝점 계산
    const endPoint = [
        origin[0] + direction[0] * rayLength,
        origin[1] + direction[1] * rayLength,
        origin[2] + direction[2] * rayLength
    ];
    
    // ray를 선으로 표현 (시작점과 끝점)
    rayVertices = [
        origin,    // 시작점
        endPoint   // 끝점
    ];
    
    hasRay = true;
}

// Ray 렌더링 함수
function renderRay() {
    if (!hasRay) return;
    
    // Ray용 빨간색 색상 배열 생성
    const rayColors = [
        [1.0, 0.0, 0.0, 1.0], // 빨간색 - 시작점
        [1.0, 0.0, 0.0, 1.0]  // 빨간색 - 끝점
    ];
    
    // 버퍼 재사용
    if (!rayVBuffer) rayVBuffer = gl.createBuffer();
    if (!rayCBuffer) rayCBuffer = gl.createBuffer();
    
    // Ray 꼭짓점 버퍼 설정
    gl.bindBuffer(gl.ARRAY_BUFFER, rayVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(rayVertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Ray 색상 버퍼 설정
    gl.bindBuffer(gl.ARRAY_BUFFER, rayCBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(rayColors), gl.STATIC_DRAW);

    const vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // Ray를 선으로 렌더링 (인덱스 버퍼 없이 직접 그리기)
    gl.drawArrays(gl.LINES, 0, 2);
}

// 초기 마커 생성 함수
function createInitialMarker() {
    // 베지어 곡면의 중앙점 계산 (u=0.5, v=0.5)
    const centerPoint = bezierSurface(0.5, 0.5, controlPoints);
    
    console.log("Initial marker created at surface center:", centerPoint);
    
    // 현재 마커 위치 설정
    currentMarkerPosition = [...centerPoint];
    targetMarkerPosition = [...centerPoint];
    
    // 중앙점에 마커 생성
    createMarkerAtPoint(centerPoint);
}


