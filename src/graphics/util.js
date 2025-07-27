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


function calculateDistance(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
