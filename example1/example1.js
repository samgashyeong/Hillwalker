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


let surfaceVertices = [];
let surfaceIndices = [];

// 마커 관련 변수
let markerVertices = [];
let markerIndices = [];
let hasMarker = false;

// Ray 시각화 관련 변수
let rayVertices = [];
let hasRay = false;

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
            updateSurface();
        });
    });

    // 카메라 컨트롤 슬라이더 이벤트 리스너 추가
    document.getElementById("cameraX").addEventListener("input", updateCameraPosition);
    document.getElementById("cameraY").addEventListener("input", updateCameraPosition);
    document.getElementById("cameraZ").addEventListener("input", updateCameraPosition);

    // 초기 렌더링
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
    
    // Load vertex data into GPU
    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Load color data into GPU
    const cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    const vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // Load index data into GPU
    const iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // 먼저 곡면 렌더링
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
    // 마커용 검은색 색상 배열 생성
    const markerColors = [
        [0.0, 0.0, 0.0, 1.0], // 검은색
        [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 0.0, 1.0]
    ];
    
    // 마커 꼭짓점 버퍼 설정
    const markerVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, markerVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(markerVertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // 마커 색상 버퍼 설정
    const markerCBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, markerCBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(markerColors), gl.STATIC_DRAW);

    const vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // 마커 인덱스 버퍼 설정
    const markerIBuffer = gl.createBuffer();
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


// 행렬 * 벡터
function multiplyMatrixAndPoint(m, p) {
    const out = new Array(4).fill(0);
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            out[row] += m[row * 4 + col] * p[col];
        }
    }
    console.log("multiplyMatrixAndPoint result:", out);
    return out;
}

// 정규화 함수
function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
}

function rayIntersectsTriangle(origin, direction, v0, v1, v2) {
    const EPSILON = 0.00001;

    const edge1 = subtract(v1, v0);
    const edge2 = subtract(v2, v0);
    const h = cross(direction, edge2);
    const a = dot(edge1, h);
    if (Math.abs(a) < EPSILON) return null; // 평행함

    const f = 1.0 / a;
    const s = subtract(origin, v0);
    const u = f * dot(s, h);
    if (u < 0.0 || u > 1.0) return null;

    const q = cross(s, edge1);
    const v = f * dot(direction, q);
    if (v < 0.0 || u + v > 1.0) return null;

    const t = f * dot(edge2, q);
    if (t > EPSILON) {
        return {
            point: [
                origin[0] + direction[0] * t,
                origin[1] + direction[1] * t,
                origin[2] + direction[2] * t
            ],
            distance: t
        };
    }

    return null;
}

// 벡터 보조 함수들
function subtract(a, b) {
    if (a.length === 3) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    } else {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
    }
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// 마커 생성 함수
function createMarkerAtPoint(point) {
    const size = 0.08;
    const halfSize = size / 2;
    
    // 정사각형 꼭짓점 (XZ 평면상에서, Y는 교점 높이)
    markerVertices = [
        [point[0] - halfSize, point[1], point[2] - halfSize], // 왼쪽 아래
        [point[0] + halfSize, point[1], point[2] - halfSize], // 오른쪽 아래
        [point[0] + halfSize, point[1], point[2] + halfSize], // 오른쪽 위
        [point[0] - halfSize, point[1], point[2] + halfSize]  // 왼쪽 위
    ];
    
    // 삼각형 인덱스 (두 개의 삼각형으로 사각형 구성)
    markerIndices = [
        0, 1, 2,  // 첫 번째 삼각형
        0, 2, 3   // 두 번째 삼각형
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
    // Ray용 빨간색 색상 배열 생성
    const rayColors = [
        [1.0, 0.0, 0.0, 1.0], // 빨간색 - 시작점
        [1.0, 0.0, 0.0, 1.0]  // 빨간색 - 끝점
    ];
    
    // Ray 꼭짓점 버퍼 설정
    const rayVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rayVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(rayVertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Ray 색상 버퍼 설정
    const rayCBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rayCBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(rayColors), gl.STATIC_DRAW);

    const vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // Ray를 선으로 렌더링 (인덱스 버퍼 없이 직접 그리기)
    gl.drawArrays(gl.LINES, 0, 2);
}