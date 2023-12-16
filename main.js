import {AttributeUsageTypes, UniformTypes, TextureTypes} from "./js/constants.js";
import {Matrix4} from "./js/Matrix4.js";
import {Vector3} from "./js/Vector3.js";
import {GPU} from "./js/GPU.js";
import {GLObject} from "./js/GLObject.js";

const wrapperElement = document.getElementById("js-wrapper")
const canvasElement = document.getElementById("js-canvas");
const gl = canvasElement.getContext("webgl2", {antialias: false});

const gpu = new GPU({gl});

const instanceCount = 3;

// --------------------------------------------------------------------


function buildErrorInfo(infoLog, shaderSource, header) {
    return `[Shader] fragment shader has error
            
---

${infoLog}

---
            
${shaderSource.split("\n").map((line, i) => {
        return `${i + 1}: ${line}`;
    }).join("\n")}       
`;
}

function createTransformFeedback(gl, buffers) {
    const transformFeedback = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        const a = new Float32Array(new Array(instanceCount * 3).fill(0));
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, a);
        // console.log(a)
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    return transformFeedback;
}


function createVertexArrayObject(gl, attributes, indicesData) {
    // name,
    // vbo,
    // usage,
    // location,
    // size,
    // divisor
    const vboList = [];
    let indices = [];
    let ibo;
    const vao = gl.createVertexArray();

    gl.bindVertexArray(vao);

    const getBuffers = () => {
        return vboList.map(({vbo}) => vbo);
    }

    const setBuffer = (name, newBuffer) => {
        const target = vboList.find(elem => elem.name === name);
        target.buffer = newBuffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
        gl.enableVertexAttribArray(target.location);
        gl.vertexAttribPointer(target.location, target.size, gl.FLOAT, false, 0, 0);
        // if (target.divisor) {
        //     gl.vertexAttribDivisor(target.location, target.divisor);
        // }
        gl.bindVertexArray(null);
    }

    const findBuffer = (name) => {
        return vboList.find(elem => elem.name === name).vbo;
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

        vboList.push({
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

    console.log(vao, ibo)

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

export class VertexArrayObject extends GLObject {
    #vao;
    #vboList;
    #gpu;
    #ibo;
    indices;

    get hasIndices() {
        return !!this.#ibo;
    }

    get glObject() {
        return this.#vao;
    }

    getBuffers() {
        return this.#vboList.map(({vbo}) => vbo);
    }

    setBuffer(name, newBuffer) {
        const target = this.#vboList.find(elem => elem.name === name);
        const gl = this.#gpu.gl;
        target.buffer = newBuffer;
        gl.bindVertexArray(this.#vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
        gl.enableVertexAttribArray(target.location);
        gl.vertexAttribPointer(target.location, target.size, gl.FLOAT, false, 0, 0);
        // if (target.divisor) {
        //     gl.vertexAttribDivisor(target.location, target.divisor);
        // }
        gl.bindVertexArray(null);
    }

    findBuffer(name) {
        return this.#vboList.find(elem => elem.name === name).vbo;
    }

    constructor({gpu, attributes, indices = null}) {
        super();

        this.#gpu = gpu;
        this.#vboList = [];

        const gl = this.#gpu.gl;
        this.#vao = gl.createVertexArray();

        // bind vertex array to webgl context
        gl.bindVertexArray(this.#vao);

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

            this.#vboList.push({
                name,
                vbo,
                usage,
                location,
                size,
                divisor
            });
        });

        if (indices) {
            this.#ibo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

            this.indices = indices;
        }

        // unbind vertex array to webgl context
        gl.bindVertexArray(null);

        // unbind array buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // unbind index buffer
        if (this.#ibo) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    }
}

// --------------------------------------------------------------------

export class TransformFeedbackDoubleBuffer extends GLObject {
    shader;
    uniforms;
    buffers;
    drawCount;

    get read() {
        const buffer = this.buffers[0];
        return {
            vertexArrayObject: buffer.srcVertexArrayObject,
            transformFeedback: buffer.transformFeedback,
        }
    }

    get write() {
        const buffer = this.buffers[0];
        return {
            vertexArrayObject: buffer.srcVertexArrayObject,
            transformFeedback: buffer.transformFeedback,
        }
    }

    constructor({gpu, attributes, varyings, vertexShader, fragmentShader, uniforms, drawCount}) {
        super();

        const gl = gpu.gl;

        const transformFeedbackVaryings = varyings.map(({name}) => name);

        this.shader = createShader(gl, vertexShader, fragmentShader, transformFeedbackVaryings);
        this.uniforms = uniforms;
        this.drawCount = drawCount;

        attributes.forEach((attribute, i) => {
            attribute.location = i;
            attribute.divisor = 0;
        });

        const attributes1 = attributes;
        const attributes2 = attributes.map(attribute => ({...attribute}));
        
        const vertexArrayObject1 = createVertexArrayObject(
            gl,
            attributes1,
        );
        const vertexArrayObject2 = createVertexArrayObject(
            gl,
            attributes2,
        );
       
        // const transformFeedback1 = new TransformFeedback({
        //     gpu,
        //     buffers: vertexArrayObject1.getBuffers()
        //     // buffers: outputBuffers1
        // });
        // const transformFeedback2 = new TransformFeedback({
        //     gpu,
        //     buffers: vertexArrayObject2.getBuffers()
        //     // buffers: outputBuffers2
        // });
        const transformFeedback1 = createTransformFeedback(
            gl,
            vertexArrayObject1.getBuffers()
        );
        const transformFeedback2 = createTransformFeedback(
            gl,
            vertexArrayObject2.getBuffers()
        );


        this.buffers = [
            {
                name: "buffer1",
                attributes: attributes1,
                srcVertexArrayObject: vertexArrayObject1,
                transformFeedback: transformFeedback2,
                outputVertexArrayObject: vertexArrayObject2,
            },
            {
                name: "buffer2",
                attributes: attributes2,
                srcVertexArrayObject: vertexArrayObject2,
                transformFeedback: transformFeedback1,
                outputVertexArrayObject: vertexArrayObject1,
            },
        ];
    }

    swap() {
        this.buffers.reverse();
    }
}


// ----------------------------------------------------------------------------------
// functions
// ----------------------------------------------------------------------------------

function createShader(gl, vertexShader, fragmentShader, transformFeedbackVaryings) {
    // vertex shader

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

    // fragment shader

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

    // program object

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

const createBoxGeometry = () => {
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


const createBoxShader = () => {
    return createShader(
        gpu.gl,
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
}

// ----------------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------------

const main = () => {
    const targetCameraPosition = new Vector3(0, 0, 8);

    let width;
    let height;

    const transformFeedbackDoubleBuffer = new TransformFeedbackDoubleBuffer({
        gpu,
        vertexShader: `#version 300 es

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
        fragmentShader: `#version 300 es
        
precision mediump float;        

void main() {}
        `,
        attributes: [
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
        varyings: [
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
        uniforms: {},
        drawCount: instanceCount
    });


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

    const geometry = createVertexArrayObject(
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

    const shader = createBoxShader();

    const uniforms = {
        uProjectionMatrix: {
            type: UniformTypes.Matrix4,
            value: Matrix4.identity()
        },
        uViewMatrix: {
            type: UniformTypes.Matrix4,
            value: Matrix4.identity()
        },
        uWorldMatrix: {
            type: UniformTypes.Matrix4,
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

        gpu.setSize(0, 0, width, height);

        const fov = 60;
        const aspect = width / height;
        const near = 1;
        const far = 20;
        const projectionMatrix = Matrix4.getPerspectiveMatrix(fov * Math.PI / 180, aspect, near, far);
        uniforms.uProjectionMatrix.value = projectionMatrix;
    };

    const tick = (time) => {
        gpu.clear(0, 0, 0, 1);

        gpu.updateTransformFeedback({
            shader: transformFeedbackDoubleBuffer.shader,
            uniforms: transformFeedbackDoubleBuffer.uniforms,
            transformFeedback: transformFeedbackDoubleBuffer.write.transformFeedback,
            vertexArrayObject: transformFeedbackDoubleBuffer.write.vertexArrayObject.vao,
            drawCount: transformFeedbackDoubleBuffer.drawCount
        });

        transformFeedbackDoubleBuffer.swap();

        geometry.setBuffer(
            "instancePosition",
            transformFeedbackDoubleBuffer.read.vertexArrayObject.findBuffer("position")
        );

        const cameraLookAtPosition = new Vector3(0, 0, 0);
        const cameraWorldMatrix = Matrix4.getLookAtMatrix(
            targetCameraPosition,
            cameraLookAtPosition,
            Vector3.up(),
            true
        );
        uniforms.uViewMatrix.value = cameraWorldMatrix.invert();

        gpu.setVertexArrayObject(geometry);
        gpu.setShader(shader);
        gpu.setUniforms(uniforms);

        const drawCount = geometry.indices.length;
        gpu.draw({drawCount, instanceCount});

        gpu.flush();

        requestAnimationFrame(tick);
    };

    onWindowResize();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    requestAnimationFrame(tick);
};

main();
