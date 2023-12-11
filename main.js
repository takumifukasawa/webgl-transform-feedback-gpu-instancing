import {AttributeUsageTypes, UniformTypes, TextureTypes} from "./js/constants.js";
import {Matrix4} from "./js/Matrix4.js";
import {Vector3} from "./js/Vector3.js";
import {GPU} from "./js/GPU.js";
import {VertexArrayObject} from "./js/VertexArrayObject.js";
import {Shader} from "./js/Shader.js";
// import {TransformFeedbackDoubleBuffer} from "./js/TransformFeedbackDoubleBuffer.js";
// import {TransformFeedback} from "./js/TransformFeedback.js";
import {GLObject} from "./js/GLObject.js";
// import {Shader} from "./js/Shader.js";
import {TransformFeedback} from "./js/TransformFeedback.js";

const wrapperElement = document.getElementById("js-wrapper")
const canvasElement = document.getElementById("js-canvas");
const gl = canvasElement.getContext("webgl2", {antialias: false});

// const pixelRatio = Math.min(window.devicePixelRatio, 1.5);

const gpu = new GPU({gl});


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

        const vertexArrayObject1 = new VertexArrayObject({
            gpu,
            attributes: attributes1,
        });
        const vertexArrayObject2 = new VertexArrayObject({
            gpu,
            attributes: attributes2,
        });

        // console.log(attributes1, attributes2, vertexArrayObject1.getBuffers(), vertexArrayObject2.getBuffers())

        // const outputBuffers1 = varyings.map(({name, data}) => {
        //     const buffer = gl.createBuffer();
        //     gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        //     gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        //     gl.bindBuffer(gl.ARRAY_BUFFER, null);
        //     return {name, buffer};
        // });

        // const outputBuffers2 = varyings.map(({name, data}) => {
        //     const buffer = gl.createBuffer();
        //     gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        //     gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        //     gl.bindBuffer(gl.ARRAY_BUFFER, null);
        //     return {name, buffer};
        // });

        const transformFeedback1 = new TransformFeedback({
            gpu,
            buffers: vertexArrayObject1.getBuffers()
            // buffers: outputBuffers1
        });
        const transformFeedback2 = new TransformFeedback({
            gpu,
            buffers: vertexArrayObject2.getBuffers()
            // buffers: outputBuffers2
        });

        this.buffers = [
            {
                attributes: attributes1,
                srcVertexArrayObject: vertexArrayObject1,
                transformFeedback: transformFeedback2,
                outputVertexArrayObject: vertexArrayObject2,
            },
            {
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

function createShader (gl, vertexShader, fragmentShader, transformFeedbackVaryings) {
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
        const errorInfo = Shader.buildErrorInfo(vsInfo, vertexShader, "[Shader] vertex shader has error");
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
        const errorInfo = Shader.buildErrorInfo(fsInfo, fragmentShader, "[Shader] fragment shader has error");
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

    const instanceCount = 2;

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

    const geometry = new VertexArrayObject({
        gpu,
        attributes: [
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
        indices: boxGeometryData.indices
    });

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
            vertexArrayObject: transformFeedbackDoubleBuffer.write.vertexArrayObject,
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
