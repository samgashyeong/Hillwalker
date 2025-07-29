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

// 마커 애니메이션 관련 변수
let currentMarkerPosition = [0, 0, 0];
let targetMarkerPosition = [0, 0, 0];
let isAnimating = false;
let animationProgress = 0;
let animationSpeed = 0.01; // 애니메이션 속도

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

    // 기울기 제어 슬라이더 이벤트 리스너 추가
    document.getElementById("slopeThreshold").addEventListener("input", updateSlopeThreshold);

    // 초기 렌더링
    updateSurface();

    // 초기 마커를 곡면 중앙에 생성
    createInitialMarker();
    
    // 마커가 포함된 화면 다시 렌더링
    updateSurface();

    // 애니메이션 루프 시작
    startAnimationLoop();

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

function updateSlopeThreshold() {
    // 슬라이더 값을 읽어와 기울기 임계값 업데이트
    const newThreshold = parseFloat(document.getElementById("slopeThreshold").value);
    maxSlopeThreshold = newThreshold;
    
    // 화면에 현재 값 표시
    document.getElementById("slopeValue").textContent = newThreshold.toFixed(1);
    
    console.log("Slope threshold updated to:", newThreshold);
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
    // 마커용 검은색 색상 배열 생성 (8개 꼭짓점)
    const markerColors = [
        [0.0, 0.0, 0.0, 1.0], // 0: 검은색
        [0.0, 0.0, 0.0, 1.0], // 1: 검은색
        [0.0, 0.0, 0.0, 1.0], // 2: 검은색
        [0.0, 0.0, 0.0, 1.0], // 3: 검은색
        [0.0, 0.0, 0.0, 1.0], // 4: 검은색
        [0.0, 0.0, 0.0, 1.0], // 5: 검은색
        [0.0, 0.0, 0.0, 1.0], // 6: 검은색
        [0.0, 0.0, 0.0, 1.0]  // 7: 검은색
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
        
        // 애니메이션 시작
        startMarkerAnimation(closest.point);
    } else {
        console.log("❌ No intersection found");
    }
    
    updateSurface(); // 항상 화면 업데이트
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


