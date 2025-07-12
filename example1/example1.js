"use strict";

var gl, program;
var projectionMatrix, modelViewMatrix; // 전역 변수로 선언
var projectionMatrixLoc, modelViewMatrixLoc; // 전역 변수로 선언
var controlPoints = [
    [-1, -1, 0], // P00
    [-1, 1, 0],  // P01
    [1, -1, 0],  // P10
    [1, 1, 2]    // P11
];

// 카메라 관련 변수
var cameraPosition = [0, 0, 3];
var cameraTarget = [0, 0, 0];
var cameraUp = [0, 1, 0];

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

    // Generate and render Bézier surface
    updateSurface();

    // Add event listeners for sliders
    document.querySelectorAll(".slider").forEach(slider => {
        slider.addEventListener("input", () => {
            updateControlPoints();
            updateCameraPosition();
            updateSurface();
        });
    });

    // document.getElementById("centerHeight").addEventListener("input", () => {
    //     const centerHeight = parseFloat(document.getElementById("centerHeight").value);

    //     // 중앙 높이를 조정하기 위해 모든 제어점의 Y값을 조정
    //     controlPoints[0][1] = centerHeight / 2; // P00
    //     controlPoints[1][1] = centerHeight;     // P01
    //     controlPoints[2][1] = centerHeight / 2; // P10
    //     controlPoints[3][1] = centerHeight;     // P11

    //     updateSurface(); // 곡면 업데이트
    // });
};


function updateControlPoints() {
    controlPoints[0] = [
        parseFloat(document.getElementById("p00x").value),
        parseFloat(document.getElementById("p00y").value),
        parseFloat(document.getElementById("p00z").value)
    ];
    controlPoints[1] = [
        parseFloat(document.getElementById("p01x").value),
        parseFloat(document.getElementById("p01y").value),
        parseFloat(document.getElementById("p01z").value)
    ];
    controlPoints[2] = [
        parseFloat(document.getElementById("p10x").value),
        parseFloat(document.getElementById("p10y").value),
        parseFloat(document.getElementById("p10z").value)
    ];
    controlPoints[3] = [
        parseFloat(document.getElementById("p11x").value),
        parseFloat(document.getElementById("p11y").value),
        parseFloat(document.getElementById("p11z").value)
    ];
}

function updateCameraPosition() {
    cameraPosition[0] = parseFloat(document.getElementById("cameraX").value);
    cameraPosition[1] = parseFloat(document.getElementById("cameraY").value);
    cameraPosition[2] = parseFloat(document.getElementById("cameraZ").value);

    modelViewMatrix = lookAt(cameraPosition, cameraTarget, cameraUp);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
}

function bezierSurface(u, v, controlPoints) {
    const p00 = controlPoints[0];
    const p01 = controlPoints[1];
    const p10 = controlPoints[2];
    const p11 = controlPoints[3];

    const x = (1 - u) * (1 - v) * p00[0] +
              (1 - u) * v * p01[0] +
              u * (1 - v) * p10[0] +
              u * v * p11[0];

    const y = (1 - u) * (1 - v) * p00[1] +
              (1 - u) * v * p01[1] +
              u * (1 - v) * p10[1] +
              u * v * p11[1];

    const z = (1 - u) * (1 - v) * p00[2] +
              (1 - u) * v * p01[2] +
              u * (1 - v) * p10[2] +
              u * v * p11[2];

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
