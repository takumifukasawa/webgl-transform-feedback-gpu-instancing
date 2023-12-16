import {Matrix4} from "./js/Matrix4.js";
import {Vector3} from "./js/Vector3.js";

const UNIFORM_TYPES = {
    Matrix4: "Matrix4",
    Vector3: "Vector3",
    Float: "Float",
};

const wrapperElement = document.getElementById("js-wrapper")
const canvasElement = document.getElementById("js-canvas");
const gl = canvasElement.getContext("webgl2", {antialias: false});

const instanceCount = 3;


// --------------------------------------------------------------------

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

    // name,
    // vbo,
    // usage,
    // location,
    // size,
    // divisor
    const vertices = [];

    let indices = [];
    let ibo;

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
        switch (data.constructor) {
            case Float32Array:
                gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
                break;
            case Uint16Array:
                gl.vertexAttribIPointer(location, size, gl.UNSIGNED_SHORT, 0, 0);
                break;
        }
        if (divisor) {
            gl.vertexAttribDivisor(location, divisor);
        }
        const a = new Float32Array(new Array(data.length).fill(0));
        // gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, a);

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
        indices,
        vao,
        ibo,
        getBuffers,
        setBuffer,
        findBuffer
    }
}

// --------------------------------------------------------------------

function createTransformFeedbackDoubleBuffer(gl, vertexShader, fragmentShader, attributes, varyings, srcUniforms, count) {
    let shader;
    let uniforms;
    const buffers = [];
    let drawCount;

    const getWrite = () => {
        return {
            vertexArrayObjectWrapper: buffers[0].vertexArrayObjectWrapper,
            transformFeedback: buffers[1].transformFeedback,
        }
    }

    const getRead = () => {
        const buffer = buffers[0];
        return {
            vertexArrayObjectWrapper: buffers[1].vertexArrayObjectWrapper,
            transformFeedback: buffers[0].transformFeedback,
        }
    }

    const swap = () => {
        buffers.reverse();
    }

    const transformFeedbackVaryings = varyings.map(({name}) => name);

    shader = createShader(gl, vertexShader, fragmentShader, transformFeedbackVaryings);
    uniforms = srcUniforms;
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
        name: "buffer1",
        // attributes: attributes1,
        // srcVertexArrayObject: vertexArrayObject1,
        // transformFeedback: transformFeedback2,
        // outputVertexArrayObject: vertexArrayObject2,
        attributes: attributes1,
        vertexArrayObjectWrapper: vertexArrayObjectWrapper1,
        transformFeedback: transformFeedback1,
    })
    buffers.push({
        name: "buffer2",
        // attributes: attributes2,
        // srcVertexArrayObject: vertexArrayObject2,
        // transformFeedback: transformFeedback1,
        // outputVertexArrayObject: vertexArrayObject1,
        attributes: attributes2,
        vertexArrayObjectWrapper: vertexArrayObjectWrapper2,
        transformFeedback: transformFeedback2,
    });

    return {
        getRead,
        getWrite,
        swap,
        shader,
        uniforms,
        drawCount
    }
}

function createShader(gl, vertexShader, fragmentShader, transformFeedbackVaryings) {
    const buildErrorInfo = (infoLog, shaderSource, header) => {
        return `[Shader] fragment shader has error
            
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
        const errorInfo = buildErrorInfo(vsInfo, vertexShader, "[Shader] vertex shader has error");
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
        const errorInfo = buildErrorInfo(fsInfo, fragmentShader, "[Shader] fragment shader has error");
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

function setUniformValues(gl, shader, uniforms = {}) {
    Object.keys(uniforms).forEach(uniformName => {
        const uniform = uniforms[uniformName];

        const {type, value} = uniform;

        const location = gl.getUniformLocation(shader, uniformName);
        switch (type) {
            case UNIFORM_TYPES.Float:
                gl.uniform1f(location, value);
                break;
            case UNIFORM_TYPES.Vector3:
                gl.uniform3fv(location, value.elements);
                break;
            case UNIFORM_TYPES.Matrix4:
                // arg[1] ... use transpose.
                gl.uniformMatrix4fv(location, false, value.elements);
                break;
            default:
                throw `invalid uniform - name: ${uniformName}, type: ${type}`;
        }
    });
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

    const boxPosition_0 = [-0.5, 0.5, 0.5];
    const boxPosition_1 = [-0.5, -0.5, 0.5];
    const boxPosition_2 = [0.5, 0.5, 0.5];
    const boxPosition_3 = [0.5, -0.5, 0.5];
    const boxPosition_4 = [0.5, 0.5, -0.5];
    const boxPosition_5 = [0.5, -0.5, -0.5];
    const boxPosition_6 = [-0.5, 0.5, -0.5];
    const boxPosition_7 = [-0.5, -0.5, -0.5];

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
    const targetCameraPosition = new Vector3(0, 0, 8);

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

void main() {
    vPosition = aPosition + aVelocity;
    vVelocity = vec3(.01, 0., 0.);
}
        `,
        `#version 300 es
        
precision mediump float;        

void main() {}
        `,
        [
            {
                name: 'position',
                // data: new Float32Array(new Array(instanceCount * 3).fill(0)),
                data: new Float32Array(new Array(instanceCount).fill(0).map(i => {
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
                data: new Float32Array(new Array(instanceCount * 3).fill(0)),
                size: 3,
                usage: gl.DYNAMIC_DRAW,
            },
        ],
        [
            {
                name: 'vPosition',
                // data: new Float32Array(new Array(instanceCount).fill(0)),
                // size: 3
            },
            {
                name: 'vVelocity',
                // data: new Float32Array(new Array(instanceCount).fill(0)),
                // size: 3
            }
        ],
        {},
        instanceCount
    );


    //
    // draws
    // 

    const boxGeometryData = createBoxGeometry();

    const boxGeometryColorData = new Float32Array(
        new Array(instanceCount)
            .fill(0)
            .map(() => {
                return [Math.random(), Math.random(), Math.random()];
            })
            .flat()
    );

    const boxVertexArrayObject = createVertexArrayObjectWrapper(
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
                data: new Float32Array(new Array(instanceCount * 3).fill(0)),
                size: 3,
                location: 2,
                divisor: 1,
                usage: gl.STATIC_DRAW
            },
            {
                name: 'instanceColor',
                data: boxGeometryColorData,
                size: 3,
                location: 3,
                divisor: 1,
                usage: gl.STATIC_DRAW
            },
        ],
        boxGeometryData.indices
    );

    const boxProgramObject = createShader(
        gl,
        `#version 300 es
    
layout (location = 0) in vec3 aPosition;   
layout (location = 1) in vec3 aNormal;   
layout (location = 2) in vec3 aInstancePosition;
layout (location = 3) in vec3 aInstanceColor; 

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vColor;
out vec3 vNormal;
out vec4 vWorldPosition;

void main() {
    vNormal = aNormal;
    vColor = aInstanceColor;
    
    vec4 localPosition = vec4(aPosition, 1.);
    localPosition.xyz += aInstancePosition;

    // vec4 worldPosition = uWorldMatrix * vec4(aPosition, 1.); 
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
void main() {
    vec3 lightDir = normalize(vec3(1., 1., 1.));
    vec3 normal = normalize(vNormal);
    float diffuse = (dot(lightDir, normal) + 1.) * .5;
    outColor = vec4(vec3(diffuse) * vColor, 1.);
}
    `
    );

    const boxUniforms = {
        uProjectionMatrix: {
            type: UNIFORM_TYPES.Matrix4,
            value: Matrix4.identity()
        },
        uViewMatrix: {
            type: UNIFORM_TYPES.Matrix4,
            value: Matrix4.identity()
        },
        uWorldMatrix: {
            type: UNIFORM_TYPES.Matrix4,
            value: Matrix4.identity()
        },
    };

    // const transformFeedback = new TransformFeedback()

    const onMouseMove = (e) => {
        const nx = (e.clientX / width) * 2 - 1;
        const ny = (e.clientY / height) * 2 - 1;
        targetCameraPosition.x = nx * 4;
        targetCameraPosition.y = -ny * 4 + 2;
    };

    const onWindowResize = () => {
        width = wrapperElement.offsetWidth;
        height = wrapperElement.offsetHeight;

        canvasElement.width = width;
        canvasElement.height = height;

        gl.viewport(0, 0, width, height);

        const fov = 60;
        const aspect = width / height;
        const near = 1;
        const far = 20;
        const projectionMatrix = Matrix4.getPerspectiveMatrix(fov * Math.PI / 180, aspect, near, far);
        boxUniforms.uProjectionMatrix.value = projectionMatrix;
    };

    const tick = (time) => {
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

        const cameraLookAtPosition = new Vector3(0, 0, 0);
        const cameraWorldMatrix = Matrix4.getLookAtMatrix(
            targetCameraPosition,
            cameraLookAtPosition,
            Vector3.up(),
            true
        );
        boxUniforms.uViewMatrix.value = cameraWorldMatrix.invert();

        //
        // update transform feedback
        //

        // 書き込み用の transform feedback と vertex array object を取得
        const writeBuffer = transformFeedbackDoubleBuffer.getWrite();

        gl.bindVertexArray(writeBuffer.vertexArrayObjectWrapper.vao);

        gl.useProgram(transformFeedbackDoubleBuffer.shader);

        setUniformValues(gl, transformFeedbackDoubleBuffer.shader, transformFeedbackDoubleBuffer.uniforms);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, writeBuffer.transformFeedback);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, transformFeedbackDoubleBuffer.drawCount);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        gl.disable(gl.RASTERIZER_DISCARD);

        gl.useProgram(null);

        gl.bindVertexArray(null);

        // transform feedback で更新したバッファを、描画するメッシュのバッファに割り当て
        boxVertexArrayObject.setBuffer(
            "instancePosition",
            transformFeedbackDoubleBuffer.getRead().vertexArrayObjectWrapper.findBuffer("position")
        );

        // 書き込み/読み込みをしたのでswap
        transformFeedbackDoubleBuffer.swap();

        //
        // 描画
        //

        const drawCount = boxVertexArrayObject.indices.length;

        // culling
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);

        // depth write
        gl.depthMask(true);

        // depth test
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.disable(gl.BLEND);

        gl.useProgram(boxProgramObject);

        setUniformValues(gl, boxProgramObject, boxUniforms);

        gl.bindVertexArray(boxVertexArrayObject.vao);

        gl.drawElementsInstanced(gl.TRIANGLES, drawCount, gl.UNSIGNED_SHORT, 0, instanceCount);

        gl.flush();

        requestAnimationFrame(tick);
    };

    onWindowResize();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    requestAnimationFrame(tick);
};

main();
