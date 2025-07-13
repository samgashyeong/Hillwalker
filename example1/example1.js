"use strict";

var gl, program;
var projectionMatrix, modelViewMatrix;
var projectionMatrixLoc, modelViewMatrixLoc; 


var controlPoints = [
    [[-1, -1, 0], [-1, -0.33, 0], [-1, 0.33, 0], [-1, 1, 0]],
    [[-0.33, -1, 0], [-0.33, -0.33, 0], [-0.33, 0.33, 0], [-0.33, 1, 0]],
    [[0.33, -1, 0], [0.33, -0.33, 0], [0.33, 0.33, 0], [0.33, 1, 0]],
    [[1, -1, 0], [1, -0.33, 0], [1, 0.33, 0], [1, 1, 0]]
];

// 카메라 관련 변수
var cameraPosition = [0, 0, 3]; // 초기 카메라 위치
var cameraTarget = [0, 0, 0];   // 카메라가 바라보는 대상
var cameraUp = [0, 1, 0];       // 카메라의 상단 방향

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); return; }

    // Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.8, 0.9, 1.0, 1.0 );
    gl.enable(gl.DEPTH_TEST);

    // Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

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
    const indices = [];

    for (let i = 0; i <= resolution; i++) {
        const u = i / resolution;
        for (let j = 0; j <= resolution; j++) {
            const v = j / resolution;
            vertices.push(bezierSurface(u, v, controlPoints));
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

    return { vertices, indices };
}

function updateSurface() {
    const { vertices, indices } = generateBezierSurface(controlPoints, 20);

    // Load vertex data into GPU
    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Load index data into GPU
    const iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    render(indices.length);
}

function render(indexCount) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
}
