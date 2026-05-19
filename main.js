'use strict';

let gl;
let surface;
let shProgram;
let spaceball;

let stereoCam;
let video;
let webCamTexture;
let bgSurface;

let g_viewDistance = 10;
let lightAngle = 0;
let g_useTextures = true;
let g_enableLighting = true;
let g_showWebcam = true;

let g_surfaceParams = {
    R1: 1.0, R2: 2.0, fi: Math.PI / 6, u_steps: 30, v_steps: 30
};

let g_stereoParams = {
    eyeSeparation: 0.7, convergence: 14.0, fov: 0.8, nearClip: 8.0, farClip: 200.0
};

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribTexCoord = -1;
    
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    
    this.iLightPosition = -1;
    this.iAmbientProduct = -1;
    this.iDiffuseProduct = -1;
    this.iSpecularProduct = -1;
    this.iShininess = -1;
    
    this.iTMU0 = -1;
    this.iTMU1 = -1;
    this.iTMU2 = -1;

    this.iUseDiffuse = -1;
    this.iUseSpecular = -1;
    this.iUseNormal = -1;
    this.iIsBackground = -1;
    this.iEnableLighting = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Рендеринг зображення з вебкамери на фоні
    if (g_showWebcam && video && video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, webCamTexture);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        gl.disable(gl.DEPTH_TEST);
        gl.uniform1i(shProgram.iIsBackground, 1);
        gl.uniform1i(shProgram.iTMU0, 0);
        
        let ortho = m4.orthographic(-1, 1, -1, 1, -1, 1);
        gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ortho);
        gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, m4.identity());
        
        bgSurface.Draw(false);
        
        gl.enable(gl.DEPTH_TEST);
        gl.uniform1i(shProgram.iIsBackground, 0);
    }

    gl.clear(gl.DEPTH_BUFFER_BIT);

    let modelView = spaceball.getViewMatrix(); 
    lightAngle += 0.01; 
    let lightRadius = 7.5;
    let lightPosWorld = [lightRadius * Math.sin(lightAngle), 7.5, lightRadius * Math.cos(lightAngle)];

    let viewMatrixOnly = m4.translation(0, 0, -g_viewDistance);
    let lightPosEye = m4.transformPoint(viewMatrixOnly, lightPosWorld);

    gl.uniform3fv(shProgram.iLightPosition, lightPosEye);
    gl.uniform3fv(shProgram.iAmbientProduct,  [0.2, 0.2, 0.2]);
    gl.uniform3fv(shProgram.iDiffuseProduct,  [1.0, 1.0, 1.0]); 
    gl.uniform3fv(shProgram.iSpecularProduct, [1.0, 1.0, 1.0]);
    gl.uniform1f(shProgram.iShininess, 50.0);
    
    gl.uniform1i(shProgram.iTMU0, 0);
    gl.uniform1i(shProgram.iTMU1, 1);
    gl.uniform1i(shProgram.iTMU2, 2);

    let useState = g_useTextures ? 1 : 0;
    
    function drawSceneForEye(frustumMat, transMat) {
        let mv = m4.multiply(transMat, modelView);
        let mvp = m4.multiply(frustumMat, mv);
        let normalMat = m4.transpose(m4.inverse(mv));

        gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvp);
        gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, mv);
        gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMat);

        gl.uniform1i(shProgram.iUseDiffuse, useState);
        gl.uniform1i(shProgram.iUseSpecular, useState);
        gl.uniform1i(shProgram.iUseNormal, useState);
        gl.uniform1i(shProgram.iEnableLighting, g_enableLighting ? 1 : 0);
        
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1.0, 1.0);
        surface.Draw(false); 
        gl.disable(gl.POLYGON_OFFSET_FILL);

        gl.uniform1i(shProgram.iUseDiffuse, 0);
        gl.uniform1i(shProgram.iUseSpecular, 0);
        gl.uniform1i(shProgram.iUseNormal, 0);
        gl.uniform1i(shProgram.iEnableLighting, 0); 
        surface.Draw(true);
    }

    // Анагліф для лівого ока
    gl.colorMask(true, false, false, true);
    let leftFrustum = stereoCam.calcLeftFrustum();
    let leftTrans = m4.translation(stereoCam.eyeSeparation / 2, 0, 0);
    drawSceneForEye(leftFrustum, leftTrans);

    // Анагліф для правого ока
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, true, true, true);
    let rightFrustum = stereoCam.calcRightFrustum();
    let rightTrans = m4.translation(-stereoCam.eyeSeparation / 2, 0, 0);
    drawSceneForEye(rightFrustum, rightTrans);

    gl.colorMask(true, true, true, true);

    requestAnimationFrame(draw);
}

function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex   = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal   = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent  = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, "NormalMatrix");
    
    shProgram.iLightPosition   = gl.getUniformLocation(prog, "LightPosition");
    shProgram.iAmbientProduct  = gl.getUniformLocation(prog, "AmbientProduct");
    shProgram.iDiffuseProduct  = gl.getUniformLocation(prog, "DiffuseProduct");
    shProgram.iSpecularProduct = gl.getUniformLocation(prog, "SpecularProduct");
    shProgram.iShininess       = gl.getUniformLocation(prog, "Shininess");
    
    shProgram.iTMU0 = gl.getUniformLocation(prog, "iTMU0");
    shProgram.iTMU1 = gl.getUniformLocation(prog, "iTMU1");
    shProgram.iTMU2 = gl.getUniformLocation(prog, "iTMU2");

    shProgram.iUseDiffuse = gl.getUniformLocation(prog, "uUseDiffuse");
    shProgram.iUseSpecular = gl.getUniformLocation(prog, "uUseSpecular");
    shProgram.iUseNormal = gl.getUniformLocation(prog, "uUseNormal");
    shProgram.iIsBackground = gl.getUniformLocation(prog, "uIsBackground");
    shProgram.iEnableLighting = gl.getUniformLocation(prog, "uEnableLighting");

    regenerateSurface();

    bgSurface = new Model('Background');
    let bgVerts = new Float32Array([-1,-1,0,  1,-1,0,  1,1,0,  -1,1,0]);
    let bgNorms = new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]);
    let bgTangs = new Float32Array([1,0,0, 1,0,0, 1,0,0, 1,0,0]);
    let bgTex = new Float32Array([0,0, 1,0, 1,1, 0,1]); 
    let bgIndTri = new Uint16Array([0,1,2, 0,2,3]);
    let bgIndLines = new Uint16Array([0,1, 1,2, 2,3, 3,0]);
    bgSurface.BufferData(bgVerts, bgNorms, bgTangs, bgTex, bgIndTri, bgIndLines);

    webCamTexture = gl.createTexture();

    gl.enable(gl.DEPTH_TEST);
}

function regenerateSurface() {
    let data = {};
    CreateSurfaceData(data, g_surfaceParams);
    
    if (!surface) surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.normalsF32, data.tangentsF32, data.texCoordsF32, data.indicesTriU16, data.indicesLinesU16);
    
    if (surface.idTextureDiffuse === -1) {
        surface.idTextureDiffuse = LoadTexture("./textures/diff.jpg"); 
        surface.idTextureSpecular = LoadTexture("./textures/spec.jpg");
        surface.idTextureNormal = LoadTexture("./textures/norm.jpg");
    }
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function updateStereoCamera() {
    stereoCam = new StereoCamera(
        g_stereoParams.eyeSeparation,
        g_stereoParams.convergence,
        gl.canvas.clientWidth / gl.canvas.clientHeight,
        g_stereoParams.fov,
        g_stereoParams.nearClip,
        g_stereoParams.farClip
    );
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl = canvas.getContext("webgl");
        if ( ! gl ) throw "Browser does not support WebGL";
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML = "<p>Error: " + e + "</p>";
        return;
    }
    
    initGL();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    spaceball = new TrackballRotator(canvas, function(){}, g_viewDistance);
    updateStereoCamera();

    // Запуск вебкамери
    video = document.createElement('video');
    video.autoplay = true;
    navigator.mediaDevices.getUserMedia({video: true}).then(function (stream) {
        video.srcObject = stream;
    }).catch(function(err) {
        console.log("Webcam error:", err);
    });

    // Регулювання FOV на колесо миші
    canvas.addEventListener("wheel", function(evt) {
        evt.preventDefault();
        if (evt.deltaY < 0) {
            g_stereoParams.fov -= 0.05;
        } else {
            g_stereoParams.fov += 0.05;
        }
        g_stereoParams.fov = Math.max(0.1, Math.min(3.0, g_stereoParams.fov));
        
        let fovSlider = document.getElementById("paramFOV");
        if (fovSlider) fovSlider.value = g_stereoParams.fov;
        
        updateStereoCamera();
    });

    document.getElementById("chkTextures").addEventListener("change", e => g_useTextures = e.target.checked);
    document.getElementById("chkLighting").addEventListener("change", e => g_enableLighting = e.target.checked);
    document.getElementById("chkWebcam").addEventListener("change", e => g_showWebcam = e.target.checked);

    function setupSlider(id, targetObj, paramKey, callback) {
        let el = document.getElementById(id);
        if(el) {
            el.addEventListener("input", (e) => {
                targetObj[paramKey] = parseFloat(e.target.value);
                if(callback) callback();
            });
        }
    }
    
    setupSlider("paramR1", g_surfaceParams, "R1", regenerateSurface);
    setupSlider("paramR2", g_surfaceParams, "R2", regenerateSurface);
    setupSlider("paramResU", g_surfaceParams, "u_steps", regenerateSurface);
    setupSlider("paramResV", g_surfaceParams, "v_steps", regenerateSurface);
    
    document.getElementById("paramFi").addEventListener("input", function(evt) {
        let val = evt.target.value;
        if (val === "pi/6") g_surfaceParams.fi = Math.PI / 6;
        else if (val === "-pi/6") g_surfaceParams.fi = -Math.PI / 6;
        regenerateSurface();
    });

    setupSlider("paramEyeSep", g_stereoParams, "eyeSeparation", updateStereoCamera);
    setupSlider("paramConvergence", g_stereoParams, "convergence", updateStereoCamera);
    setupSlider("paramFOV", g_stereoParams, "fov", updateStereoCamera);
    setupSlider("paramNearClip", g_stereoParams, "nearClip", updateStereoCamera);

    draw();
}