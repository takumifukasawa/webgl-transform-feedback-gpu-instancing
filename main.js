import {Matrix4} from "./js/Matrix4.js";
import {Vector3} from "./js/Vector3.js";
import {DebuggerGUI} from "./js/DebuggerGUI.js";
import {FPSCounter} from "./js/FPSCounter.js";

const wrapperElement = document.getElementById("js-wrapper")
const canvasElement = document.getElementById("js-canvas");
const gl = canvasElement.getContext("webgl2", {antialias: false});

const maxInstanceCount = 65536 * 2;

const debuggerStates = {
    instanceCount: {
        minValue: 1,
        maxValue: maxInstanceCount,
        currentValue: 2048,
        stepValue: 1
    },
    baseSpeed: {
        minValue: 0.0001,
        maxValue: 0.5,
        currentValue: 0.05,
        stepValue: 0.001,
    },
    baseAttractRate: {
        minValue: 0.001,
        maxValue: 0.1,
        currentValue: 0.01,
        stepValue: 0.001,
    }
}

let fpsCounterView;
const fpsCounter = new FPSCounter(1);


// --------------------------------------------------------------------

function createShader(gl, vertexShader, fragmentShader, transformFeedbackVaryings) {
    const buildErrorInfo = (infoLog, shaderSource, header) => {
        return `${header}
            
---

${infoLog}

---
            
${shaderSource.split("\n").map((line, i) => {
            return `${i + 1}: ${line}`;
        }).join("\n")}       
`;
    };

    //
    // vertex shader
    //

    // create vertex shader  
    const vs = gl.createShader(gl.VERTEX_SHADER);
    // set shader source (string)
    gl.shaderSource(vs, vertexShader);
    // compile vertex shader
    gl.compileShader(vs);
    // check shader info log
    const vsInfo = gl.getShaderInfoLog(vs);
    if (vsInfo.length > 0) {
        const errorInfo = buildErrorInfo(vsInfo, vertexShader, "vertex shader has error");
        throw errorInfo;
    }

    //
    // fragment shader
    //

    // create fragment shader  
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    // set shader source (string)
    gl.shaderSource(fs, fragmentShader);
    // compile fragment shader
    gl.compileShader(fs);
    const fsInfo = gl.getShaderInfoLog(fs);
    // check shader info log
    if (fsInfo.length > 0) {
        const errorInfo = buildErrorInfo(fsInfo, fragmentShader, "fragment shader has error");
        throw errorInfo;
    }

    //
    // program object
    //

    const program = gl.createProgram();

    // attach shaders
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    if (transformFeedbackVaryings && transformFeedbackVaryings.length > 0) {
        gl.transformFeedbackVaryings(
            program,
            transformFeedbackVaryings,
            gl.SEPARATE_ATTRIBS // or INTERLEAVED_ATTRIBS
        );
    }

    // program link to gl context
    gl.linkProgram(program);

    // check program info log
    const programInfo = gl.getProgramInfoLog(program);
    if (programInfo.length > 0) {
        throw programInfo;
    }

    return program;
}

function createTransformFeedback(gl, buffers) {
    const transformFeedback = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    return transformFeedback;
}


function createVertexArrayObjectWrapper(gl, attributes, indicesData) {
    const vao = gl.createVertexArray();
    let ibo;
    let indices = null;

    // name,
    // vbo,
    // usage,
    // location,
    // size,
    // divisor
    const vertices = [];

    gl.bindVertexArray(vao);

    const getBuffers = () => {
        return vertices.map(({vbo}) => vbo);
    }

    const setBuffer = (name, newBuffer) => {
        const target = vertices.find(elem => elem.name === name);
        target.buffer = newBuffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
        gl.enableVertexAttribArray(target.location);
        gl.vertexAttribPointer(target.location, target.size, gl.FLOAT, false, 0, 0);
        // divisorは必要ない
        // if (target.divisor) {
        //     gl.vertexAttribDivisor(target.location, target.divisor);
        // }
        gl.bindVertexArray(null);
    }

    const findBuffer = (name) => {
        return vertices.find(elem => elem.name === name).vbo;
    }

    attributes.forEach(attribute => {
        const {name, data, size, location, divisor, usage} = attribute;
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage);
        gl.enableVertexAttribArray(location);
        // size ... 頂点ごとに埋める数
        // stride is always 0 because buffer is not interleaved.
        // ref:
        // - https://developer.mozilla.org/ja/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
        // - https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/vertexAttribIPointer

        // 今回は頂点データはfloat32限定
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);

        if (divisor) {
            gl.vertexAttribDivisor(location, divisor);
        }

        vertices.push({
            name,
            vbo,
            usage,
            location,
            size,
            divisor
        });
    });

    if (indicesData) {
        ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicesData), gl.STATIC_DRAW);
        indices = indicesData;
    }

    // unbind array buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // unbind vertex array to webgl context
    gl.bindVertexArray(null);

    // unbind index buffer
    if (ibo) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    return {
        vao,
        indices,
        getBuffers,
        setBuffer,
        findBuffer
    }
}

// --------------------------------------------------------------------

function createTransformFeedbackDoubleBuffer(gl, vertexShader, fragmentShader, attributes, varyings, count) {
    let shader;
    const buffers = [];
    let drawCount;

    const getWriteTargets = () => {
        return {
            vertexArrayObjectWrapper: buffers[0].vertexArrayObjectWrapper,
            transformFeedback: buffers[1].transformFeedback,
        }
    }

    const getReadTargets = () => {
        return {
            vertexArrayObjectWrapper: buffers[1].vertexArrayObjectWrapper,
            transformFeedback: buffers[0].transformFeedback,
        }
    }

    const swap = () => {
        buffers.reverse();
    }

    shader = createShader(gl, vertexShader, fragmentShader, varyings);
    drawCount = count;

    attributes.forEach((attribute, i) => {
        attribute.location = i;
        attribute.divisor = 0;
    });

    const attributes1 = attributes;
    const attributes2 = attributes.map(attribute => ({...attribute}));

    const vertexArrayObjectWrapper1 = createVertexArrayObjectWrapper(
        gl,
        attributes1,
    );
    const vertexArrayObjectWrapper2 = createVertexArrayObjectWrapper(
        gl,
        attributes2,
    );

    const transformFeedback1 = createTransformFeedback(
        gl,
        vertexArrayObjectWrapper1.getBuffers()
    );
    const transformFeedback2 = createTransformFeedback(
        gl,
        vertexArrayObjectWrapper2.getBuffers()
    );

    buffers.push({
        vertexArrayObjectWrapper: vertexArrayObjectWrapper1,
        transformFeedback: transformFeedback1,
    })
    buffers.push({
        vertexArrayObjectWrapper: vertexArrayObjectWrapper2,
        transformFeedback: transformFeedback2,
    });

    return {
        getReadTargets,
        getWriteTargets,
        swap,
        shader,
        drawCount
    }
}


function createBoxGeometry() {
    // -----------------------------
    //   6 ---- 4
    //  /|     /|
    // 0 ---- 2 |
    // | 7 -- | 5
    // |/     |/
    // 1 ---- 3
    // -----------------------------

    // const boxPosition_0 = [-0.5, 0.5, 0.5];
    // const boxPosition_1 = [-0.5, -0.5, 0.5];
    // const boxPosition_2 = [0.5, 0.5, 0.5];
    // const boxPosition_3 = [0.5, -0.5, 0.5];
    // const boxPosition_4 = [0.5, 0.5, -0.5];
    // const boxPosition_5 = [0.5, -0.5, -0.5];
    // const boxPosition_6 = [-0.5, 0.5, -0.5];
    // const boxPosition_7 = [-0.5, -0.5, -0.5];
    const boxPosition_0 = [-0.05, 0.05, 1.25];
    const boxPosition_1 = [-0.05, -0.05, 1.25];
    const boxPosition_2 = [0.05, 0.05, 1.25];
    const boxPosition_3 = [0.05, -0.05, 1.25];
    const boxPosition_4 = [0.5, 0.5, -1.25];
    const boxPosition_5 = [0.5, -0.5, -1.25];
    const boxPosition_6 = [-0.5, 0.5, -1.25];
    const boxPosition_7 = [-0.5, -0.5, -1.25];

    const normalsRaw = [
        [0, 0, 1], // front
        [1, 0, 0], // right
        [0, 0, -1], // back
        [-1, 0, 0], // left
        [0, 1, 0], // top
        [0, -1, 0], // bottom
    ];

    const positions = [
        // front
        ...boxPosition_0,
        ...boxPosition_1,
        ...boxPosition_2,
        ...boxPosition_3,
        // right
        ...boxPosition_2,
        ...boxPosition_3,
        ...boxPosition_4,
        ...boxPosition_5,
        // back
        ...boxPosition_4,
        ...boxPosition_5,
        ...boxPosition_6,
        ...boxPosition_7,
        // left
        ...boxPosition_6,
        ...boxPosition_7,
        ...boxPosition_0,
        ...boxPosition_1,
        // top
        ...boxPosition_6,
        ...boxPosition_0,
        ...boxPosition_4,
        ...boxPosition_2,
        // bottom
        ...boxPosition_1,
        ...boxPosition_7,
        ...boxPosition_3,
        ...boxPosition_5,
    ];
    const uvs = new Array(6)
        .fill(0)
        .map(() => [0, 1, 0, 0, 1, 1, 1, 0])
        .flat();
    const normals = normalsRaw.map((normal) => new Array(4).fill(0).map(() => normal)).flat(2);

    const indices = Array.from(Array(6).keys())
        .map((i) => [i * 4 + 0, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3])
        .flat();

    return {
        positions,
        uvs,
        normals,
        indices,
    };
}

// ----------------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------------

const main = () => {
    let width;
    let height;

    const transformFeedbackDoubleBuffer = createTransformFeedbackDoubleBuffer(
        gl,
        `#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aVelocity;

out vec3 vPosition;
out vec3 vVelocity;

uniform vec3 uChaseTargetPosition;
uniform float uTime;
uniform float uDeltaTime;
uniform float uBaseSpeed;
uniform float uBaseAttractRate;

void main() {
    float fid = float(gl_VertexID);
    // vPosition = aPosition + aVelocity * uDeltaTime * 10.;
    vPosition = aPosition + aVelocity;
    vec3 targetPositionOffset = vec3(
        cos(uTime * 2. + fid * 1.2) * (.6 + mod(fid, 1000.) * .0005),
        sin(uTime * .3 + fid * 1.3) * (.7 + mod(fid, 1000.) * .0005),
        sin(uTime * .9 + fid * 1.6) * (2. + mod(fid, 10000.) * .00005)
    );
    vec3 targetPosition = uChaseTargetPosition + targetPositionOffset;
    vVelocity = mix(
        aVelocity,
        // normalize(targetPosition - aPosition) * (uBaseSpeed + mod(fid, 1000.) * .0001),
        normalize(targetPosition - aPosition) * uBaseSpeed,
        // 0.01 + mod(fid, 100.) * .01
        uBaseAttractRate + mod(fid, 100.) * .0002
    );
}
        `,
        `#version 300 es
        
precision mediump float;        

void main() {}
        `,
        [
            {
                name: 'position',
                data: new Float32Array(new Array(maxInstanceCount).fill(0).map(i => {
                    return [
                        Math.random() * 2 - 1,
                        Math.random() * 2 - 1,
                        Math.random() * 2 - 1,
                    ]
                }).flat()),
                size: 3,
                usage: gl.DYNAMIC_DRAW,
            },
            {
                name: 'velocity',
                data: new Float32Array(new Array(maxInstanceCount * 3).fill(0)),
                size: 3,
                usage: gl.DYNAMIC_DRAW,
            },
        ],
        [
            'vPosition',
            'vVelocity',
        ],
        maxInstanceCount
    );

    //
    // box
    // 

    const boxGeometryData = createBoxGeometry();

    const boxGeometryScaleData = new Float32Array(
        new Array(maxInstanceCount)
            .fill(0)
            .map(() => {
                const s = Math.random() * 0.05 + 0.03;
                return [s, s, s];
            })
            .flat()
    );

    const boxGeometryColorData = new Float32Array(
        new Array(maxInstanceCount)
            .fill(0)
            .map(() => {
                return [
                    Math.random() * .6 + .3,
                    Math.random() * .3 + .2,
                    Math.random() * .6 + .3
                ];
            })
            .flat()
    );

    const boxVertexArrayObjectWrapper = createVertexArrayObjectWrapper(
        gl,
        [
            {
                name: 'position',
                data: new Float32Array(boxGeometryData.positions),
                size: 3,
                location: 0,
                usage: gl.STATIC_DRAW,
            },
            {
                name: 'normal',
                data: new Float32Array(boxGeometryData.normals),
                size: 3,
                location: 1,
                usage: gl.STATIC_DRAW,
            },
            {
                name: 'instancePosition',
                data: new Float32Array(new Array(maxInstanceCount * 3).fill(0)),
                size: 3,
                location: 2,
                divisor: 1,
                usage: gl.STATIC_DRAW
            },
            {
                name: 'instanceScale',
                data: boxGeometryScaleData,
                size: 3,
                location: 3,
                divisor: 1,
                usage: gl.STATIC_DRAW
            },
            {
                name: 'instanceColor',
                data: boxGeometryColorData,
                size: 3,
                location: 4,
                divisor: 1,
                usage: gl.STATIC_DRAW
            },
            {
                name: 'instanceVelocity',
                data: new Float32Array(new Array(maxInstanceCount * 3).fill(0)),
                size: 3,
                location: 5,
                divisor: 1,
                usage: gl.STATIC_DRAW
            },
        ],
        boxGeometryData.indices
    );

    const boxShader = createShader(
        gl,
        `#version 300 es
    
layout (location = 0) in vec3 aPosition;   
layout (location = 1) in vec3 aNormal;   
layout (location = 2) in vec3 aInstancePosition;
layout (location = 3) in vec3 aInstanceScale;
layout (location = 4) in vec3 aInstanceColor; 
layout (location = 5) in vec3 aInstanceVelocity; 

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vColor;
out vec3 vNormal;
out vec4 vWorldPosition;

mat4 getTranslationMat(vec3 p) {
    return mat4(
        // 行オーダー
        // 1., 0., 0., aInstancePosition.x,
        // 0., 1., 0., aInstancePosition.y,
        // 0., 0., 1., aInstancePosition.z,
        // 0., 0., 0., 1
        // 列オーダー
        1., 0., 0., 0.,
        0., 1., 0., 0.,
        0., 0., 1., 0.,
        p.x, p.y, p.z, 1.
    );
}

mat4 getScalingMat(vec3 s) {
    return mat4(
        // 行オーダー / 列オーダー
        s.x, 0., 0., 0.,
        0., s.y, 0., 0.,
        0., 0., s.z, 0.,
        0., 0., 0., 1.
    );
}

mat4 getLookAtMat(vec3 lookAt, vec3 p) {
    vec3 f = normalize(lookAt - p);
    vec3 r = normalize(cross(vec3(0., 1., 0.), f));
    vec3 u = cross(f, r);
    return mat4(
        r.x, r.y, r.z, 0.,
        u.x, u.y, u.z, 0.,
        f.x, f.y, f.z, 0.,
        0., 0., 0., 1.
    );
}

void main() {
    vColor = aInstanceColor;
    
    vec4 localPosition = vec4(aPosition, 1.);
    mat4 instanceMatrix =
        getTranslationMat(aInstancePosition) *
        getLookAtMat(aInstancePosition + aInstanceVelocity * 100., aInstancePosition) *
        getScalingMat(aInstanceScale);
    localPosition = instanceMatrix * localPosition;
    
    mat4 normalMatrix = transpose(inverse(uWorldMatrix * instanceMatrix));
    vNormal = (normalMatrix * vec4(aNormal, 1.)).xyz;

    vec4 worldPosition = uWorldMatrix * localPosition; 
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}
    `,
        `#version 300 es
precision mediump float;

in vec3 vNormal;
in vec4 vWorldPosition;
in vec3 vColor;

out vec4 outColor;

uniform vec3 uCameraPosition;

void main() {
    vec3 L = normalize(vec3(0., .8, 1.));
    vec3 N = normalize(vNormal);
    float NdotL = dot(L, N);
    vec3 PtoE = normalize(uCameraPosition - vWorldPosition.xyz);
    vec3 H = normalize(PtoE + L);
    float HdotN = clamp(dot(H, N), 0., 1.);
    
    float diffuse = (NdotL + 1.) * .5;
    
    // float specularPower = 128.;
    // float specular = pow(HdotN, specularPower);
    // vec3 specularColor = vec3(1., 1., 1.);
    
    outColor = vec4(diffuse * vColor, 1.);
    // outColor = vec4(diffuse * vColor + specular * specularColor, 1.);
}
    `);

    const pointerRawPosition = new Vector3(
        wrapperElement.offsetWidth / 2,
        wrapperElement.offsetHeight / 2,
        0
    );

    const onMouseMove = (e) => {
        pointerRawPosition.x = e.clientX;
        pointerRawPosition.y = e.clientY;
    };

    const onWindowResize = () => {
        width = wrapperElement.offsetWidth;
        height = wrapperElement.offsetHeight;

        canvasElement.width = width;
        canvasElement.height = height;

        gl.viewport(0, 0, width, height);
    };

    let beforeTime = performance.now() / 1000;

    const tick = (t) => {
        const time = t / 1000;

        const deltaTime = time - beforeTime;

        beforeTime = time;

        //
        // clear
        //

        gl.depthMask(true);
        gl.colorMask(true, true, true, true);
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        //
        // カメラ更新
        //

        const cameraPosition = new Vector3(0, 0, 7);
        const cameraLookAtPosition = new Vector3(0, 0, 0);
        const cameraWorldMatrix = Matrix4.getLookAtMatrix(
            cameraPosition,
            cameraLookAtPosition,
            Vector3.up(),
            true
        );

        const cameraViewMatrix = cameraWorldMatrix.clone().invert();

        const fov = 50;
        const aspect = width / height;
        const near = 1;
        const far = 20;
        const projectionMatrix = Matrix4.getPerspectiveMatrix(fov * Math.PI / 180, aspect, near, far);

        //
        // update transform feedback
        //

        const nx = (pointerRawPosition.x / width) * 2 - 1;
        const ny = (pointerRawPosition.y / height) * 2 - 1;
        const chaseTargetPosition = new Vector3(
            nx * 3,
            -ny * 3,
            0
        );

        // 書き込み用の transform feedback と vertex array object を取得
        const writeBufferTargets = transformFeedbackDoubleBuffer.getWriteTargets();

        gl.bindVertexArray(writeBufferTargets.vertexArrayObjectWrapper.vao);

        gl.useProgram(transformFeedbackDoubleBuffer.shader);

        gl.uniform1f(
            gl.getUniformLocation(transformFeedbackDoubleBuffer.shader, 'uTime'),
            time
        );
        gl.uniform1f(
            gl.getUniformLocation(transformFeedbackDoubleBuffer.shader, 'uDeltaTime'),
            deltaTime
        );
        gl.uniform3fv(
            gl.getUniformLocation(transformFeedbackDoubleBuffer.shader, 'uChaseTargetPosition'),
            chaseTargetPosition.elements
        );
        gl.uniform1f(
            gl.getUniformLocation(transformFeedbackDoubleBuffer.shader, 'uBaseSpeed'),
            debuggerStates.baseSpeed.currentValue
        );
        gl.uniform1f(
            gl.getUniformLocation(transformFeedbackDoubleBuffer.shader, 'uBaseAttractRate'),
            debuggerStates.baseAttractRate.currentValue
        );

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, writeBufferTargets.transformFeedback);
        gl.beginTransformFeedback(gl.POINTS);
        // gl.drawArrays(gl.POINTS, 0, transformFeedbackDoubleBuffer.drawCount);
        gl.drawArrays(gl.POINTS, 0, debuggerStates.instanceCount.currentValue);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        gl.disable(gl.RASTERIZER_DISCARD);

        gl.useProgram(null);

        gl.bindVertexArray(null);

        // transform feedback で更新したバッファを、描画するメッシュのバッファに割り当て
        boxVertexArrayObjectWrapper.setBuffer(
            "instancePosition",
            transformFeedbackDoubleBuffer.getReadTargets().vertexArrayObjectWrapper.findBuffer("position")
        );
        boxVertexArrayObjectWrapper.setBuffer(
            "instanceVelocity",
            transformFeedbackDoubleBuffer.getReadTargets().vertexArrayObjectWrapper.findBuffer("velocity")
        );

        // 書き込み/読み込みをしたのでswap
        transformFeedbackDoubleBuffer.swap();

        //
        // 描画
        //

        const meshDrawCount = boxVertexArrayObjectWrapper.indices.length;

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);

        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.disable(gl.BLEND);

        gl.useProgram(boxShader);

        gl.uniformMatrix4fv(
            gl.getUniformLocation(boxShader, "uWorldMatrix"),
            false,
            Matrix4.identity().elements
        )
        gl.uniformMatrix4fv(
            gl.getUniformLocation(boxShader, "uViewMatrix"),
            false,
            cameraViewMatrix.elements
        )
        gl.uniformMatrix4fv(
            gl.getUniformLocation(boxShader, "uProjectionMatrix"),
            false,
            projectionMatrix.elements
        );
        gl.uniform3fv(
            gl.getUniformLocation(boxShader, "uCameraPosition"),
            cameraPosition.elements
        );

        gl.bindVertexArray(boxVertexArrayObjectWrapper.vao);

        gl.drawElementsInstanced(gl.TRIANGLES, meshDrawCount, gl.UNSIGNED_SHORT, 0, debuggerStates.instanceCount.currentValue);

        gl.useProgram(null);

        gl.bindVertexArray(null);

        //
        // loop
        //

        gl.flush();

        requestAnimationFrame(tick);

        fpsCounter.calculate(time);
        fpsCounterView.textContent = `fps: ${Math.floor(fpsCounter.currentFPS).toString()}`;
    };

    const debuggerGUI = new DebuggerGUI();
    fpsCounterView = debuggerGUI.addText("");
    Object.keys(debuggerStates).forEach(key => {
        debuggerGUI.addSliderDebugger({
            label: key,
            minValue: debuggerStates[key].minValue,
            maxValue: debuggerStates[key].maxValue,
            initialValue: debuggerStates[key].currentValue,
            stepValue: debuggerStates[key].stepValue,
            onChange: (value) => {
                debuggerStates[key].currentValue = value;
            },
        });
    });
    wrapperElement.appendChild(debuggerGUI.rootElement);

    onWindowResize();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    requestAnimationFrame(tick);
};

main();
