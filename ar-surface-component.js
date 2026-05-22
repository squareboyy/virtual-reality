AFRAME.registerComponent('my-surface', {
    init: function () {
        const el = this.el;

        // Прозорий куб-контейнер для оцінки меж
        const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
        const cubeMat = new THREE.MeshNormalMaterial({
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const containerCube = new THREE.Mesh(cubeGeom, cubeMat);
        el.setObject3D('container', containerCube);

        // Дефолтні параметри
        const R1 = 1.0, R2 = 2.0, fi = Math.PI / 6;
        const uSteps = 40, vSteps = 40;

        const surfaceData = CreateMySurfaceData(R1, R2, fi, uSteps, vSteps);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(surfaceData.verts, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(surfaceData.normals, 3));

        const indices = generateIndices(uSteps, vSteps);
        geometry.setIndex(indices);

        // Центрування моделі відносно маркера
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Масштабування, щоб фігура вписалася в маркер (розмір 1x1x1)
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 0.95 / maxDim;
        geometry.scale(scaleFactor, scaleFactor, scaleFactor);

        const material = new THREE.MeshPhongMaterial({
            color: 0xFF0000,
            // lime: color: 0x00FF00,
            wireframe: true, // Відображаємо у вигляді каркасу
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });

        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.surfaceMesh.rotation.x = -Math.PI / 2;
        el.setObject3D('mesh', this.surfaceMesh);
    },

    tick: function (time, timeDelta) {
        // Повільне обертання фігури навколо власної вертикальної осі
        if (this.surfaceMesh) {
            this.surfaceMesh.rotation.z += 0.01; 
        }
    }
});

function calcSurfacePoint(u, v, R1, R2, fi, a, b, c) {
    const beta = u; 
    const z = v;

    const r = a * (1 - Math.cos(2 * Math.PI * z / c)) + R1;
    const x = r * Math.cos(beta);
    const y = r * Math.sin(beta);
    const z_centered = z - b/2; 

    // Нормалі
    const dr_dz = a * (2 * Math.PI / c) * Math.sin(2 * Math.PI * z / c);

    const tx_u = -r * Math.sin(beta);
    const ty_u =  r * Math.cos(beta);
    const tz_u =  0;

    const tx_v = dr_dz * Math.cos(beta);
    const ty_v = dr_dz * Math.sin(beta);
    const tz_v = 1;

    let nx = ty_u * tz_v - tz_u * ty_v;
    let ny = tz_u * tx_v - tx_u * tz_v;
    let nz = tx_u * ty_v - ty_u * tx_v;

    let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len > 0.00001) {
        nx /= len; ny /= len; nz /= len;
    }

    return { position: [x, y, z_centered], normal: [nx, ny, nz] };
}

function CreateMySurfaceData(R1, R2, fi, uSteps, vSteps) {
    let verts = [];
    let normals = [];

    const a = R2 - R1;
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;

    const uMax = 2 * Math.PI;
    const vMax = b;

    // Генерація вершин
    for (let i = 0; i <= vSteps; i++) {
        let v = (i / vSteps) * vMax;
        for (let j = 0; j <= uSteps; j++) {
            let u = (j / uSteps) * uMax;
            
            let point = calcSurfacePoint(u, v, R1, R2, fi, a, b, c);
            
            verts.push(...point.position);
            normals.push(...point.normal);
        }
    }
    return { verts: verts, normals: normals };
}

// Генерація індексів для відмальовування трикутників
function generateIndices(uSteps, vSteps) {
    let indices = [];
    const rowLen = uSteps + 1;
    for (let i = 0; i < vSteps; i++) {
        for (let j = 0; j < uSteps; j++) {
            let p1 = i * rowLen + j;
            let p2 = p1 + 1;
            let p3 = (i + 1) * rowLen + j;
            let p4 = p3 + 1;

            indices.push(p1, p3, p2);
            indices.push(p2, p3, p4);
        }
    }
    return indices;
}