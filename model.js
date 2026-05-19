function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Model Constructor
function Model(name) {
    this.name = name;
    
    // Буфери атрибутів
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();   // Новий буфер
    this.iTexCoordsBuffer = gl.createBuffer(); // Новий буфер
    
    // Буфери індексів
    this.iIndexBufferTriangles = gl.createBuffer();
    this.iIndexBufferLines = gl.createBuffer();
    
    this.countTriangles = 0;
    this.countLines = 0;

    // ID текстур
    this.idTextureDiffuse = -1;
    this.idTextureSpecular = -1;
    this.idTextureNormal = -1;

    this.BufferData = function(vertices, normals, tangents, texCoords, indicesTri, indicesLines) {
        // Вершини
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Нормалі
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        // Дотичні (Tangents) - для Normal Mapping
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, tangents, gl.STATIC_DRAW);

        // Текстурні координати
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        // Індекси трикутників
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferTriangles);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesTri, gl.STATIC_DRAW);
        this.countTriangles = indicesTri.length;

        // Індекси ліній (для сітки)
        if (indicesLines) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferLines);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesLines, gl.STATIC_DRAW);
            this.countLines = indicesLines.length;
        }
    }

    this.Draw = function(wireframe) {
        // 1. Прив'язка текстур
        if (this.idTextureDiffuse !== -1) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);
        }
        if (this.idTextureSpecular !== -1) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);
        }
        if (this.idTextureNormal !== -1) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);
        }

        // 2. Прив'язка атрибутів
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        // 3. Малювання
        if (wireframe) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferLines);
            gl.drawElements(gl.LINES, this.countLines, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferTriangles);
            gl.drawElements(gl.TRIANGLES, this.countTriangles, gl.UNSIGNED_SHORT, 0);
        }
    }
}

// Розрахунок точки, нормалі, дотичної та текстурних координат
function calcSurfacePoint(u, v, params) {
    const { R1, R2, fi } = params;
    
    const a = R2 - R1;
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;

    const beta = u; 
    const z = v;

    // --- Геометрія ---
    const r = a * (1 - Math.cos(2 * Math.PI * z / c)) + R1;
    const x = r * Math.cos(beta);
    const y = r * Math.sin(beta);
    const z_centered = z - b/2; 

    // --- Аналітичні Нормалі ---
    const dr_dz = a * (2 * Math.PI / c) * Math.sin(2 * Math.PI * z / c);

    // Дотична по U (derivative wrt beta)
    const tx_u = -r * Math.sin(beta);
    const ty_u =  r * Math.cos(beta);
    const tz_u =  0;

    // Дотична по V (derivative wrt z)
    const tx_v = dr_dz * Math.cos(beta);
    const ty_v = dr_dz * Math.sin(beta);
    const tz_v = 1;

    // Векторний добуток для Нормалі
    let nx = ty_u * tz_v - tz_u * ty_v;
    let ny = tz_u * tx_v - tx_u * tz_v;
    let nz = tx_u * ty_v - ty_u * tx_v;

    // Нормалізація Нормалі
    let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len > 0.00001) {
        nx /= len; ny /= len; nz /= len;
    }
    
    // Нормалізація Дотичної
    let lenT = Math.sqrt(tx_u*tx_u + ty_u*ty_u + tz_u*tz_u);
    let txn = tx_u, tyn = ty_u, tzn = tz_u;
    if(lenT > 0.00001) {
        txn/=lenT; tyn/=lenT; tzn/=lenT;
    }

    return {
        p: [x, y, z_centered],
        n: [nx, ny, nz],
        t: [txn, tyn, tzn],
        uv: [u / (2 * Math.PI), v / b]
    };
}

function CreateSurfaceData(data, params) {
    let vertices = [];
    let normals = [];
    let tangents = [];
    let texCoords = [];
    let indicesTri = [];
    let indicesLines = [];

    const { R1, R2, fi, u_steps, v_steps } = params;
    const a = R2 - R1;
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;

    const uMax = 2 * Math.PI;
    const vMax = b;

    // Генерація вершин
    for (let i = 0; i <= v_steps; i++) {
        let v = (i / v_steps) * vMax;
        for (let j = 0; j <= u_steps; j++) {
            let u = (j / u_steps) * uMax;
            
            let point = calcSurfacePoint(u, v, params);
            
            vertices.push(point.p[0], point.p[1], point.p[2]);
            normals.push(point.n[0], point.n[1], point.n[2]);
            tangents.push(point.t[0], point.t[1], point.t[2]);
            texCoords.push(point.uv[0], point.uv[1]);
        }
    }

    // Генерація індексів
    const rowLen = u_steps + 1;
    for (let i = 0; i < v_steps; i++) {
        for (let j = 0; j < u_steps; j++) {
            let p1 = i * rowLen + j;
            let p2 = p1 + 1;
            let p3 = (i + 1) * rowLen + j;
            let p4 = p3 + 1;

            // Трикутники
            indicesTri.push(p1, p3, p2);
            indicesTri.push(p2, p3, p4);

            // Лінії
            indicesLines.push(p1, p2);
            indicesLines.push(p1, p3);
        }
    }

    data.verticesF32 = new Float32Array(vertices);
    data.normalsF32 = new Float32Array(normals);
    data.tangentsF32 = new Float32Array(tangents);
    data.texCoordsF32 = new Float32Array(texCoords);
    data.indicesTriU16 = new Uint16Array(indicesTri);
    data.indicesLinesU16 = new Uint16Array(indicesLines);
}

function CreateSphereData(radius) {
    let vertices = [];
    let normals = [];
    let tangents = []; 
    let texCoords = []; 
    let indices = [];
    
    let latBands = 16;
    let longBands = 16;

    for (let lat = 0; lat <= latBands; lat++) {
        let theta = lat * Math.PI / latBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let long = 0; long <= longBands; long++) {
            let phi = long * 2 * Math.PI / longBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            let x = cosPhi * sinTheta;
            let y = cosTheta;
            let z = sinPhi * sinTheta;
            let u = 1 - (long / longBands);
            let v = 1 - (lat / latBands);

            normals.push(x, y, z);
            vertices.push(radius * x, radius * y, radius * z);
            tangents.push(-sinPhi, 0, cosPhi); 
            texCoords.push(u, v);
        }
    }

    for (let lat = 0; lat < latBands; lat++) {
        for (let long = 0; long < longBands; long++) {
            let first = (lat * (longBands + 1)) + long;
            let second = first + longBands + 1;
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return {
        verticesF32: new Float32Array(vertices),
        normalsF32: new Float32Array(normals),
        tangentsF32: new Float32Array(tangents),
        texCoordsF32: new Float32Array(texCoords),
        indicesTriU16: new Uint16Array(indices),
        indicesLinesU16: new Uint16Array([]) 
    };
}